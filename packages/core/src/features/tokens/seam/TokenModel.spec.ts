import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Host, PropsModel} from '../../state'
import {textToken} from '../__testing__/tokenFactories'
import type {SelectionSnapshot} from '../dom/DomModel'
import {TokenHandle} from '../dom/TokenHandle'
import {joinNodes} from '../tree/tree'
import {TokenModel} from './TokenModel'

/**
 * Inline fixture (TokenModel.facade.spec lineage): 'he@[x]llo' parses to
 * text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9]. The DOM builders are
 * shared between the OLD shell (mounted via Store) and the NEW one (built
 * directly on the state models) so the parity probes compare identical trees.
 */
function buildInlineDom() {
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	return {container, text1, mark, text2}
}

type CoreProps = Parameters<PropsModel['set']>[0]

/**
 * The adapter's refs, by hand: pair the container's element children with the roots in order.
 * `bind` takes its elements from the consignment registries rather than from the painted DOM, so a
 * fixture that paints by hand has to say which element belongs to which token.
 *
 * Local rather than `__testing__/mountFixtures`'s `consignRendered`, which takes a `Store` — these
 * cases build on the state models directly, one layer below it.
 */
function consignRoots(model: TokenModel, container: HTMLElement): void {
	const elements = Array.from(container.children).filter((el): el is HTMLElement => el instanceof HTMLElement)
	model.nodes().forEach((node, index) => {
		// `.at`, so a fixture that paints fewer elements than it has roots leaves the rest
		// unconsigned rather than reading `undefined` past the end.
		const element = elements.at(index)
		if (element) model.consign(node.id)(element)
	})
}

/**
 * The snapshot's collapsed caret as an `anchorFor` argument list. These cases build the
 * model directly on the state models rather than through `Store`, so the resolution is the
 * same one `domAnchors()` performs, one step lower.
 */
function boundaryOf(snapshot: SelectionSnapshot | undefined): [Node, number] {
	if (!snapshot) throw new Error('expected a selection snapshot')
	return [snapshot.range.startContainer, snapshot.range.startOffset]
}

const INLINE_PROPS: CoreProps = {
	defaultValue: 'he@[x]llo',
	options: [{markup: '@[__value__]'}],
	Mark: () => null,
}

/**
 * The construction seam under test: the (props, host) pair Store wires — S2.9 dropped the
 * third argument, the `SelectionPort` thunk, when the model took ownership of the selection.
 * `props.set` runs AFTER construction, which is what makes `#seed`'s laziness pick up
 * `defaultValue`.
 */
function createNew(props: CoreProps) {
	const propsModel = new PropsModel()
	const host = new Host()
	const model = new TokenModel(propsModel, host)
	propsModel.set(props)
	return {model, props: propsModel, host}
}

function mountNew(props: CoreProps, container: HTMLElement) {
	const setup = createNew(props)
	setup.host.container(container)
	// Consignment is id-keyed, so it can only run once the mount has published a tree.
	consignRoots(setup.model, container)

	/** Manual adapter for structural passes: repaint the live roots, then consign — the bind effect does the rest. */
	const render = () => {
		const spans = setup.model.nodes().map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
			return span
		})
		container.replaceChildren(...spans)
		consignRoots(setup.model, container)
		return spans
	}
	return {...setup, container, render}
}

function mountNewInline() {
	const dom = buildInlineDom()
	return {...mountNew(INLINE_PROPS, dom.container), ...dom}
}

describe('TokenModel shell (seam/)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	describe('construction seam and wiring', () => {
		it('mounts directly on the state models: the parse reaches nodes(), the model clock pulses once and the DOM clock once per binding', () => {
			const setup = createNew(INLINE_PROPS)
			// Both clocks, because the mount drives both: the reconcile is a commit, and the bind
			// effect the mount installs runs immediately, so a bind follows it in the same turn.
			// The fused event could not tell them apart.
			const committedSpy = vi.fn()
			const boundSpy = vi.fn()
			watch(setup.model.committed, committedSpy)
			watch(setup.model.bound, boundSpy)
			// Renderer contract: no tree before mount.
			expect(setup.model.nodes()).toEqual([])

			const dom = buildInlineDom()
			setup.host.container(dom.container)

			// Mount applied the first reconcile (the model clock) and bound the empty registry
			// (the DOM clock). Nothing is BOUND for all that: elements arrive by consignment,
			// which is id-keyed, so the earliest an adapter can name a token is after the mount
			// published one.
			expect(committedSpy).toHaveBeenCalledTimes(1)
			expect(boundSpy).toHaveBeenCalledTimes(1)
			expect(setup.model.nodes().map(node => node.range())).toEqual([
				{start: 0, end: 2},
				{start: 2, end: 6},
				{start: 6, end: 9},
			])
			expect(setup.model.handle(setup.model.nodes()[0].id)).toBeUndefined()

			// The adapter's refs fire, and each ONE of them binds its own token — there is no
			// second whole-tree walk and nothing to report a paint. Three roots, three pulses of
			// the DOM clock. A binding is not a commit, so the model clock stands still.
			consignRoots(setup.model, dom.container)
			expect(boundSpy).toHaveBeenCalledTimes(4)
			expect(committedSpy).toHaveBeenCalledTimes(1)
			expect(dom.text1.textContent).toBe('he')
			expect(dom.text2.textContent).toBe('llo')
			expect(dom.text1.hasAttribute('contenteditable')).toBe(false)
			expect(dom.mark.getAttribute('contenteditable')).toBe('false')

			// The adapter re-renders and re-consigns the same elements: idempotent, and still
			// one pulse per ref rather than one per paint.
			consignRoots(setup.model, dom.container)
			expect(boundSpy).toHaveBeenCalledTimes(7)
			expect(committedSpy).toHaveBeenCalledTimes(1)
		})

		it('facade reads fail soft before mount', () => {
			const {model} = createNew({defaultValue: 'hello'})

			expect(model.nodes()).toEqual([])
			expect(model.anchorFor(document.body, 0)).toBeUndefined()
			expect(model.handleAt(document.body)).toBeUndefined()
			expect(model.handle(0)).toBeUndefined()
			expect(model.placeCaret('start')).toBe(false)
		})

		it('commits while DETACHED without touching a DOM it no longer drives', () => {
			// Detached, `bindNow` returns at its own guard: nothing binds, nothing is re-armed,
			// and every handle stays bound because a detach unbinds nothing. The commit is still
			// a commit — the model moves — and core leaves the orphaned DOM exactly as it found
			// it. Written after a dev-only check DID police it here and threw.
			const {model, host, text1} = mountNewInline()
			text1.textContent = 'WRONG'

			host.container(null)

			expect(() => model.setValue('he@[x]llo!')).not.toThrow()
			expect(text1.textContent).toBe('WRONG')
			expect(model.value()).toBe('he@[x]llo!')
		})

		it('a RE-ATTACH re-arms the writers and repairs a surface corrupted while detached', () => {
			// THE heal, and what replaced the divergence detector: `bindElements` disposes and
			// re-creates the per-surface effect unconditionally, so the re-arm's first run
			// rewrites whatever the surface holds. Anything that wrote a bound surface behind the
			// model's back — a composition, an `execCommand` while the guards are disposed — is
			// corrected by the next bind rather than reported.
			//
			// The re-attach is the sharp case because the first commit of every attach happens
			// one statement before the bind effect is installed (the props watch's
			// `{immediate: true}` arm, inside `host.onMounted`), while the previous generation's
			// handles are all still bound.
			const {model, host, container, text1} = mountNewInline()
			text1.textContent = 'WRONG'
			host.container(null)

			expect(() => host.container(container)).not.toThrow()

			consignRoots(model, container)
			expect(text1.textContent).toBe('he')
			expect(() => model.setValue('he@[x]llo!')).not.toThrow()
		})
	})

	describe('the two clocks (renderer contract)', () => {
		it('text edits patch the DOM in place and pulse the model clock once after consistency', () => {
			// `committed` is the subject: the model's own value reaching the DOM. A text edit
			// paints through the per-surface effect, so nothing here needs a bind to show the new
			// character — but every commit binds anyway, which is what makes `bound` a clock the
			// caret can trust after ANY commit. `domAtEvent` is the ordering pin: the writers are
			// queued ahead of the event's subscribers.
			const {model, text2} = mountNewInline()
			const committedSpy = vi.fn()
			const boundSpy = vi.fn()
			watch(model.bound, boundSpy)
			let domAtEvent: string | null = null
			watch(model.committed, () => {
				committedSpy()
				domAtEvent = text2.textContent
			})

			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '!')

			expect(text2.textContent).toBe('llo!')
			expect(domAtEvent).toBe('llo!')
			expect(committedSpy).toHaveBeenCalledTimes(1)
			expect(boundSpy).toHaveBeenCalledTimes(1)

			// Consume-once hint: a second edit patches through the windowed parse again.
			model.replaceBetween(model.anchorAt(10), model.anchorAt(10), '!')
			expect(text2.textContent).toBe('llo!!')
			expect(committedSpy).toHaveBeenCalledTimes(2)
			expect(boundSpy).toHaveBeenCalledTimes(2)
		})

		it('a structural edit pulses the model clock once, and the born node gets its handle from its own ref', () => {
			// The split's whole point, on one commit: `committed` is a commit fact and does not
			// wait for a paint, while a HANDLE cannot appear before one — the born node has no
			// element until the adapter consigns it, and no clock can conjure one.
			const {model, render} = mountNewInline()
			const committedSpy = vi.fn()
			const boundSpy = vi.fn()
			watch(model.committed, committedSpy)
			watch(model.bound, boundSpy)

			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '@[y]')

			expect(model.nodes().map(node => node.range())).toEqual([
				{start: 0, end: 2},
				{start: 2, end: 6},
				{start: 6, end: 9},
				{start: 9, end: 13},
				{start: 13, end: 13},
			])
			expect(committedSpy).toHaveBeenCalledTimes(1)
			// The commit rebound what it could, but the node it BORE is still elementless.
			expect(model.handle(model.nodes()[3].id)).toBeUndefined()
			const boundAtCommit = boundSpy.mock.calls.length
			expect(boundAtCommit).toBeGreaterThan(0)

			const spans = render()

			// Five refs fire, and each binds its own token: no commit, so the model clock is still.
			expect(boundSpy).toHaveBeenCalledTimes(boundAtCommit + 5)
			expect(committedSpy).toHaveBeenCalledTimes(1)
			expect(spans[3].textContent).toBe('y')
			expect(model.handleAt(spans[3])).toBeInstanceOf(TokenHandle)
		})
	})

	describe('handles', () => {
		it('a control leaves the editing host the moment it registers, with no bind in between', () => {
			// Controls do not mount on the commit clock — a menu opening off a block-store
			// signal never sees a re-bind — so the atomic write belongs to registration.
			const {model} = mountNewInline()
			const button = document.createElement('button')

			model.control()(button)

			expect(button.getAttribute('contenteditable')).toBe('false')
		})

		it('handleAt is tri-state: handle for token DOM, control for registered controls, undefined outside', () => {
			const {model, container, text1, mark} = mountNewInline()
			const button = document.createElement('button')
			const inner = document.createElement('span')
			button.append(inner)
			container.append(button)
			model.control()(button)

			const handle = model.handleAt(text1)
			expect(handle).toBeInstanceOf(TokenHandle)
			if (!(handle instanceof TokenHandle)) throw new Error('expected token handle')
			expect(handle.element()).toBe(text1)
			// Walk-up: a text node inside the mark resolves to the mark's handle.
			const markText = mark.firstChild
			if (!markText) throw new Error('expected mark text node')
			expect(model.handleAt(markText)).toBe(model.handle(model.nodes()[1].id!))
			// Walk-up inside a control root resolves to 'control'.
			expect(model.handleAt(inner)).toBe('control')
			expect(model.handleAt(document.createElement('div'))).toBeUndefined()
		})

		it('handle(id) resolves by token id over the bound layer', () => {
			const {model, text2} = mountNewInline()

			expect(model.handle(model.nodes()[2].id!)?.element()).toBe(text2)
			expect(model.handle(999999)).toBeUndefined()
			const ids = model.nodes().map(token => model.handle(token.id!)?.id)
			expect(ids).toEqual(model.nodes().map(token => token.id))
		})

		it('handle(id) bridges fresh and stale token objects by identity and rejects foreign ids', () => {
			const {model, text2} = mountNewInline()
			const stale = model.nodes()[2]
			const handle = model.handle(stale.id!)
			expect(handle?.element()).toBe(text2)

			// Text path: the node is mutated in place, and its id and object both survive.
			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '!')

			expect(model.handle(stale.id)).toBe(handle)
			expect(model.nodes()[2]).toBe(stale)
			expect(joinNodes([model.nodes()[2]])).toBe('llo!')
			expect(handle?.element()?.textContent).toBe('llo!')
			// Foreign id: no live node, so no handle.
			expect(model.handle(999999)).toBeUndefined()
		})

		it('answers for a SURVIVING node and refuses a node BORN by the commit, until its bind', () => {
			// ADR-0008, and the case that replaced "handle(id) fails closed while a structural
			// apply awaits its bind": absence is the only refusal. A surviving node keeps its
			// handle and its element through the window — the latch used to hide both — while a
			// node this commit added has no entry in the layer at all until `bind` creates one.
			const {model, render} = mountNewInline()
			const survivor = model.nodes()[2]
			const handle = model.handle(survivor.id!)
			expect(handle).toBeInstanceOf(TokenHandle)
			const before = new Set(model.nodes().map(node => node.id))

			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '@[y]')

			const born = model.nodes().find(node => !before.has(node.id))
			if (!born) throw new Error('expected the commit to have added a node')
			expect(model.handle(survivor.id!)).toBe(handle)
			expect(model.handle(born.id!)).toBeUndefined()

			render()

			expect(model.handle(survivor.id!)).toBe(handle)
			expect(model.handle(born.id!)).toBeInstanceOf(TokenHandle)
		})

		it('a registered child-sequence host lands on its mark handle and opens the mark for editing', () => {
			// 'he#[ab]llo' → text 'he' [0,2], mark '#[ab]' [2,7] (child text 'ab' [4,6]), text 'llo' [7,10]
			const setup = createNew({defaultValue: 'he#[ab]llo', options: [{markup: '#[__slot__]'}], Mark: () => null})
			const container = document.createElement('div')
			const text1 = document.createElement('span')
			const markEl = document.createElement('span')
			const wrapper = document.createElement('div')
			const childSpan = document.createElement('span')
			wrapper.append(childSpan)
			markEl.append(wrapper)
			const text2 = document.createElement('span')
			document.body.append(container)

			// Mount the EMPTY container, then paint, then register and consign, then report
			// rendered — the real adapter order, and mandatory because both registrations are
			// id-keyed: the id only exists once the mount has published a tree.
			setup.host.container(container)
			container.append(text1, markEl, text2)
			const mark = setup.model.nodes()[1]
			if (mark.kind !== 'mark') throw new Error('expected mark')
			setup.model.children(mark.id)(wrapper)
			consignRoots(setup.model, container)
			setup.model.consign(mark.children()[0].id)(childSpan)
			expect(setup.model.handle(mark.id)?.node()?.childSequenceHost).toBe(wrapper)
			// The host is what keeps the mark root out of `contenteditable=false`: a value-only
			// mark is atomic, a slot mark's content stays in the one editing host.
			expect(markEl.hasAttribute('contenteditable')).toBe(false)
			const child = setup.model.handle(mark.children()[0].id)
			expect(child?.element()).toBe(childSpan)
			expect(childSpan.textContent).toBe('ab')
			expect(setup.model.handleAt(childSpan)).toBe(child)
			expect(setup.model.handle(mark.children()[0].id)).toBe(child)
		})
	})

	describe('placement commands and selection reads', () => {
		it("placeCaret places inside the anchor's own surface; the snapshot reads it back", () => {
			const {model, text1} = mountNewInline()

			expect(model.placeCaret(model.anchorAt(1))).toBe(true)
			expect(model.anchorFor(...boundaryOf(model.domSelection()))).toEqual({node: model.nodes()[0], offset: 1})
			const range = model.domSelection()?.range
			expect(range?.startContainer).toBe(text1.firstChild)
			expect(range?.collapsed).toBe(true)
			expect(model.caretRect()).toBeDefined()
			expect(model.domSelection()?.focusNode).toBe(range?.startContainer)
		})

		it("handle.placeCaret targets the handle's token explicitly", () => {
			const {model} = mountNewInline()
			const token = model.nodes()[2] // text 'llo' [6,9]
			const handle = model.handle(token.id!)
			if (!handle) throw new Error('expected handle')
			expect(handle.placeCaret(1)).toBe(true)
			expect(model.anchorFor(...boundaryOf(model.domSelection()))).toEqual({node: model.nodes()[2], offset: 1})
			// A foreign token object (never reconciled) carries no id, so it has no
			// live handle — the stale reference is rejected at resolution, leaving
			// nothing to place into.
			const foreign = textToken('llo', 6)
			expect(foreign.id).toBeUndefined()
		})

		it('selectRange spans two text surfaces and the reads see the selection', () => {
			const {model} = mountNewInline()

			expect(model.selectRange(model.anchorAt(0), model.anchorAt(9))).toBe(true)
			const range = model.domSelection()?.range
			expect(model.anchorFor(range!.startContainer, range!.startOffset, 'after')).toEqual({
				node: model.nodes()[0],
				offset: 0,
			})
			expect(model.anchorFor(range!.endContainer, range!.endOffset, 'before')).toEqual({
				node: model.nodes()[2],
				offset: 3,
			})
			expect(model.domSelection()?.range.collapsed).toBe(false)
			const content = model.selectedContent()
			expect(content?.text).toContain('he')
		})
	})
})