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

describe('a row selection is the rows, opener and all', () => {
	/**
	 * ONE READING for the four gestures. `rowSpan()` starts a row at `entryAnchor(row)` — past the
	 * opener, because those bytes are structural and no anchor can name them — while `sliceNodes()`
	 * PROJECTS the same span with the opener put back, so a copy of this selection carries
	 * `'- target'`. Replacing the span between the anchors therefore left the old opener standing in
	 * front of whatever landed. `TokenModel.replaceRows` writes over the row's LINE instead, which is
	 * the same bytes the clipboard carried — and the same answer the editor already gave for this
	 * clip pasted into an EMPTY row.
	 */
	it('replaces the selected row with the clip, opener and all', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		expect(store.block.selected()).toHaveLength(1)

		paste(container, liveRange(), '- one\n- two')

		expect(store.tokens.value()).toBe('- one\n- two\ntail')
	})

	/**
	 * The same span through the KEYMAP rather than the clipboard, which is how it is known to be the
	 * span's rule and not the paste path's. A DELETE takes the boundary with the rows, so the row
	 * count actually shrinks — leaving it behind is what turned the head row into the husk `'## '`.
	 */
	it('deletes the rows a selection covers, not their bodies', () => {
		const {store, container} = mount('## Head\n- alpha\n- beta\n- gamma')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		press(container, 'ArrowDown', {shiftKey: true})
		press(container, 'ArrowDown', {shiftKey: true})
		expect(store.block.selected()).toHaveLength(3)

		press(container, 'Backspace')

		expect(store.tokens.value()).toBe('- gamma')
	})

	/**
	 * A selection that covers no row WHOLE is still exactly the span between its anchors: the rule
	 * is about the rows a selection holds, not about how much text it happens to cover.
	 */
	it('deletes the span itself when the selection covers no row whole', () => {
		const {store} = mount('- alpha\n- beta')
		const [from, to] = [store.tokens.anchorAt(4), store.tokens.anchorAt(12)]
		store.tokens.selection.select(from, to)
		expect(store.block.selected()).toHaveLength(0)

		store.edit.replace(from, to, '')

		expect(store.tokens.value()).toBe('- alta')
	})
})

describe('the set verbs do not see the set', () => {
	/**
	 * ENTER ACTS ON THE SELECTION: whole rows are what the user named, so it opens ONE fresh row in
	 * their place — the answer it already gives for an all-selected document, at row granularity.
	 * Splicing at the selection's low end instead slid the anchors UNDER the inserted separator and
	 * came to rest at the start of the row below, so the next character typed deleted the row that
	 * had been selected.
	 */
	it('replaces a row selection with one fresh row, and keeps the caret in it', () => {
		const {store, container} = mount('- alpha\n- beta\n- gamma')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		expect(store.block.selected()).toHaveLength(1)

		press(container, 'Enter')

		expect(store.tokens.value()).toBe('- alpha\n\n- gamma')
		// Offset 8 is the fresh row's own body, which is where the next character goes.
		expect(selectionRange(store)).toEqual({start: 8, end: 8})
		const anchors = store.tokens.selection.anchors()
		if (anchors) store.edit.replace(anchors.anchor, anchors.head, 'X')
		expect(store.tokens.value()).toBe('- alpha\nX\n- gamma')
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