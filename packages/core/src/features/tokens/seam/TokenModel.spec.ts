import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {Host, PropsModel} from '../../state'
import {textToken} from '../__testing__/tokenFactories'
import {TokenHandle} from '../dom/TokenHandle'
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

/** Block fixture: mark 'one\n\n' [0,5] (child text 'one'), mark 'two\n\n' [5,10] (child 'two') — one row div per mark. */
function buildBlockDom(): HTMLElement {
	const container = document.createElement('div')
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const mark = document.createElement('span')
		const text = document.createElement('span')
		mark.append(text)
		row.append(mark)
		container.append(row)
	}
	document.body.append(container)
	return container
}

type CoreProps = Parameters<PropsModel['set']>[0]

const INLINE_PROPS: CoreProps = {
	defaultValue: 'he@[x]llo',
	options: [{markup: '@[__value__]'}],
	Mark: () => null,
}

const BLOCK_PROPS: CoreProps = {
	defaultValue: 'one\n\ntwo\n\n',
	layout: 'block',
	options: [{markup: '__slot__\n\n'}],
	Mark: () => null,
}

/**
 * The construction seam under test: the (props, host, selectionPort) triple Store
 * wires. `props.set` runs AFTER construction, which is what makes `#seed`'s laziness
 * pick up `defaultValue`.
 */
function createNew(props: CoreProps) {
	const propsModel = new PropsModel()
	const host = new Host()
	// Inert port: these cases assert the value/tree seam, not the D7 caret repair.
	const model: TokenModel = new TokenModel(propsModel, host, () => ({anchors: () => undefined, repair: () => {}}))
	propsModel.set(props)
	return {model, props: propsModel, host}
}

function mountNew(props: CoreProps, container: HTMLElement) {
	const setup = createNew(props)
	setup.host.container(container)
	setup.host.rendered()
	/** Manual adapter for structural passes: repaint renderTree() (value-only inline markups), report rendered. */
	const render = () => {
		const spans = setup.model.renderTree().map(token => {
			const span = document.createElement('span')
			if (token.type === 'mark') span.append(document.createTextNode(token.value))
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

function mountOld(props: CoreProps, container: HTMLElement): Store {
	const store = new Store()
	store.props.set(props)
	store.host.container(container)
	store.host.rendered()
	return store
}

/**
 * Walk two structurally identical containers in lockstep, yielding every
 * (node, offset) DOM boundary of both — the old facade.spec probe grid,
 * run pairwise against both shells.
 * @yields [oldNode, newNode, offset] aligned probes
 */
function* parallelProbes(oldRoot: HTMLElement, newRoot: HTMLElement): Generator<[Node, Node, number]> {
	const oldWalker = document.createTreeWalker(oldRoot, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
	const newWalker = document.createTreeWalker(newRoot, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
	let oldNode: Node | null = oldRoot
	let newNode: Node | null = newRoot
	while (oldNode && newNode) {
		const max = oldNode instanceof Text ? oldNode.length : oldNode.childNodes.length
		for (let offset = 0; offset <= max; offset++) yield [oldNode, newNode, offset]
		oldNode = oldWalker.nextNode()
		newNode = newWalker.nextNode()
	}
}

describe('TokenModel shell (seam/)', () => {
	afterEach(() => {
		document.body.replaceChildren()
		window.getSelection()?.removeAllRanges()
	})

	describe('construction seam and wiring', () => {
		it('mounts directly on the state models: renderTree publishes the parse, changed announces the first bind', () => {
			const setup = createNew(INLINE_PROPS)
			const changedSpy = vi.fn()
			watch(setup.model.changed, changedSpy)
			// Renderer contract: nothing published before mount.
			expect(setup.model.renderTree()).toEqual([])

			const dom = buildInlineDom()
			setup.host.container(dom.container)

			// Mount applied the first reconcile and bound the pre-built DOM.
			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(setup.model.renderTree().map(t => t.content)).toEqual(['he', '@[x]', 'llo'])
			expect(dom.text1.textContent).toBe('he')
			expect(dom.text2.textContent).toBe('llo')
			expect(dom.text1.contentEditable).toBe('true')
			expect(dom.mark.tabIndex).toBe(0)

			// Adapter re-render: idempotent re-bind, consistency re-announced.
			setup.host.rendered()
			expect(changedSpy).toHaveBeenCalledTimes(2)
		})

		it('facade reads fail soft before mount', () => {
			const {model} = createNew({defaultValue: 'hello'})

			expect(model.current()).toEqual([])
			expect(model.boundaryFor(document.body, 0)).toBeUndefined()
			expect(model.handleAt(document.body)).toBeUndefined()
			expect(model.handle(0)).toBeUndefined()
			expect(model.placeCaret(0)).toBe(false)
		})
	})

	describe('renderTree and changed (renderer contract)', () => {
		it('text edits keep the tree reference, patch the DOM in place and fire changed once after consistency', () => {
			const {model, text2} = mountNewInline()
			const treeBefore = model.renderTree()
			const treeSpy = vi.fn()
			watch(model.renderTree, treeSpy)
			const changedSpy = vi.fn()
			let domAtEvent: string | null = null
			watch(model.changed, changeset => {
				changedSpy(changeset)
				domAtEvent = text2.textContent
			})

			model.replace({start: 9, end: 9}, '!')

			expect(text2.textContent).toBe('llo!')
			expect(domAtEvent).toBe('llo!')
			expect(model.renderTree()).toBe(treeBefore)
			expect(treeSpy).not.toHaveBeenCalled()
			expect(changedSpy).toHaveBeenCalledTimes(1)

			// Consume-once hint: a second edit patches through the windowed parse again.
			model.replace({start: 10, end: 10}, '!')
			expect(text2.textContent).toBe('llo!!')
			expect(changedSpy).toHaveBeenCalledTimes(2)
			expect(model.renderTree()).toBe(treeBefore)
		})

		it('structural edits publish a new tree and stay quiet until the adapter renders', () => {
			const {model, render} = mountNewInline()
			const treeBefore = model.renderTree()
			const changedSpy = vi.fn()
			watch(model.changed, changedSpy)

			model.replace({start: 9, end: 9}, '@[y]')

			expect(model.renderTree()).not.toBe(treeBefore)
			expect(model.renderTree().map(t => t.content)).toEqual(['he', '@[x]', 'llo', '@[y]', ''])
			expect(changedSpy).not.toHaveBeenCalled()

			const spans = render()

			expect(changedSpy).toHaveBeenCalledTimes(1)
			expect(spans[3].textContent).toBe('y')
			expect(model.handleAt(spans[3])).toBeInstanceOf(TokenHandle)
		})
	})

	describe('handles', () => {
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
			expect(model.handleAt(markText)).toBe(model.handle(model.current()[1].id!))
			// Walk-up inside a control root resolves to 'control'.
			expect(model.handleAt(inner)).toBe('control')
			expect(model.handleAt(document.createElement('div'))).toBeUndefined()
		})

		it('handle(id) resolves by token id over the bound layer', () => {
			const {model, text2} = mountNewInline()

			expect(model.handle(model.current()[2].id!)?.element()).toBe(text2)
			expect(model.handle(999999)).toBeUndefined()
			const ids = model.current().map(token => model.handle(token.id!)?.id)
			expect(ids).toEqual(model.current().map(token => token.id))
		})

		it('handle(id) bridges fresh and stale token objects by identity and rejects foreign ids', () => {
			const {model, text2} = mountNewInline()
			const stale = model.current()[2]
			const handle = model.handle(stale.id!)
			expect(handle?.element()).toBe(text2)

			// Text path: the token OBJECT is replaced while its id survives.
			model.replace({start: 9, end: 9}, '!')

			expect(model.handle(stale.id!)).toBe(handle)
			expect(handle?.token()).not.toBe(stale)
			expect(handle?.token().content).toBe('llo!')
			// Foreign id: no live node, so no handle.
			expect(model.handle(999999)).toBeUndefined()
		})

		it('handle(id) fails closed while a structural apply awaits its bind, then resolves again', () => {
			const {model, render} = mountNewInline()
			const stale = model.current()[2]
			const handle = model.handle(stale.id!)
			expect(handle).toBeInstanceOf(TokenHandle)

			model.replace({start: 9, end: 9}, '@[y]')

			// The latched window: the node layer is one generation stale — the
			// id-bridge must not hand out handles a mutation could act on.
			expect(model.handle(stale.id!)).toBeUndefined()

			render()

			expect(model.handle(stale.id!)).toBe(handle)
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
			setup.model.children(setup.model.keyOf(setup.model.current()[1]))(wrapper)
			setup.host.rendered()

			const mark = setup.model.current()[1]
			if (mark.type !== 'mark') throw new Error('expected mark')
			expect(setup.model.handle(mark.id!)?.node()?.childSequenceHost).toBe(wrapper)
			const child = setup.model.handle(mark.children[0].id!)
			expect(child?.element()).toBe(childSpan)
			expect(childSpan.textContent).toBe('ab')
			expect(setup.model.handleAt(childSpan)).toBe(child)
			expect(setup.model.handle(mark.children[0].id!)).toBe(child)
		})
	})

	describe('facade parity against the old shell', () => {
		const fixtures = [
			{name: 'inline with mark', props: INLINE_PROPS, build: () => buildInlineDom().container},
			{name: 'block layout', props: BLOCK_PROPS, build: buildBlockDom},
		] as const

		for (const {name, props, build} of fixtures) {
			it(`boundaryFor agrees with the old TokenModel over the full probe grid — ${name}`, () => {
				const oldContainer = build()
				const store = mountOld(props, oldContainer)
				const newContainer = build()
				const {model} = mountNew(props, newContainer)

				// Both shells must have reconciled their fixtures into identical DOM.
				expect(newContainer.innerHTML).toBe(oldContainer.innerHTML)

				let probed = 0
				let defined = 0
				for (const [oldNode, newNode, offset] of parallelProbes(oldContainer, newContainer)) {
					for (const affinity of ['before', 'after'] as const) {
						probed++
						const expected = store.tokens.boundaryFor(oldNode, offset, affinity)
						const actual = model.boundaryFor(newNode, offset, affinity)
						expect.soft(actual, `${oldNode.nodeName}@${offset}/${affinity}`).toBe(expected)
						if (expected !== undefined) defined++
					}
				}
				// Non-vacuous: the grid visited real boundaries and real positions.
				expect(probed).toBeGreaterThan(30)
				expect(defined).toBeGreaterThan(10)
			})
		}
	})

	describe('placement commands and selection reads', () => {
		it('placeCaret(raw) places inside the right surface; readSelection round-trips', () => {
			const {model} = mountNewInline()

			expect(model.placeCaret(1)).toBe(true)
			expect(model.selection()?.raw).toEqual({range: {start: 1, end: 1}})
			const anchor = model.selection()?.anchor
			expect(anchor?.isCollapsed).toBe(true)
			expect(model.selection()?.rect).toBeDefined()
			expect(model.selection()?.focusNode).toBe(anchor?.node)
		})

		it("handle.placeCaret targets the handle's token explicitly", () => {
			const {model} = mountNewInline()
			const token = model.current()[2] // text 'llo' [6,9]
			const handle = model.handle(token.id!)
			if (!handle) throw new Error('expected handle')
			expect(handle.placeCaret(1)).toBe(true)
			expect(model.selection()?.raw?.range.start).toBe(7)
			// A foreign token object (never reconciled) carries no id, so it has no
			// live handle — the stale reference is rejected at resolution, leaving
			// nothing to place into.
			const foreign = textToken('llo', 6)
			expect(foreign.id).toBeUndefined()
		})

		it('selectRange spans two text surfaces and the reads see the selection', () => {
			const {model, text1} = mountNewInline()

			expect(model.selectRange(0, 9)).toBe(true)
			expect(model.selection()?.raw?.range).toEqual({start: 0, end: 9})
			expect(model.selection()?.anchor.isCollapsed).toBe(false)
			expect(model.selection()?.intersects(text1)).toBe(true)
			const content = model.selectedContent()
			expect(content?.text).toContain('he')
		})
	})

	describe('editable state', () => {
		it('setEditable applies contentEditable/tabindex over bound surfaces and seeds future binds', () => {
			const {model, text1, mark, render} = mountNewInline()
			expect(text1.contentEditable).toBe('true')
			expect(mark.tabIndex).toBe(0)

			model.setEditable({editable: false, readOnly: true})

			expect(text1.contentEditable).toBe('false')
			expect(mark.hasAttribute('tabindex')).toBe(false)

			// The next structural bind applies the stored state to NEW elements.
			model.replace({start: 9, end: 9}, '@[y]')
			const spans = render()
			expect(spans[0].contentEditable).toBe('false')
			expect(spans[1].hasAttribute('tabindex')).toBe(false)
		})
	})
})