import {describe, it, expect} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import type {RowNode, TreeNode} from '../tokens'
import {mountRowDoc, mountNestedRowDoc, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * The Surface of a row's text slot, asked of the model rather than found by shape: the
 * element belongs to a token because it was consigned under that token's id, and a text
 * token's element IS its Surface.
 */
function rowSurface(store: Store, rowIndex: number): HTMLElement {
	const row = store.tokens.nodes()[rowIndex]
	if (row.kind !== 'row') throw new Error('expected a row')
	const surface = store.tokens.handle(row.children()[0].id)?.element()
	if (!surface) throw new Error('row has no consigned element')
	return surface
}

/** The row's own text node, with a live DOM Range over [start, end) on it. */
function selectInRow(store: Store, rowIndex: number, start: number, end: number): Node {
	const text = rowSurface(store, rowIndex).firstChild
	if (!text) throw new Error('row did not render a text node')
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
describe('rowKeys row identity', () => {
	it('Enter with a DOM-resolvable selection (tier 1) splits the selected row', () => {
		const {store, container} = mountRowDoc()
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
		const {store, container} = mountRowDoc()
		const second = store.tokens.nodes()[1]
		if (second.kind !== 'row') throw new Error('expected a row')
		const body = second.children()[0]
		if (body.kind !== 'text') throw new Error('expected a text child')
		// The row's own BODY end, not `selectNode(second, 'end')`: that stores `{after: row}`,
		// which is the row's span end — past its separator, and outside the body a split may
		// address. The verb refuses it now, where the old separator splice happily wrote there.
		store.tokens.selection.select({node: body, offset: 3})
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		// Kill tier 1: no live DOM Range at all, so only the model-stored anchor above can
		// resolve the row.
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n\n\n')
	})

	it('splits at the stored anchor itself, not at the end of the row holding it', () => {
		// Tier 2 is the stored ANCHOR, and it is the position rather than the row it sits in: a
		// caret stored mid-row splits there instead of appending an empty row behind it.
		const {store, container} = mountRowDoc()
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

	it('Arrow keys inside a row are left to the browser (no preventDefault)', () => {
		// One host makes cross-row caret movement NATIVE: the caret walks out of a row the
		// way it walks out of any inline element, so nothing may cancel an arrow keydown.
		// Row 0's END is where the deleted Right/Down branches fired.
		const {store, container} = mountRowDoc()
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
		const {store, container} = mountRowDoc()
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
		const {store, container} = mountRowDoc()
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
		const {store, container} = mountRowDoc()
		selectInRow(store, 0, 1, 3)

		const event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\n\nne\n\ntwo\n\n')
	})

	it('does nothing when there is no selection anywhere', () => {
		const {store, container} = mountRowDoc()
		store.tokens.selection.clear()
		window.getSelection()?.removeAllRanges()

		container.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}))

		expect(store.tokens.nodes().length).toBe(3)
	})
})

describe('rowKeys beforeinput guard', () => {
	it('drops an unhandled cancelable inputType instead of letting the browser edit the row', () => {
		// Same contract as `input.ts`: rows live in the SAME single host, so an
		// inputType the shared table cannot express would edit model-owned DOM.
		const {store, container} = mountRowDoc()
		const second = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(second, 'end')

		const event = new InputEvent('beforeinput', {inputType: 'formatBold', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('leaves an edit inside an EXPLICIT contenteditable island alone', () => {
		// The ROW half of `input.spec`'s 'leaves an unhandled type alone inside an EXPLICIT
		// contenteditable island'. The consumer's own DOM, marked as such by an attribute: the
		// model neither owns it nor resolves boundaries in it, so it must neither edit on the
		// event nor cancel it.
		//
		// MEASURED before the guards folded into one: the row arm took only the control-root half of
		// the consumer-origin test, so this event resolved a caret at the ROW's text end and
		// typed there — 'one\n\ntwo\n\n' became 'one\n\ntwox\n\n' with the event cancelled,
		// while the same edit inline was left alone.
		const {store} = mountRowDoc()
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

	it('drops insertLineBreak, which the Shift+Enter keydown owns', () => {
		// Shift+Enter answers to `handleRowEnter` now, so an `insertLineBreak` reaching the guard
		// answered to no keydown of ours and fails closed with the rest of the unexpressed. It used
		// to take the shared table's `'\n'`, which at the default separator SPLIT the row — by the
		// generic path, so with none of the row rules — and inside a row at any other separator
		// spliced a bare newline.
		const {store} = mountRowDoc()
		const text = caretInRow(store, 0, 1)

		const event = new InputEvent('beforeinput', {inputType: 'insertLineBreak', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('inserts the dropped text in the row on insertFromDrop', () => {
		const {store} = mountRowDoc()
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
		const {store} = mountRowDoc()
		const text = selectInRow(store, 0, 1, 3)

		const event = new InputEvent('beforeinput', {inputType: 'deleteByDrag', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\n\ntwo\n\n')
	})

	/**
	 * A cut whose range covers a row WHOLE takes the row: the clipboard carried the row's own
	 * projection, so leaving an empty row of that kind behind is the husk `TokenModel.replaceRows`
	 * exists to stop. Row 0's body here is the whole row — a paragraph has no opener — so the
	 * difference is one row fewer rather than one emptied.
	 */
	it('takes the whole row on a deleteByCut that covers one', () => {
		const {store} = mountRowDoc()
		const text = selectInRow(store, 0, 0, 3)

		const event = new InputEvent('beforeinput', {inputType: 'deleteByCut', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('two\n\n')
	})

	/** A range that covers no row whole is still exactly the range, which is every partial cut. */
	it('deletes only the cut range when it covers no row whole', () => {
		const {store} = mountRowDoc()
		const text = selectInRow(store, 0, 1, 3)

		const event = new InputEvent('beforeinput', {inputType: 'deleteByCut', bubbles: true, cancelable: true})
		text.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('o\n\ntwo\n\n')
	})

	it('falls back to event.data when a paste carries no dataTransfer', () => {
		// The shared table's last paste resort: engines that put the payload on `data`
		// rather than `dataTransfer`.
		const {store} = mountRowDoc()
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
		const {store} = mountRowDoc()
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
		const {store} = mountRowDoc()
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
describe('rowKeys row-boundary delete', () => {
	it('Backspace at a row start removes the separator before it', () => {
		const {store, container} = mountRowDoc()
		caretInRow(store, 1, 0)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Delete at a row content end removes the separator that row owns', () => {
		const {store, container} = mountRowDoc()
		caretInRow(store, 0, 3)

		const event = new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Delete at a row START takes the separator BEHIND it', () => {
		// The row model's own answer, not a symmetry with Backspace: Delete pressed at the start
		// of a row merges it into the previous one (`Drag.spec`'s 'Delete at start of row').
		const {store, container} = mountRowDoc()
		caretInRow(store, 1, 0)

		const event = new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('onetwo\n\n')
	})

	it('Backspace inside a row deletes one character, on the keydown', () => {
		// The ordinary case, which the row arm used to leave to the `beforeinput` that follows: with
		// one delete arm it is answered here and the default never runs.
		const {store, container} = mountRowDoc()
		caretInRow(store, 1, 2)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\nto\n\n')
	})

	it('Backspace at the first row start changes nothing, and is CONSUMED changing nothing', () => {
		// It used to be left to the browser, on the reading that a delete the model cannot express
		// is one the browser may as well answer. It may not: Chromium answers an unexpressed
		// delete with its OWN `beforeinput` carrying a RANGED target range, which outranks the
		// live caret downstream and is applied verbatim — that is how one `Delete` at the end of a
		// code fence's body swallowed the closing line and the kind with it. ADR-0006's rule holds
		// here too, and at a document edge there is nothing for the browser to have done anyway.
		const {store, container} = mountRowDoc()
		caretInRow(store, 0, 0)

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})

	it('leaves a word delete to the beforeinput that names its own range', () => {
		// The ROW half of `input.spec`'s inline pin, and it earns its own case because the row arm
		// only just started answering deletes on the KEYDOWN: without the modifier decline this
		// arm would cancel Alt+Backspace and delete ONE character, where it used to fall
		// through and the browser's ranged `deleteWordBackward` deleted the word.
		const {store, container} = mountRowDoc()
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
		// The ROW half of `input.spec`'s inline pin, and the row arm only reaches it now that both
		// layouts share one delete arm. The discriminating case: with the STORED selection
		// all-selected and no live range, `domAnchors()` declines, so without the all-selected
		// branch ahead of it this returns without cancelling and the browser mutates the host
		// behind the model's back.
		const {store, container} = mountRowDoc()
		store.tokens.selection.selectAll()
		window.getSelection()?.removeAllRanges()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		container.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(store.tokens.value()).toBe('')
	})
})

describe('rowKeys mark swallow', () => {
	it('deletes the adjacent inline mark inside a row on Backspace', () => {
		// Safe since issue 08: a row is a RowNode, never a MarkNode, so the swallow
		// can only grab an INLINE mark inside the row — never a whole row.
		const store = new Store()
		store.props.set({
			defaultValue: 'a @[m](1) b\n\nnext',
			separator: '\n\n',
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
 * A control root (drag handle, row menu button) is not a row: `SelectionDriver`
 * deliberately leaves the stored selection standing when focus lands on one
 * (`SelectionDriver.ts`'s `syncIfInEditor`), so a keypress landing on a control
 * must be judged by its EVENT TARGET, not by whatever selection happens to be
 * stored for some row elsewhere.
 */
describe('rowKeys control guard', () => {
	function mountRowWithControl(controlRow: 0 | 1) {
		const store = new Store()
		store.props.set({
			defaultValue: 'one\n\ntwo\n\n',
			separator: '\n\n',
			draggable: true,
			options: [],
		})
		const container = document.createElement('div')
		const control = document.createElement('button')
		control.setAttribute('aria-label', 'drag')
		document.body.append(container)
		store.host.container(container)
		store.tokens.control()(control)
		// Consigned by hand, the way the Row and Token components do it: the wrapper under
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
		const {store, control} = mountRowWithControl(0)
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
		const {store, control} = mountRowWithControl(0)
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
		const {store, control} = mountRowWithControl(0)
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
		const {store, control} = mountRowWithControl(1)
		const row1 = store.tokens.nodes()[1]
		store.tokens.selection.selectNode(row1, 'start')
		control.focus()

		const event = new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true, cancelable: true})
		control.dispatchEvent(event)

		expect(store.tokens.value()).toBe('one\n\ntwo\n\n')
	})
})
/**
 * THE ROW KEYMAP, one case per rule × caret position × depth. Every case is stated over a
 * document with KINDS and, where the rule is about depth, over a NESTED one: the ladder's two
 * rungs are indistinguishable on a flat paragraph document, where both answers are "insert".
 *
 * Driven through real key events on the container rather than by calling the arms, because the
 * wiring is half of what is under test — an arm that never runs, or runs after the shared delete
 * expansion, passes every direct call.
 */
describe('rowKeys the row keymap', () => {
	const BULLET: CoreOption = {markup: '- __slot__', row: {Component: 'li', continues: true, indents: true}}
	const HEADING: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}
	/** A raw CLOSED body: `hasSlot` false and a closing literal, so its interior holds separators. */
	const FENCE: CoreOption = {markup: '```__meta__\n__value__\n```', row: {Component: 'pre'}}

	const keymap = (defaultValue: string, props: Parameters<Store['props']['set']>[0] = {}) =>
		mountNestedRowDoc({defaultValue, options: [BULLET, HEADING, FENCE], Mark: () => null, ...props})

	/** Every row in pre-order — the space the verbs and the projection both speak. */
	const rowsOf = (store: Store): RowNode[] => {
		const out: RowNode[] = []
		const collect = (node: TreeNode): void => {
			if (node.kind !== 'row') return
			out.push(node)
			node.rows().forEach(collect)
		}
		store.tokens.nodes().forEach(collect)
		return out
	}

	/**
	 * A live DOM caret at `offset` of a pre-order row's own body. An EMPTY row's surface holds no
	 * `Text` node at all (`TokenHandle.writeSurface`), so the range anchors on the surface element
	 * itself — which is the shape a real caret in an empty row has.
	 */
	function caretIn(store: Store, row: number, offset: number): void {
		const body = rowsOf(store)[row].inline()[0]
		const surface = store.tokens.handle(body.id)?.element()
		if (!surface) throw new Error('row body has no consigned element')
		const range = document.createRange()
		const text = surface.firstChild
		if (text) range.setStart(text, offset)
		else range.setStart(surface, 0)
		range.collapse(true)
		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)
	}

	/**
	 * A live DOM selection ACROSS two rows' bodies — the shape the BROWSER leaves behind for a
	 * whole-row selection: Shift+ArrowDown from a row's start lands the focus at the next row's
	 * first typable position, so the range ends one boundary past the row it covers.
	 */
	function selectAcross(store: Store, from: number, at: number, to: number, until: number): void {
		const textOf = (row: number): ChildNode => {
			const surface = store.tokens.handle(rowsOf(store)[row].inline()[0].id)?.element()
			const text = surface?.firstChild
			if (!text) throw new Error('row body rendered no text node')
			return text
		}
		const range = document.createRange()
		range.setStart(textOf(from), at)
		range.setEnd(textOf(to), until)
		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)
	}

	/** The same, RANGED over `[start, end)` — the shape a Shift+Arrow leaves behind. */
	function selectIn(store: Store, row: number, start: number, end: number): void {
		const body = rowsOf(store)[row].inline()[0]
		const surface = store.tokens.handle(body.id)?.element()
		const text = surface?.firstChild
		if (!text) throw new Error('row body rendered no text node')
		const range = document.createRange()
		range.setStart(text, start)
		range.setEnd(text, end)
		const selection = window.getSelection()
		selection?.removeAllRanges()
		selection?.addRange(range)
	}

	function press(container: HTMLElement, key: string, modifiers: {shiftKey?: boolean} = {}): KeyboardEvent {
		const event = new KeyboardEvent('keydown', {key, ...modifiers, bubbles: true, cancelable: true})
		container.dispatchEvent(event)
		return event
	}

	describe('Enter', () => {
		/**
		 * THE SUGGESTIONS PROTOCOL GETS ITS OWN KEY BACK. Both listeners sit on the container and
		 * this keymap is bound at editor setup while `OverlayListModel.activate` binds when the
		 * popup mounts — later, same element, same phase — so without the check this arm ran first
		 * and split the row out from under a highlighted name: `'ping @Mi'` + ArrowDown + Enter
		 * emitted `'ping @Mi⏎'`, and there was no match left by the time the protocol ran.
		 *
		 * The negative half is the same claim's other side: with NOTHING highlighted `consumes` is
		 * false and Enter still splits, so an overlay the user has not arrowed into costs the row
		 * split nothing.
		 */
		it('leaves Enter to an open suggestion list that has a highlighted row', () => {
			const MENTION: CoreOption = {
				markup: '@[__value__](__meta__)',
				overlay: {trigger: '@', data: [{value: 'Milo Freeman', meta: 'milo.freeman'}]},
			}
			const {store, container} = keymap('ping ', {options: [BULLET, MENTION]})
			store.edit.replace(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '@Mi')
			store.overlay.list.active(0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('ping @Mi')
			store.overlay.list.select(0)
			expect(store.tokens.value()).toBe('ping @[Milo Freeman](milo.freeman)')
		})

		it('takes Enter back when the open list highlights nothing', () => {
			const SLASH: CoreOption = {overlay: {trigger: '/'}}
			const {store, container} = keymap('ping ', {options: [BULLET, SLASH]})
			store.edit.replace(store.tokens.anchorAt(5), store.tokens.anchorAt(5), '/')
			expect(store.overlay.match()?.source).toBe('/')

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('ping /\n')
		})

		it('opens another row of the SAME kind at the end of a row whose kind continues', () => {
			const {store, container} = keymap('- a')
			caretIn(store, 0, 1)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('- a\n- ')
			// The caret is INSIDE the fresh row's body, past its opener.
			expect(selectionRange(store)).toEqual({start: 6, end: 6})
		})

		it('opens a PLAIN row at the end of a row whose kind does not continue', () => {
			const {store, container} = keymap('# a')
			caretIn(store, 0, 1)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('# a\n')
		})

		it('splits mid-row and gives the tail the kind', () => {
			const {store, container} = keymap('- ab')
			caretIn(store, 0, 1)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('- a\n- b')
		})

		it('leaves an empty row above when pressed at a row start', () => {
			const {store, container} = keymap('- ab')
			caretIn(store, 0, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('- \n- ab')
		})

		it('gives up the KIND on an empty row at depth 0', () => {
			const {store, container} = keymap('- a\n- ')
			caretIn(store, 1, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('- a\n')
		})

		it('gives up the DEPTH on an empty NESTED row, before its kind', () => {
			const {store, container} = keymap('- a\n\t- ')
			expect(rowsOf(store)).toHaveLength(2)
			caretIn(store, 1, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('- a\n- ')
			expect(store.tokens.nodes()).toHaveLength(2)
		})

		/**
		 * THE LADDER IS FOR LEAVING A RUN, so a kind that declares no CONTINUATION takes no rung of
		 * it — its body is empty because the kind HAS none, not because the user emptied one.
		 *
		 * MEASURED on the showcase's divider (`'---__slot__'`), whose rule is the row's only large
		 * target: a click below the text lands the caret in that row, and Enter there un-typed the
		 * kind — `'target row⏎---'` came back `'target row⏎'` with the divider simply gone. It takes
		 * the split now, which at a row's own start opens the empty row above and keeps the kind.
		 *
		 * `HEADING` is the fixture's own non-continuing kind and stands for every one of them.
		 */
		it('SPLITS on an empty row whose kind declares no continuation, rather than un-typing it', () => {
			const {store, container} = keymap('a\n# ')
			caretIn(store, 1, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('a\n\n# ')
		})

		it('INSERTS on an empty row that has neither depth nor kind to give up', () => {
			const {store, container} = keymap('a\n')
			caretIn(store, 1, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('a\n\n')
		})

		it('replaces everything with one fresh row when all is selected, Shift or not', () => {
			// The all-selected arm sits AHEAD of the anchor read for both, so Shift+Enter answers
			// here rather than opening a continuation at the position the selection merely starts
			// at. It used to fall to the shared table's `'\n'`, which left TWO empty rows.
			for (const shiftKey of [false, true]) {
				const {store, container} = keymap('- a\n- b')
				store.tokens.selection.selectAll()

				const event = press(container, 'Enter', {shiftKey})

				expect(event.defaultPrevented).toBe(true)
				expect(store.tokens.value()).toBe('')
				expect(store.tokens.nodes()).toHaveLength(1)
			}
		})

		it('inserts a literal newline inside a RAW CLOSED body, and a row after it', async () => {
			const {store, container} = keymap('```ts\nq\n```')
			caretIn(store, 0, 1)

			press(container, 'Enter')

			// One row still, and one line longer: a fence's body already holds separators.
			expect(store.tokens.value()).toBe('```ts\nq\n\n```')
			expect(rowsOf(store)).toHaveLength(1)

			// AND THEN THE ROW AFTER IT, a microtask later, which is the caret invariant rather than
			// Enter: a raw body is the one row Enter cannot leave, so a document must not END in one
			// while the caret is inside it. Its browser gate is `caret.react.spec`'s "opens a row
			// after a raw-bodied block that ends the document".
			await Promise.resolve()

			expect(store.tokens.value()).toBe('```ts\nq\n\n```\n')
			expect(rowsOf(store)).toHaveLength(2)
		})
	})

	describe('Shift+Enter', () => {
		it('opens a CONTINUATION line as a child row', () => {
			const {store, container} = keymap('- a')
			caretIn(store, 0, 1)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n\t')
			// A CHILD of the row it was typed in, so it travels with it on a drag and copies with
			// it — the whole reason a soft break is a child rather than a sibling.
			expect(store.tokens.nodes()).toHaveLength(1)
			expect(rowsOf(store)).toHaveLength(2)
			expect(selectionRange(store)).toEqual({start: 5, end: 5})
		})

		it('carries the rest of the body into the continuation', () => {
			const {store, container} = keymap('- ab')
			caretIn(store, 0, 1)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n\tb')
			expect(store.tokens.nodes()).toHaveLength(1)
		})

		it('lands the continuation BEFORE the rows already nested under it', () => {
			const {store, container} = keymap('- a\n\t- child')
			caretIn(store, 0, 1)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n\t\n\t- child')
		})

		it('SPLITS instead on a row that can take no children', () => {
			// An EMPTY row takes none, so `childDepth` is the row's own depth and the continuation
			// is written at it. Without that reading the indent run would be written anyway and the
			// scan would hand back a sibling carrying bytes it never granted.
			const {store, container} = keymap('a\n')
			caretIn(store, 1, 0)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('a\n\n')
			expect(store.tokens.nodes()).toHaveLength(3)
		})

		it('opens the SECOND continuation beside the first, not under it', () => {
			// N soft breaks in one item are N lines at ONE level. Measured from the caret's own row
			// this built a staircase — `'- a⏎⇥one'` answered `'- a⏎⇥one⏎⇥⇥'` and every further press
			// went one deeper.
			const {store, container} = keymap('- a\n\tone')
			caretIn(store, 1, 3)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n\tone\n\t')
			// Still one root, and both lines are the bullet's own children.
			expect(store.tokens.nodes()).toHaveLength(1)
			expect(rowsOf(store)[0].rows()).toHaveLength(2)
		})

		it('opens a continuation under a ROOT paragraph, which owns its own lines', () => {
			// A root with no kind still owns its lines — they are its own, and a paragraph gets its
			// child rows as ordinary children, so the second line paints inside it. The nesting
			// test above is about a row that is ALREADY an interior line.
			const {store, container} = keymap('a')
			caretIn(store, 0, 1)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('a\n\t')
			expect(store.tokens.nodes()).toHaveLength(1)
		})

		it('opens the second continuation of a PARAGRAPH beside the first too', () => {
			const {store, container} = keymap('a\n\tone')
			caretIn(store, 1, 3)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('a\n\tone\n\t')
			expect(store.tokens.nodes()).toHaveLength(1)
		})

		it('SPLITS instead when nesting is off', () => {
			const {store, container} = keymap('- a', {indent: ''})
			caretIn(store, 0, 1)

			press(container, 'Enter', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n')
			expect(store.tokens.nodes()).toHaveLength(2)
		})
	})

	describe('Backspace at a row entry', () => {
		it('gives up the DEPTH of a nested row', () => {
			const {store, container} = keymap('- a\n\t- b')
			caretIn(store, 1, 0)

			const event = press(container, 'Backspace')

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('- a\n- b')
		})

		it('gives up the KIND at depth 0', () => {
			const {store, container} = keymap('x\n- a')
			caretIn(store, 1, 0)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('x\na')
		})

		it('MERGES once the row has neither left, through the shared delete arm', () => {
			const {store, container} = keymap('x\na')
			caretIn(store, 1, 0)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('xa')
		})

		it('deletes one character when the caret is not at the entry', () => {
			const {store, container} = keymap('- ab')
			caretIn(store, 0, 1)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('- b')
		})

		/**
		 * A RANGED Backspace deletes what is SELECTED, even though it starts at the entry — the one
		 * reading that separates the ladder's question ("is the caret at the entry?") from the
		 * delete arm's ("what is selected?"). Shift+ArrowRight from the start of a nested item and
		 * then Backspace is the whole gesture, and without the guard it outdents the row and deletes
		 * nothing: `'- a\n\t- bcd'` came back `'- a\n- bcd'`, with `bc` still there.
		 */
		it('deletes the SELECTION of a ranged Backspace that starts at a nested row entry', () => {
			const {store, container} = keymap('- a\n\t- bcd')
			selectIn(store, 1, 0, 2)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('- a\n\t- d')
		})

		it('PROMOTES the children of an empty row it un-types, which the encoding cannot avoid', () => {
			// The kind rung on an EMPTY row empties the whole line, an empty row takes no children
			// (`depthCeiling`), and the scan promotes them — declared for the verb at
			// `rowVerbs.spec`'s "promotes the children of a row it empties", and pinned here
			// because P6 is what turns it into a one-keystroke gesture. The children's bytes never
			// change; the surplus indent survives in each promoted row's lead.
			const {store, container} = keymap('- \n\t- b')
			expect(store.tokens.nodes()).toHaveLength(1)
			caretIn(store, 0, 0)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('\n\t- b')
			expect(store.tokens.nodes()).toHaveLength(2)
			expect(rowsOf(store)[1].lead()).toBe('\t')
		})

		it('answers the same on ENTER, because there is one ladder', () => {
			const {store, container} = keymap('- \n\t- b')
			caretIn(store, 0, 0)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('\n\t- b')
			expect(store.tokens.nodes()).toHaveLength(2)
		})
	})

	describe('Tab', () => {
		it('indents a row whose kind declares it', () => {
			const {store, container} = keymap('- a\n- b')
			caretIn(store, 1, 1)

			const event = press(container, 'Tab')

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('- a\n\t- b')
		})

		it('outdents on Shift+Tab', () => {
			const {store, container} = keymap('- a\n\t- b')
			caretIn(store, 1, 1)

			press(container, 'Tab', {shiftKey: true})

			expect(store.tokens.value()).toBe('- a\n- b')
		})

		it('stays in the field inside a CONTINUATION, which carries no kind of its own', () => {
			// The second line of a list item asks the item's declaration. Reading it off the
			// caret's own row let Tab eject focus from line 2 and keep it on line 1.
			const {store, container} = keymap('- a\n\tcont')
			caretIn(store, 1, 2)

			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			// Refused by the scan — the bullet above grants one level, not two — so the key is
			// consumed and the document stands.
			expect(store.tokens.value()).toBe('- a\n\tcont')

			// Shift+Tab detaches the line from its item, which is Backspace-at-entry's answer too.
			press(container, 'Tab', {shiftKey: true})
			expect(store.tokens.value()).toBe('- a\ncont')
		})

		it('consumes the key even where the depth cannot change', () => {
			// The declaration gates the KEY: a Tab that indents on one row and moves focus on the
			// next is worse than either.
			const {store, container} = keymap('- a')
			caretIn(store, 0, 1)

			const event = press(container, 'Tab', {shiftKey: true})

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('- a')
		})

		it('INDENTS A KIND THAT DECLARES NOTHING, because the declaration is the EDITOR’S', () => {
			// `RowSpec.indents` answers "does Tab belong to this field" (ADR-0002), which is a fact
			// about the FIELD. Which row may go deeper is the verb's, and the DROP asks the verb —
			// so read per kind, the keyboard refused a nesting the drag offered and performed.
			const {store, container} = keymap('- a\n# b\nplain')

			caretIn(store, 1, 1)
			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('- a\n\t# b\nplain')

			// A paragraph too: it is a row of this document like any other.
			caretIn(store, 2, 1)
			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('- a\n\t# b\n\tplain')
		})

		it('LEAVES THE FIELD in an editor where no option declares it', () => {
			// ADR-0002's accepted cost, preserved exactly where it was: a document whose kinds never
			// indent keeps Tab as the browser's focus key.
			const {store, container} = keymap('# a\nplain', {options: [HEADING]})

			caretIn(store, 0, 1)
			expect(press(container, 'Tab').defaultPrevented).toBe(false)

			caretIn(store, 1, 1)
			expect(press(container, 'Tab').defaultPrevented).toBe(false)
			expect(store.tokens.value()).toBe('# a\nplain')
		})
	})

	/**
	 * A CARVED row's pieces are Rows, so the keymap addresses them without a rule of its own: Tab
	 * walks the parent's own child list, and every other key names the row that owns the LINE,
	 * because a piece has no line to splice.
	 */
	describe('carved rows', () => {
		const CELL: CoreOption = {row: {Component: 'td'}}
		const TABLE: CoreOption = {
			markup: '|__slot__',
			row: {Component: 'tr', continues: true, split: {at: ' | ', as: CELL}},
		}
		const table = (defaultValue: string) =>
			mountNestedRowDoc({defaultValue, options: [TABLE, CELL], Mark: () => null})

		it('moves to the NEXT piece on Tab and back on Shift+Tab', () => {
			const {store, container} = table('| a | b')
			// '| a | b': the first piece's body is [1,3), the second's is [6,7).
			caretIn(store, 1, 1)

			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			expect(selectionRange(store)).toEqual({start: 6, end: 6})

			expect(press(container, 'Tab', {shiftKey: true}).defaultPrevented).toBe(true)
			expect(selectionRange(store)).toEqual({start: 1, end: 1})
			expect(store.tokens.value()).toBe('| a | b')
		})

		/**
		 * DECLARED BEHAVIOUR CHANGE: it used to leave the field at both ends, and the caret was left
		 * with no way back. A table line inserted from the row menu has ONE piece, so its first is
		 * also its last: Tab moved no caret, fell through, and the browser took focus OUT of the
		 * editor onto the next control — after which Enter could not split a row, because the editor
		 * did not have the focus to split one with. The key is consumed at the ends and the caret
		 * stays where it is, which is the rule `indents` has always had one paragraph away: the
		 * declaration gates the KEY, not the verb.
		 */
		it('CONSUMES the key at the last piece and before the first, leaving the caret alone', () => {
			const {store, container} = table('| a | b')

			// The DOM caret, because nothing writes the STORED one here — which is the claim: the
			// key is taken and no verb runs behind it.
			const caretOffset = () => window.getSelection()?.focusOffset

			caretIn(store, 2, 1)
			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			expect(caretOffset()).toBe(1)

			caretIn(store, 1, 1)
			expect(press(container, 'Tab', {shiftKey: true}).defaultPrevented).toBe(true)
			expect(caretOffset()).toBe(1)
			expect(store.tokens.value()).toBe('| a | b')
		})

		/** The one-piece line the row menu inserts, which is where the fall-through was met. */
		it('consumes the key in a line with ONE piece, which has no neighbour either way', () => {
			const {store, container} = table('| a')
			caretIn(store, 1, 1)

			expect(press(container, 'Tab').defaultPrevented).toBe(true)
			expect(press(container, 'Tab', {shiftKey: true}).defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('| a')
		})

		it('splits the LINE on Enter, so the pieces after the caret move to the new row', () => {
			const {store, container} = table('| a | bc')
			caretIn(store, 2, 1)

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('| a | b\n|c')
		})

		it('un-types the LINE on Backspace at the first piece, since that is the row entry', () => {
			const {store, container} = table('| a | b')
			caretIn(store, 1, 0)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe(' a | b')
		})

		/**
		 * A CONTINUATION LINE is a row nested under the one whose kind owns the line, and a carved
		 * row is granted no children — its own body is what its children are. Written anyway, the
		 * separator lands INSIDE the body: `'| a | b'` broken at the first piece emitted
		 * `'| ⏎a | b'`, a table line of one empty cell above a PARAGRAPH holding the rest, and the
		 * pieces after the caret left the row they were typed in. The key is consumed and does
		 * nothing, which is the answer Backspace at a piece's start already gives.
		 */
		it('REFUSES Shift+Enter in a piece, since a carved row takes no continuation', () => {
			const {store, container} = table('| a | b')
			caretIn(store, 1, 1)

			const event = press(container, 'Enter', {shiftKey: true})

			expect(event.defaultPrevented).toBe(true)
			expect(store.tokens.value()).toBe('| a | b')
		})

		/**
		 * HOME ANSWERS THE LINE, and a carved row's pieces are not lines of their own. `lineboundary`
		 * is the browser's question about BOXES and every piece is painted in one, so Home in the
		 * second column stopped at that column — a position no line of this document begins at.
		 *
		 * The Enter that follows is the whole reason it matters: at a row's own start it opens the
		 * empty row above and keeps the kind, and at a CELL's start it splits, so `'|= A | B'` came
		 * back `'|= A | ⏎| B'` — the header a column short and the column demoted to a data line, from
		 * two keys with nothing selected anywhere.
		 */
		it('takes Home to the LINE start from a piece, not to the piece start', () => {
			const {store, container} = table('| a | bc')
			caretIn(store, 2, 1)

			expect(press(container, 'Home').defaultPrevented).toBe(true)

			// '| a | bc' with a one-byte opener: the line's entry is offset 1, and the second
			// piece's own start — where the browser stopped — is 6.
			expect(selectionRange(store)).toEqual({start: 1, end: 1})

			press(container, 'Enter')

			expect(store.tokens.value()).toBe('|\n| a | bc')
		})

		/** End is the same rule at the other edge: the LINE's content ends past the last piece. */
		it('takes End to the LINE end from a piece', () => {
			const {store, container} = table('| a | bc')
			caretIn(store, 1, 1)

			expect(press(container, 'End').defaultPrevented).toBe(true)

			// Past the LAST piece, not past the one the caret was in (which ends at 3).
			expect(selectionRange(store)).toEqual({start: 8, end: 8})
		})
	})

	/**
	 * TYPING OVER A SELECTION THAT ENDS ON A BOUNDARY, which is the one gesture over a set of whole
	 * lines that stays TEXT — and the one that used to write over the raw anchors the event named.
	 * The browser ends such a selection at the NEXT LINE's entry ({@link selectAcross}), so those
	 * anchors carry structure the highlight never paints: replacing them deleted the separator AND
	 * the next line's opener. Backspace over the identical selection deleted correctly the whole
	 * time, which is what kept it invisible.
	 *
	 * ONE RULE FOR EVERY STRUCTURE, and the shapes below are the census of what can sit between two
	 * lines' content: a separator, a lead, a row opener, the `meta` inside one, and a carve
	 * delimiter. The first fix taught the ROW SELECTION one of them and the other four were still
	 * live — the two that are not row selections at all (a parent with children, a table cell) went
	 * on merging their neighbour away. See {@link contentSpan}.
	 */
	describe('typing over a selection that ends on a boundary', () => {
		const CELL: CoreOption = {row: {Component: 'td'}}
		const TABLE: CoreOption = {
			markup: '| __slot__',
			row: {Component: 'tr', continues: true, split: {at: ' | ', as: CELL}},
		}
		const TODO: CoreOption = {markup: '- [__meta__] __slot__', row: {Component: 'label'}}
		const table = (defaultValue: string) =>
			mountNestedRowDoc({defaultValue, options: [TABLE, CELL], Mark: () => null})

		const type = (container: HTMLElement, data: string): InputEvent => {
			const event = new InputEvent('beforeinput', {
				inputType: 'insertText',
				data,
				bubbles: true,
				cancelable: true,
			})
			container.dispatchEvent(event)
			return event
		}

		it('replaces the selected row and leaves the row below it whole', () => {
			const {store, container} = keymap('a\n# b\nc')
			// `[entry(a), entry(b)]` — one row covered, one boundary carried.
			selectAcross(store, 0, 0, 1, 0)

			expect(type(container, 'X').defaultPrevented).toBe(true)

			expect(store.tokens.value()).toBe('X\n# b\nc')
		})

		/**
		 * AND THE ROW TYPED IN KEEPS ITS OWN KIND, which is what separates this from the other four
		 * gestures: the rows do not leave, their text does.
		 */
		it('keeps the covered row opener, where a paste over the same selection replaces it', () => {
			const {store, container} = keymap('- a\n- b')
			selectAcross(store, 0, 0, 1, 0)

			type(container, 'X')

			expect(store.tokens.value()).toBe('- X\n- b')
		})

		/**
		 * AND THE BOUNDARY IS THE ONLY THING THE END MAY OVERSHOOT BY. A selection running from a
		 * row's entry INTO the next row's body covers the first row whole and names bytes of the
		 * second, so it is a text selection and the span stays exactly what the event said. Read as
		 * a row selection it would write over the first row alone and silently keep the `'b'` the
		 * user had selected.
		 */
		it('writes exactly the named span when the end lands inside the next row body', () => {
			const {store, container} = keymap('aa\n# bb\ncc')
			selectAcross(store, 0, 0, 1, 1)

			type(container, 'X')

			expect(store.tokens.value()).toBe('Xb\ncc')
		})

		/** The same at the other end: a selection that starts mid-row is a text selection. */
		it('writes exactly the named span when the selection covers no row whole', () => {
			const {store, container} = keymap('aa\n# b\nc')
			selectAcross(store, 0, 1, 1, 0)

			type(container, 'X')

			expect(store.tokens.value()).toBe('aXb\nc')
		})

		/**
		 * A PARENT'S BOUNDARY IS WITH ITS FIRST CHILD, and the row selection cannot see it: a
		 * parent's span covers its whole SUBTREE, so a triple-click on the parent's own line covers
		 * no row whole and `store.rows.selected()` is EMPTY. The write fell to the raw anchors and
		 * swallowed the separator, the child's indent and its opener at once — `'- A'` typed over
		 * emitted `'- ZB'` and the first child was gone with its kind. What the highlight paints is
		 * the parent's own LINE, and that is what is written.
		 */
		it('keeps the first CHILD when the selection ends at its entry', () => {
			const {store, container} = keymap('- A\n\t- B\n\t- C\n- D')
			selectAcross(store, 0, 0, 1, 0)

			expect(store.tokens.rowSelection(store.tokens.domAnchors()!)).toEqual([])
			type(container, 'Z')

			expect(store.tokens.value()).toBe('- Z\n\t- B\n\t- C\n- D')
		})

		/**
		 * AND A CARVE DELIMITER IS A BOUNDARY TOO. A cell is a Row whose structural bytes are the
		 * delimiter its kind split at, and no gesture can name one — `rowsWithin` never descends
		 * into a carved body — so this is a text selection by every reading. Its end lands at the
		 * NEXT cell's entry, and the raw write ate the `' | '` between them: the row came out one
		 * column short.
		 */
		it('keeps the delimiter when the selection ends at the next CELL', () => {
			const {store, container} = table('| aaa | bbb | ccc')
			// Pre-order rows: 0 is the line, 1..3 its cells.
			selectAcross(store, 2, 0, 3, 0)

			type(container, 'X')

			expect(store.tokens.value()).toBe('| aaa | X | ccc')
		})

		/** The LAST cell's boundary is the row's own, and the row below it stays. */
		it('keeps the row below when the selection ends past the LAST cell', () => {
			const {store, container} = table('| aaa | bbb | ccc\nafter')
			selectAcross(store, 3, 0, 4, 0)

			type(container, 'X')

			expect(store.tokens.value()).toBe('| aaa | bbb | X\nafter')
		})

		/**
		 * AND A `meta` IN THE NEXT ROW'S OPENER IS PART OF THE BOUNDARY. The row selection stands
		 * here, so this shape reached the write correctly — what it did not reach was the READ: the
		 * event's target range ends inside the consumer's own decoration for that `meta`, which is
		 * DOM no anchor can name, and the whole read failed closed. Nothing happened at all.
		 */
		it('writes over a row whose neighbour opens with a meta', () => {
			const {store, container} = keymap('a\n- [x] todo\nnext', {options: [BULLET, HEADING, FENCE, TODO]})
			selectAcross(store, 0, 0, 1, 0)

			expect(type(container, 'Z').defaultPrevented).toBe(true)

			expect(store.tokens.value()).toBe('Z\n- [x] todo\nnext')
		})
	})

	/**
	 * A ROW NO CARET MAY ENTER, which is what an ATOMIC kind is: its component is handed the row's
	 * children and paints none of them, so the row round-trips and holds no position of its own. A
	 * POINTER LANDING on it is a block selection (`TokenModel.#claimRow`), and that is reachable by
	 * the plainest gesture the page has — the showcase's properties panel is one such row and a
	 * click anywhere inside it, on a chip that has no behaviour of its own, selects the whole thing.
	 *
	 * SO THE TYPED CHARACTER IS REFUSED. It used to replace the row WHOLE: one click and one letter
	 * took `@properties … @end` off the showcase, 76 lines to 67, with nothing on the way saying so
	 * and only Mod+Z to bring it back. The keys that MEAN it still take the row — Backspace below,
	 * and a paste — which is what makes this a refusal rather than a hole.
	 */
	describe('typing over a row no caret may enter', () => {
		const CARD: CoreOption = {markup: '@card __slot__', row: {Component: 'div'}}

		const typeInto = (container: HTMLElement, data: string): InputEvent => {
			const event = new InputEvent('beforeinput', {
				inputType: 'insertText',
				data,
				bubbles: true,
				cancelable: true,
			})
			container.dispatchEvent(event)
			return event
		}

		/**
		 * {@link mountNestedRowDoc}'s paint with ONE difference: a row of the ATOMIC kind gets no
		 * surface for its own body, which is exactly what such a component does and what
		 * {@link DomModel.reachable} reads — a token the adapter never painted has no element to reach.
		 * Every OTHER kind paints its own text, which is what a fence in `extra` is here to be.
		 */
		function frozen(defaultValue: string, extra: CoreOption[] = []) {
			const store = new Store()
			store.props.set({
				defaultValue,
				separator: '\n',
				indent: '\t',
				options: [CARD, ...extra],
				Mark: () => null,
			})
			const container = document.createElement('div')
			document.body.append(container)
			store.host.container(container)
			store.tokens.nodes().forEach(node => {
				const element = document.createElement('div')
				container.append(element)
				store.tokens.consign(node.id)(element)
				store.tokens.children(node.id)(element)
				if (node.kind !== 'row' || node.option() === 0) return
				for (const child of node.inline()) {
					const surface = document.createElement('span')
					element.append(surface)
					store.tokens.consign(child.id)(surface)
				}
			})
			return {store, container}
		}

		/** The selection a pointer landing writes: the row across its own ELEMENT. */
		const selectRowElement = (store: Store, index: number): void => {
			const row = rowsOf(store)[index]
			store.tokens.selection.select({before: row}, {after: row})
		}

		it('CONSUMES the key and leaves the row standing', () => {
			const {store, container} = frozen('before\n@card panel\nafter')
			selectRowElement(store, 1)
			expect(store.rows.selected()).toHaveLength(1)

			expect(typeInto(container, 'a').defaultPrevented).toBe(true)

			expect(store.tokens.value()).toBe('before\n@card panel\nafter')
			container.remove()
		})

		it('still lets Backspace take the row, which is the gesture that says so', () => {
			const {store, container} = frozen('before\n@card panel\nafter')
			selectRowElement(store, 1)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('before\nafter')
			container.remove()
		})

		/**
		 * AND THE ROWS THE WRITE ACQUIRES ON THE WAY, which is the shape the refusal missed while it
		 * was asked of the pair the EVENT named. A sweep from a plain row into a fence's interior
		 * holds no row whole by that pair — it is an ordinary text selection, `rows.selected` empty —
		 * but `TokenModel.#offBlockInterior` pulls the far edge back to the fence's own boundary,
		 * because an edge inside a raw body from outside the row names the ROW, and the span left
		 * over covers every row between, the frozen one included.
		 *
		 * Measured before the refusal moved onto that span: one `'Z'` emitted `'Z⏎```js⏎code⏎```'` —
		 * the frozen row deleted by a typed character, which is the whole of what this describe
		 * refuses.
		 */
		const FENCE: CoreOption = {markup: '```__meta__\n__value__\n```', row: {Component: 'pre'}}
		const SWEPT = 'aa\n@card panel\n```js\ncode\n```'

		/** From `aa`'s start into the middle of `code`, which is the fence's own body. */
		const sweepIntoFence = (store: Store): void => {
			store.tokens.selection.select(store.tokens.anchorAt(0), store.tokens.anchorAt(23))
		}

		it('refuses a sweep whose RESOLVED span acquires a frozen row the raw pair never held', () => {
			const {store, container} = frozen(SWEPT, [FENCE])
			sweepIntoFence(store)
			expect(store.rows.selected()).toHaveLength(0)

			expect(typeInto(container, 'Z').defaultPrevented).toBe(true)

			expect(store.tokens.value()).toBe(SWEPT)
			container.remove()
		})

		/** And Backspace over that same sweep still takes those rows, with the fence left whole. */
		it('still lets Backspace take the swept rows and leaves the fence standing', () => {
			const {store, container} = frozen(SWEPT, [FENCE])
			sweepIntoFence(store)

			press(container, 'Backspace')

			expect(store.tokens.value()).toBe('\n```js\ncode\n```')
			container.remove()
		})

		/** And a row the caret CAN enter is still typed over, text-first, keeping its kind. */
		it('replaces the TEXT of a selected row that holds an editable position', () => {
			const {store, container} = mountNestedRowDoc({
				defaultValue: 'before\n@card panel\nafter',
				separator: '\n',
				options: [CARD],
				Mark: () => null,
			})
			selectRowElement(store, 1)

			expect(typeInto(container, 'a').defaultPrevented).toBe(true)

			expect(store.tokens.value()).toBe('before\n@card a\nafter')
			container.remove()
		})
	})
})