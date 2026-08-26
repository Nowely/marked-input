import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import type {Store} from '../../store/Store'
import type {RowNode, TreeNode} from '../tokens'
import {mountNestedBlock, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * CHARACTERIZATION, not specification. Every expectation below is the value the editor emits
 * TODAY, and every one of them is wrong; each test names the answer it should give instead.
 *
 * They exist because the seam they cover had no oracle at any level. What a span MEANS when it
 * covers whole rows is decided in four places — `rowSpan()` and `sliceNodes()` in the tree,
 * `replacementForInput` on the paste path, and `handleRowIndent` in the keymap — and `map.md:587`
 * already records the first two disagreeing. An edit there could make the disagreement worse or
 * fix one defect and re-open another, and every suite in the repo stayed green either way. There
 * was also no multi-row paste test anywhere: `Clipboard.spec.ts`'s twenty-four cases are all
 * inline-mark.
 *
 * So these are not a wish list. They turn "fixed it" into a visible diff: closing any of the six
 * REDDENS the test named for it, and the person closing it rewrites that expectation to the wanted
 * value written in its own docstring. A green run here means nothing has moved, not that the
 * behaviour is right.
 *
 * All six are the confirmed-and-not-taken list from the 2026-08-26 hardening pass
 * (`docs/scratch/notion-like/map.md`, the Fog section). The readings were re-measured here rather
 * than copied.
 */

const BULLET: CoreOption = {markup: '- __slot__', row: {Component: 'li', continues: true, indents: true}}
const HEADING: CoreOption = {markup: '## __slot__', row: {Component: 'h2'}}
/** The cell kind a carve targets — an option with no markup of its own, as a table's cells are. */
const CELL: CoreOption = {markup: undefined, row: {Component: 'span'}}
const TABLE: CoreOption = {markup: '| __slot__', row: {Component: 'div', split: {at: ' | ', as: CELL}}}

const mount = (value: string) =>
	mountNestedBlock({defaultValue: value, options: [BULLET, HEADING, TABLE, CELL], Mark: () => null})

/** Every row in pre-order — the space the verbs and the projection both speak. */
function rowsOf(store: Store): RowNode[] {
	const out: RowNode[] = []
	const collect = (node: TreeNode): void => {
		if (node.kind !== 'row') return
		out.push(node)
		node.rows().forEach(collect)
	}
	store.tokens.nodes().forEach(collect)
	return out
}

/** A live DOM caret at `offset` of a pre-order row's own body, and the Range it left behind. */
function caretIn(store: Store, row: number, offset: number): Range {
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
	return range
}

function press(container: HTMLElement, key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...modifiers})
	container.dispatchEvent(event)
	return event
}

/** A real paste: the text arrives on the event's own `dataTransfer`, which is where the path reads it. */
function paste(container: HTMLElement, range: Range, text: string): void {
	const dataTransfer = new DataTransfer()
	dataTransfer.setData('text/plain', text)
	const event = new InputEvent('beforeinput', {
		inputType: 'insertFromPaste',
		bubbles: true,
		cancelable: true,
		dataTransfer,
	})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [range]})
	container.dispatchEvent(event)
}

/** The live DOM selection as a Range — what a paste over a standing row selection targets. */
function liveRange(): Range {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) throw new Error('no live selection')
	return selection.getRangeAt(0)
}

describe('a `\\n` inside PASTED text is spliced raw', () => {
	/**
	 * WANTED: the paste takes Enter's row rules, so the second line becomes a row and the cells
	 * either side of the caret stay cells. The editor's own Enter from this caret gives
	 * `'| a\n|  | b\nafter'` and keeps every cell in the table.
	 */
	it('destroys the carve when a two-line clip is pasted into a table cell', () => {
		const {store, container} = mount('| a | b\nafter')
		const range = caretIn(store, 1, 1)

		paste(container, range, 'one\ntwo')

		expect(store.tokens.value()).toBe('| aone\ntwo | b\nafter')
		// One body cell where there were two: the separator inside the clip ended the table line.
		expect(rowsOf(store)[0].rows()).toHaveLength(1)
	})

	/**
	 * WANTED: the line the paste opens keeps the caret row's depth, the way `continuationDepth`
	 * does for Enter — `'- parent\n\t- childone\n\ttwo\n- after'`.
	 */
	it('drops a pasted line to depth 0 out of a nested row', () => {
		const {store, container} = mount('- parent\n\t- child\n- after')
		const range = caretIn(store, 1, 5)

		paste(container, range, 'one\ntwo')

		expect(store.tokens.value()).toBe('- parent\n\t- childone\ntwo\n- after')
	})
})

describe('a row selection covers the body and projects the opener', () => {
	/**
	 * `rowSpan()` starts at `entryAnchor(row)` — past the opener — while `sliceNodes()` re-annotates
	 * the same span back to `'- target'`. So replacing a selected row never replaces its KIND: the
	 * old opener is left standing and the clip lands inside it.
	 *
	 * WANTED: the same clip pasted over a selected row REPLACES it, which is the answer the editor
	 * already gives for the same clip into an empty row — `'- one\n- two\ntail'`.
	 */
	it('leaves the selected row’s opener in front of what replaced it', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		expect(store.block.selected()).toHaveLength(1)

		paste(container, liveRange(), '- one\n- two')

		expect(store.tokens.value()).toBe('- - one\n- two\ntail')
	})

	/**
	 * The same span, through the KEYMAP rather than the clipboard — which is how it is known to be
	 * the span's defect and not the paste path's. Both leave the identical husk.
	 *
	 * WANTED: `'- gamma'`. The selection covers three whole rows and Backspace deletes rows, not
	 * bodies.
	 */
	it('leaves the first row’s opener as an empty row of that kind on a delete', () => {
		const {store, container} = mount('## Head\n- alpha\n- beta\n- gamma')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		press(container, 'ArrowDown', {shiftKey: true})
		press(container, 'ArrowDown', {shiftKey: true})
		expect(store.block.selected()).toHaveLength(3)

		press(container, 'Backspace')

		expect(store.tokens.value()).toBe('## \n- gamma')
	})
})

describe('the set verbs do not see the set', () => {
	/**
	 * `handleRowEnter`'s declared rule is "splices at the LOW end and KEEPS what was selected", and
	 * over a TEXT range it does. Over a ROW selection the anchors slide UNDER the insert: the empty
	 * row opens above the selection and the caret comes to rest at the start of the row below it,
	 * so the next character is typed into the row the user had selected rather than into the row
	 * Enter opened.
	 *
	 * WANTED: Enter over a row selection replaces the selected rows, the way it replaces an
	 * all-selected document with one fresh row.
	 */
	it('slides the caret off the row an Enter over a row selection opened', () => {
		const {store, container} = mount('- alpha\n- beta\n- gamma')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		expect(store.block.selected()).toHaveLength(1)

		press(container, 'Enter')

		expect(store.tokens.value()).toBe('- alpha\n- \n- beta\n- gamma')
		// Offset 13 is the start of `beta`'s body, not of the empty row Enter opened (offset 10).
		expect(selectionRange(store)).toEqual({start: 13, end: 13})
		const anchors = store.tokens.selection.anchors()
		if (anchors) store.edit.replace(anchors.anchor, anchors.head, 'X')
		expect(store.tokens.value()).toBe('- alpha\n- \n- Xbeta\n- gamma')
	})

	/**
	 * TAB MOVES THE ROWS THE SELECTION COVERS, which is the set every other row gesture already
	 * acts on. It used to read the caret's row alone (`store.tokens.rowOf(at)`), so the second
	 * selected row stayed where it was and the selection came apart.
	 */
	it('indents every row of a standing row selection, in one splice', () => {
		const {store, container} = mount('- alpha\n- beta\n- gamma')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		press(container, 'ArrowDown', {shiftKey: true})
		const selected = store.block.selected()
		expect(selected).toHaveLength(2)

		press(container, 'Tab')

		expect(store.tokens.value()).toBe('- alpha\n\t- beta\n\t- gamma')
		// The same two rows, still selected: a re-indent moves no position and keeps every id.
		expect(store.block.selected()).toEqual(selected)
	})

	/** Shift+Tab is the same verb with the step reversed, and the same set answers it. */
	it('outdents every row of a standing row selection', () => {
		const {store, container} = mount('- alpha\n\t- beta\n\t- gamma')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		press(container, 'ArrowDown', {shiftKey: true})
		expect(store.block.selected()).toHaveLength(2)

		press(container, 'Tab', {shiftKey: true})

		expect(store.tokens.value()).toBe('- alpha\n- beta\n- gamma')
	})
})