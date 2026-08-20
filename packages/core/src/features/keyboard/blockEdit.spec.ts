import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import {mountBlock} from '../tokens/__testing__/mountFixtures'

/**
 * Row identity comes from the selection (DOM-resolved or stored), not
 * document.activeElement. Under one host activeElement is always the
 * container; these pin the topology-independent path.
 */
describe('blockEdit row identity', () => {
	it('Enter with a DOM-resolvable selection (tier 1) splits the selected row', () => {
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')
		// Applying the stored anchor focuses the EDITING HOST — the container, since no row
		// carries a tabindex any more. Blur it so activeElement sits on <body> while the
		// underlying DOM Range stays put, live for domAnchors() to read: row identity has
		// no focus tier left to fall back on.
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n\n\n')
	})

	it('Enter with only a stored selection (tier 2) splits the selected row', () => {
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		// Kill tier 1: no live DOM Range at all, so only the model-stored anchor
		// `selectNode` wrote above can resolve the row.
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n\n\n')
	})

	it('Arrow keys in block mode are left to the browser (no preventDefault)', () => {
		// One host makes cross-row caret movement NATIVE: the caret walks out of a row the
		// way it walks out of any inline element, so nothing may cancel an arrow keydown.
		// Row 0's END is where the deleted Right/Down branches fired.
		const {store, container} = mountBlock()
		const first = store.tokens.nodes()[0]
		store.tokens.selection.selectNode(first, 'end')

		for (const key of ['ArrowRight', 'ArrowDown']) {
			const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})
			container.dispatchEvent(event)
			expect(event.defaultPrevented).toBe(false)
		}
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('Arrow keys at a row START are left to the browser too', () => {
		// The mirror: the deleted Left/Up branches fired at offset 0 of a row with a
		// predecessor, which the case above never reaches.
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'start')

		for (const key of ['ArrowLeft', 'ArrowUp']) {
			const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})
			container.dispatchEvent(event)
			expect(event.defaultPrevented).toBe(false)
		}
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('select-all + Enter replaces everything with one fresh row', () => {
		const {store, container} = mountBlock()
		store.tokens.selection.selectAll()

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		// An empty document IS one empty row (issue 08's trailing convention).
		expect(store.tokens.value()).toBe('')
		expect(store.tokens.nodes()).toHaveLength(1)

		// The caret is INSIDE the fresh row, not merely at document offset 0: the anchor
		// names the row's own text child.
		const row = store.tokens.nodes()[0]
		if (row.kind !== 'row') throw new Error('expected a row')
		const slot = row.children()[0]
		const anchor = store.tokens.selection.anchors()?.anchor
		if (!anchor || typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a node anchor')
		expect(anchor.node).toBe(slot)
		expect(anchor.offset).toBe(0)
		expect(slot.kind).toBe('text')
	})

	it('does nothing when there is no selection anywhere', () => {
		const {store, container} = mountBlock()
		store.tokens.selection.clear()
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.nodes().length).toBe(3)
	})
})

describe('blockEdit beforeinput guard', () => {
	it('drops an unhandled cancelable inputType instead of letting the browser edit the row', () => {
		// Same contract as `input.ts`: block rows live in the SAME single host, so a
		// default this switch cannot express would edit model-owned DOM.
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')

		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	/**
	 * The Surface of a row's text slot, asked of the model rather than found by shape: the
	 * element belongs to a token because it was consigned under that token's id, and a text
	 * token's element IS its Surface.
	 */
	function rowSurface(store: Store, rowIndex: number): HTMLElement {
		const row = store.tokens.nodes()[rowIndex]
		if (row.kind !== 'row') throw new Error('expected a row')
		const surface = store.tokens.handle(row.children()[0].id)?.element()
		if (!surface) throw new Error('block row has no consigned element')
		return surface
	}

	/** The row's own text node, with a collapsed DOM caret on it. */
	function caretInRow(store: Store, rowIndex: number, offset: number): Node {
		const text = rowSurface(store, rowIndex).firstChild
		if (!text) throw new Error('block row did not render a text node')
		const selection = window.getSelection()
		if (!selection) throw new Error('no window selection')
		const range = document.createRange()
		range.setStart(text, offset)
		range.setEnd(text, offset)
		selection.removeAllRanges()
		selection.addRange(range)
		return text
	}

	it('inserts a newline INSIDE the row on insertLineBreak (Shift+Enter)', () => {
		// Parity with the inline guard: without its own case the closed default would drop
		// Shift+Enter silently. Plain Enter never arrives — `handleEnter` cancels the keydown.
		const {store} = mountBlock()
		const text = caretInRow(store, 0, 1)

		const event = new InputEvent('beforeinput', {inputType: 'insertLineBreak', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\nne\n\ntwo\n\n')
	})

	it('inserts the dropped text in the row on insertFromDrop', () => {
		const {store} = mountBlock()
		const text = caretInRow(store, 0, 1)
		const dataTransfer = new DataTransfer()
		dataTransfer.setData('text/plain', 'X')

		const event = new InputEvent('beforeinput', {
			inputType: 'insertFromDrop',
			dataTransfer,
			bubbles: true,
			cancelable: true,
		})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('oXne\n\ntwo\n\n')
	})

	it('drops an edit that resolves NO row instead of letting the browser split the host', () => {
		// The row is unresolvable from both tiers (no DOM range, no stored selection), yet
		// the event still targets model-owned DOM: `handleEnter` bails
		// on the same missing row and `input.ts` returned on `isBlock`, so this guard is
		// the last one standing.
		const {store} = mountBlock()
		const rowText = rowSurface(store, 0)
		store.tokens.selection.clear()
		window.getSelection()?.removeAllRanges()
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()

		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})
		rowText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})
})

/**
 * A control root (drag handle, block menu button) is not a row: `SelectionDriver`
 * deliberately leaves the stored selection standing when focus lands on one
 * (`SelectionDriver.ts`'s `syncIfInEditor`), so a keypress landing on a control
 * must be judged by its EVENT TARGET, not by whatever selection happens to be
 * stored for some row elsewhere.
 */
describe('blockEdit mark swallow', () => {
	it('deletes the adjacent inline mark inside a row on Backspace', () => {
		// Safe since issue 08: a block row is a RowNode, never a MarkNode, so the swallow
		// can only grab an INLINE mark inside the row — never a whole row.
		const store = new Store()
		store.props.set({
			defaultValue: 'a @[m](1) b\n\nnext',
			layout: 'block',
			Mark: () => null,
			options: [{markup: '@[__value__](__meta__)'}],
		})
		const container = document.createElement('div')
		document.body.append(container)
		store.host.container(container)

		const row = store.tokens.nodes()[0]
		if (row.kind !== 'row') throw new Error('expected a row')
		const rowElement = document.createElement('div')
		container.append(rowElement)
		store.tokens.consign(row.id)(rowElement)
		const surfaces = row.children().map(child => {
			const surface = document.createElement('span')
			rowElement.append(surface)
			store.tokens.consign(child.id)(surface)
			return surface
		})

		// A real DOM caret at the start of the text AFTER the mark — the beforeinput
		// resolver reads the live selection, not the stored one.
		const afterMarkText = surfaces[2].firstChild
		if (!afterMarkText) throw new Error('expected the surface after the mark to render text')
		window.getSelection()?.collapse(afterMarkText, 0)

		const event = new InputEvent('beforeinput', {
			inputType: 'deleteContentBackward',
			bubbles: true,
			cancelable: true,
		})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('a  b\n\nnext')
	})
})

describe('blockEdit control guard', () => {
	function mountBlockWithControl(controlRow: 0 | 1) {
		const store = new Store()
		store.props.set({
			defaultValue: 'one\n\ntwo\n\n',
			layout: 'block',
			draggable: true,
			options: [],
		})
		const container = document.createElement('div')
		const control = document.createElement('button')
		control.setAttribute('aria-label', 'drag')
		document.body.append(container)
		store.host.container(container)
		store.tokens.control()(control)
		// Consigned by hand, the way the Block and Token components do it: the wrapper under
		// `consign(row.id)` — the wrapper IS the row's element now — and each row text child
		// under its own id. The positional helper cannot serve here — the control sits where
		// a row's first child element would be, so pairing by index would misfile it.
		store.tokens.nodes().forEach((node, i) => {
			const row = document.createElement('div')
			if (i === controlRow) row.append(control)
			const surface = document.createElement('span')
			row.append(surface)
			container.append(row)
			store.tokens.consign(node.id)(row)
			if (node.kind === 'row') store.tokens.consign(node.children()[0].id)(surface)
		})
		return {store, container, control}
	}

	it('ignores Enter targeting a control even with a row selection stored', () => {
		const {store, control} = mountBlockWithControl(0)
		const row0 = store.tokens.nodes()[0]
		store.tokens.selection.selectNode(row0, 'end')
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.nodes().length).toBe(3)
	})

	it('ignores Enter targeting a control even with everything selected', () => {
		// The all-selected arm replaces the whole document, so it must sit BEHIND the
		// control verdict — same precedence `input.ts` gives `isConsumerOrigin`.
		const {store, control} = mountBlockWithControl(0)
		store.tokens.selection.selectAll()
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('leaves a control root its own beforeinput even with a row selection stored', () => {
		// The one verdict that still passes through after the guard started failing
		// closed: consumer chrome owns its input, and the model owns none of that DOM.
		const {store, control} = mountBlockWithControl(0)
		const row0 = store.tokens.nodes()[0]
		store.tokens.selection.selectNode(row0, 'end')

		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'x',
			bubbles: true,
			cancelable: true,
		})
		control.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('ignores Backspace targeting a control even with a row selection stored', () => {
		const {store, control} = mountBlockWithControl(1)
		const row1 = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(row1, 'start')
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})
})