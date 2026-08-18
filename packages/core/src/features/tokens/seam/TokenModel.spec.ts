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
 * The snapshot's collapsed caret as an `anchorFor` argument list. These cases build the
 * model directly on the state models rather than through `Store`, so the resolution is the
 * same one `domAnchors()` performs, one step lower.
 */
function boundaryOf(snapshot: SelectionSnapshot | undefined): [Node, number] {
	if (!snapshot) throw new Error('expected a selection snapshot')
	return [snapshot.anchor.node, snapshot.anchor.offset]
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
	setup.host.rendered()
	/** Manual adapter for structural passes: repaint the live roots (value-only inline markups), report rendered. */
	const render = () => {
		const spans = setup.model.nodes().map(node => {
			const span = document.createElement('span')
			if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
			return span
		})
		container.replaceChildren(...spans)
		setup.host.rendered()
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
		it('mounts directly on the state models: the parse reaches nodes(), changed announces the first bind', () => {
			const setup = createNew(INLINE_PROPS)
			const changedSpy = vi.fn()
			watch(setup.model.changed, changedSpy)
			// Renderer contract: no tree before mount.
			expect(setup.model.nodes()).toEqual([])

			const dom = buildInlineDom()
			setup.host.container(dom.container)

			// Mount applied the first reconcile and bound the pre-built DOM.
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(setup.model.nodes().map(node => node.range())).toEqual([
				{start: 0, end: 2},
				{start: 2, end: 6},
				{start: 6, end: 9},
			])
			expect(dom.text1.textContent).toBe('he')
			expect(dom.text2.textContent).toBe('llo')
			expect(dom.text1.hasAttribute('contenteditable')).toBe(false)
			expect(dom.mark.getAttribute('contenteditable')).toBe('false')

			// Adapter re-render: idempotent re-bind, consistency re-announced.
			setup.host.rendered()
			expect(changedSpy).toHaveBeenCalledTimes(2)
		})

		it('facade reads fail soft before mount', () => {
			const {model} = createNew({defaultValue: 'hello'})

			expect(model.nodes()).toEqual([])
			expect(model.anchorFor(document.body, 0)).toBeUndefined()
			expect(model.handleAt(document.body)).toBeUndefined()
			expect(model.handle(0)).toBeUndefined()
			expect(model.placeCaret('start')).toBe(false)
		})
	})

	describe('renderEpoch and changed (renderer contract)', () => {
		it('text edits leave the epoch standing, patch the DOM in place and fire changed once after consistency', () => {
			const {model, text2} = mountNewInline()
			const epochBefore = model.renderEpoch()
			const treeSpy = vi.fn()
			watch(model.renderEpoch, treeSpy)
			const changedSpy = vi.fn()
			let domAtEvent: string | null = null
			watch(model.changed, changeset => {
				changedSpy(changeset)
				domAtEvent = text2.textContent
			})

			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '!')

			expect(text2.textContent).toBe('llo!')
			expect(domAtEvent).toBe('llo!')
			expect(model.renderEpoch()).toBe(epochBefore)
			expect(treeSpy).not.toHaveBeenCalled()
			expect(changedSpy).toHaveBeenCalledTimes(1)

			// Consume-once hint: a second edit patches through the windowed parse again.
			model.replaceBetween(model.anchorAt(10), model.anchorAt(10), '!')
			expect(text2.textContent).toBe('llo!!')
			expect(changedSpy).toHaveBeenCalledTimes(2)
			expect(model.renderEpoch()).toBe(epochBefore)
		})

		it('structural edits bump the epoch and stay quiet until the adapter renders', () => {
			const {model, render} = mountNewInline()
			const epochBefore = model.renderEpoch()
			const changedSpy = vi.fn()
			watch(model.changed, changedSpy)

			model.replaceBetween(model.anchorAt(9), model.anchorAt(9), '@[y]')

			expect(model.renderEpoch()).not.toBe(epochBefore)
			expect(model.nodes().map(node => node.range())).toEqual([
				{start: 0, end: 2},
				{start: 2, end: 6},
				{start: 6, end: 9},
				{start: 9, end: 13},
				{start: 13, end: 13},
			])
			expect(changedSpy).not.toHaveBeenCalled()

			const spans = render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
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
			const {model, host, container, text1, mark} = mountNewInline()
			const button = document.createElement('button')
			const inner = document.createElement('span')
			button.append(inner)
			container.append(button)
			model.control()(button)
			host.rendered()

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

		it('children() refs scope the structural walk to the registered child-sequence host', () => {
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

			// Mount the EMPTY container, then paint, then register, then report rendered — the
			// real adapter order, and mandatory since S1.8 step 4 made the registration
			// id-keyed: the id only exists once the mount has published a tree. Painting
			// before the mount instead would let the mount's immediate bind run with no host
			// registered, mis-bind the child text token to `wrapper` and overwrite its
			// `textContent` — destroying `childSpan` before the real bind ever sees it.
			setup.host.container(container)
			container.append(text1, markEl, text2)
			setup.model.children(setup.model.nodes()[1].id)(wrapper)
			setup.host.rendered()

			const mark = setup.model.nodes()[1]
			if (mark.kind !== 'mark') throw new Error('expected mark')
			expect(setup.model.handle(mark.id)?.node()?.childSequenceHost).toBe(wrapper)
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
			expect(model.domSelection()?.anchor.node).toBe(text1.firstChild)
			const anchor = model.domSelection()?.anchor
			expect(anchor?.isCollapsed).toBe(true)
			expect(model.domSelection()?.rect).toBeDefined()
			expect(model.domSelection()?.focusNode).toBe(anchor?.node)
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
			const {model, text1} = mountNewInline()

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
			expect(model.domSelection()?.anchor.isCollapsed).toBe(false)
			expect(model.domSelection()?.intersects(text1)).toBe(true)
			const content = model.selectedContent()
			expect(content?.text).toContain('he')
		})
	})

	describe('editable state', () => {
		it('setEditable writes the container host', () => {
			// The ONE editing host is the container, so the manual override is one attribute
			// write on it — not a sweep over bound surfaces, which carry no editability of
			// their own. `editable && !readOnly`, so the third call is the readOnly veto.
			const {model, container} = mountNewInline()

			model.setEditable({editable: false, readOnly: false})
			expect(container.getAttribute('contenteditable')).toBe('false')

			model.setEditable({editable: true, readOnly: false})
			expect(container.getAttribute('contenteditable')).toBe('true')

			model.setEditable({editable: true, readOnly: true})
			expect(container.getAttribute('contenteditable')).toBe('false')
		})

		it('setEditable is a no-op while unmounted', () => {
			// The mount guard is the whole case: there is no host to write, and without it the
			// write reaches `null.contentEditable` and throws.
			const {model} = createNew(INLINE_PROPS)

			expect(() => model.setEditable({editable: true, readOnly: false})).not.toThrow()
		})
	})
})