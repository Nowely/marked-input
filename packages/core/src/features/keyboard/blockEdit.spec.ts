import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import {mountBlock} from '../tokens/__testing__/mountFixtures'

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

/** The row's own text node, with a live DOM Range over [start, end) on it. */
function selectInRow(store: Store, rowIndex: number, start: number, end: number): Node {
	const text = rowSurface(store, rowIndex).firstChild
	if (!text) throw new Error('block row did not render a text node')
	const selection = window.getSelection()
	if (!selection) throw new Error('no window selection')
	const range = document.createRange()
	range.setStart(text, start)
	range.setEnd(text, end)
	selection.removeAllRanges()
	selection.addRange(range)
	return text
}

/** The row's own text node, with a collapsed DOM caret on it. */
function caretInRow(store: Store, rowIndex: number, offset: number): Node {
	return selectInRow(store, rowIndex, offset, offset)
}

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

	it('splits at the stored anchor itself, not at the end of the row holding it', () => {
		// Tier 2 is the stored ANCHOR now, where it used to be the row that anchor named and a
		// literal `{after: row}` — the row's end, PAST its own separator. The two agree only
		// when the stored anchor already is a row edge, which is what the case above stores;
		// a caret stored mid-row splits there instead of appending an empty row behind it.
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		if (second.kind !== 'row') throw new Error('expected a row')
		const text = second.children()[0]
		if (text.kind !== 'text') throw new Error('expected a text child')
		store.tokens.selection.select({node: text, offset: 1})
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\nt\n\nwo\n\n')
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

	it('splits at the LOW end of a ranged selection and keeps what was selected', () => {
		// Enter is NOT the shared table's replace-the-range: it splices the separator at the
		// low end, so 'one' selected [1,3) becomes 'o' + a fresh row holding 'ne'. Pinned
		// because nothing else in the repo covers Enter over a non-empty selection.
		const {store, container} = mountBlock()
		selectInRow(store, 0, 1, 3)

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\n\nne\n\ntwo\n\n')
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
		// Same contract as `input.ts`: block rows live in the SAME single host, so an
		// inputType the shared table cannot express would edit model-owned DOM.
		const {store, container} = mountBlock()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')

		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('leaves an edit inside an EXPLICIT contenteditable island alone', () => {
		// The block half of `input.spec`'s 'leaves an unhandled type alone inside an EXPLICIT
		// contenteditable island'. The consumer's own DOM, marked as such by an attribute: the
		// model neither owns it nor resolves boundaries in it, so it must neither edit on the
		// event nor cancel it.
		//
		// MEASURED before the guards folded into one: block took only the control-root half of
		// the consumer-origin test, so this event resolved a caret at the ROW's text end and
		// typed there — 'one\n\ntwo\n\n' became 'one\n\ntwox\n\n' with the event cancelled,
		// while the same edit inline was left alone.
		const {store} = mountBlock()
		const island = document.createElement('span')
		island.setAttribute('contenteditable', 'true')
		island.textContent = 'inner'
		rowSurface(store, 1).append(island)
		const islandText = island.firstChild
		if (!(islandText instanceof Text)) throw new Error('island did not render a text node')
		const range = document.createRange()
		range.setStart(islandText, 0)
		range.setEnd(islandText, 0)
		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)

		const event = new InputEvent('beforeinput', {
			inputType: 'insertText',
			data: 'x',
			bubbles: true,
			cancelable: true,
		})
		Object.defineProperty(event, 'getTargetRanges', {value: () => [new StaticRange(range)]})
		islandText.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('inserts a newline INSIDE the row on insertLineBreak (Shift+Enter)', () => {
		// Parity with the inline guard: without its own case the closed default would drop
		// Shift+Enter silently. Plain Enter never arrives — `handleRowEnter` cancels the keydown.
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

	it('deletes the dragged-out source range on deleteByDrag', () => {
		// The SOURCE half of a drag: the browser pairs insertFromDrop at the target with
		// deleteByDrag at the origin. Without an expressed '' deletion the dragged text
		// survives where it came from, so a drag out of a row duplicates it.
		const {store} = mountBlock()
		const text = selectInRow(store, 0, 1, 3)

		const event = new InputEvent('beforeinput', {inputType: 'deleteByDrag', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\n\ntwo\n\n')
	})

	it('deletes the cut range on deleteByCut', () => {
		const {store} = mountBlock()
		const text = selectInRow(store, 0, 0, 3)

		const event = new InputEvent('beforeinput', {inputType: 'deleteByCut', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('\n\ntwo\n\n')
	})

	it('falls back to event.data when a paste carries no dataTransfer', () => {
		// The shared table's last paste resort: engines that put the payload on `data`
		// rather than `dataTransfer`.
		const {store} = mountBlock()
		const text = caretInRow(store, 0, 1)

		const event = new InputEvent('beforeinput', {
			inputType: 'insertFromPaste',
			data: 'X',
			bubbles: true,
			cancelable: true,
		})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('oXne\n\ntwo\n\n')
	})

	it('drops insertParagraph even with a resolvable row instead of taking the inline mapping', () => {
		// The one divergence from the shared table: Enter belongs to `handleRowEnter`'s keydown,
		// which inserts the SEPARATOR — the table's '\n' would splice a literal newline
		// inside the row. Unreachable from a real Enter (the keydown is cancelled first);
		// pinned so the divergence survives the table.
		const {store} = mountBlock()
		const text = caretInRow(store, 0, 1)

		const event = new InputEvent('beforeinput', {inputType: 'insertParagraph', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('drops an edit that resolves NO caret instead of letting the browser split the host', () => {
		// Neither authority answers (no DOM range, no stored selection), yet the event still
		// targets model-owned DOM: `handleRowEnter` bails on the same missing caret, so this
		// guard is the last one standing.
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
 * The row merge, resolved through anchors: a collapsed delete on a row boundary expands onto
 * the whole SEPARATOR (`anchorsForDelete`), and removing that span is the merge. The fixture is
 * 'one\n\ntwo\n\n' — row 0 [0,5), row 1 [5,10), the empty document-final row [10,10].
 */
describe('blockEdit row-boundary delete', () => {
	it('Backspace at a row start removes the separator before it', () => {
		const {store, container} = mountBlock()
		caretInRow(store, 1, 0)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Delete at a row content end removes the separator that row owns', () => {
		const {store, container} = mountBlock()
		caretInRow(store, 0, 3)

		const event = new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Delete at a row START takes the separator BEHIND it', () => {
		// Block layout's own answer, not a symmetry with Backspace: Delete pressed at the start
		// of a row merges it into the previous one (`Drag.spec`'s 'Delete at start of row').
		const {store, container} = mountBlock()
		caretInRow(store, 1, 0)

		const event = new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Backspace inside a row deletes one character, on the keydown', () => {
		// The ordinary case, which block used to leave to the `beforeinput` that follows: with
		// one delete arm it is answered here and the default never runs.
		const {store, container} = mountBlock()
		caretInRow(store, 1, 2)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\nto\n\n')
	})

	it('Backspace at the first row start is left to the browser', () => {
		const {store, container} = mountBlock()
		caretInRow(store, 0, 0)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('leaves a word delete to the beforeinput that names its own range', () => {
		// The block half of `input.spec`'s inline pin, and it earns its own case because block
		// only just started answering deletes on the KEYDOWN: without the modifier decline this
		// arm would cancel Alt+Backspace and delete ONE character, where it used to fall
		// through and the browser's ranged `deleteWordBackward` deleted the word.
		const {store, container} = mountBlock()
		caretInRow(store, 0, 3)

		const event = new KeyboardEvent('keydown', {
			key: 'Backspace',
			altKey: true,
			bubbles: true,
			cancelable: true,
		})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('clears the whole value even when the DOM selection is gone', () => {
		// The block half of `input.spec`'s inline pin, and block only reaches it now that both
		// layouts share one delete arm. The discriminating case: with the STORED selection
		// all-selected and no live range, `domAnchors()` declines, so without the all-selected
		// branch ahead of it this returns without cancelling and the browser mutates the host
		// behind the model's back.
		const {store, container} = mountBlock()
		store.tokens.selection.selectAll()
		window.getSelection()?.removeAllRanges()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
	})
})

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

/**
 * A control root (drag handle, block menu button) is not a row: `SelectionDriver`
 * deliberately leaves the stored selection standing when focus lands on one
 * (`SelectionDriver.ts`'s `syncIfInEditor`), so a keypress landing on a control
 * must be judged by its EVENT TARGET, not by whatever selection happens to be
 * stored for some row elsewhere.
 */
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
		// closed: the consumer's own control owns its input, and the model owns none of that DOM.
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