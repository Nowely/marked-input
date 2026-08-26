import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import type {Store} from '../../store/Store'
import {MARKPUT_MIME} from '../clipboard/pasteMarkup'
import type {RowNode, TreeNode} from '../tokens'
import {mountNestedBlock, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * THE SEAM A SPAN CROSSES WHEN IT COVERS WHOLE ROWS, which had no oracle at any level and was
 * decided in four places that disagreed: `rowSpan()` and `sliceNodes()` in the tree, the paste
 * path's replacement, and `handleRowIndent` in the keymap. This file was written as a
 * CHARACTERIZATION of six confirmed defects (`docs/scratch/notion-like/map.md`, the Fog section)
 * so that closing any of them would redden the case named for it; every one of them is closed here
 * and every expectation now states the wanted answer.
 *
 * There was also no multi-row paste test anywhere — `Clipboard.spec.ts`'s twenty-four cases are
 * all inline-mark — which is why the paste cases live here rather than beside them.
 *
 * The table kind declares `continues: true`, as the showcase's own `tableLine` does. Without it a
 * split of a table line emits a paragraph, so the fixture could not express the claim its own
 * cases are about: that the cells either side of a cut stay cells.
 */

const BULLET: CoreOption = {markup: '- __slot__', row: {Component: 'li', continues: true, indents: true}}
const HEADING: CoreOption = {markup: '## __slot__', row: {Component: 'h2'}}
/** The cell kind a carve targets — an option with no markup of its own, as a table's cells are. */
const CELL: CoreOption = {markup: undefined, row: {Component: 'span'}}
const TABLE: CoreOption = {markup: '| __slot__', row: {Component: 'div', continues: true, split: {at: ' | ', as: CELL}}}

const mountWith = (value: string, separator: string) =>
	mountNestedBlock({defaultValue: value, separator, options: [BULLET, HEADING, TABLE, CELL], Mark: () => null})

const mount = (value: string) => mountWith(value, '\n')

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
function paste(container: HTMLElement, range: Range, text: string, mime = 'text/plain'): void {
	const dataTransfer = new DataTransfer()
	dataTransfer.setData(mime, text)
	const event = new InputEvent('beforeinput', {
		inputType: 'insertFromPaste',
		bubbles: true,
		cancelable: true,
		dataTransfer,
	})
	Object.defineProperty(event, 'getTargetRanges', {value: () => [range]})
	container.dispatchEvent(event)
}

/**
 * A paste of THIS editor's own markup, which arrives the way the copy path leaves it: the entry is
 * captured off a `paste` event and read back out of the container that captured it.
 */
function pasteMarkup(container: HTMLElement, range: Range, markup: string): void {
	const dataTransfer = new DataTransfer()
	dataTransfer.setData(MARKPUT_MIME, markup)
	container.dispatchEvent(new ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: dataTransfer}))
	paste(container, range, markup, MARKPUT_MIME)
}

/** A live DOM selection running between two rows' own bodies — an ordinary drag, not a row gesture. */
function sweep(store: Store, fromRow: number, fromOffset: number, toRow: number, toOffset: number): void {
	const at = (row: number, offset: number) => {
		const body = rowsOf(store)[row].inline()[0]
		const surface = store.tokens.handle(body.id)?.element()
		if (!surface) throw new Error('row body has no consigned element')
		return surface.firstChild ? {node: surface.firstChild, offset} : {node: surface, offset: 0}
	}
	const from = at(fromRow, fromOffset)
	const to = at(toRow, toOffset)
	const range = document.createRange()
	range.setStart(from.node, from.offset)
	range.setEnd(to.node, to.offset)
	const selection = window.getSelection()
	selection?.removeAllRanges()
	selection?.addRange(range)
}

/** The live DOM selection as a Range — what a paste over a standing row selection targets. */
function liveRange(): Range {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) throw new Error('no live selection')
	return selection.getRangeAt(0)
}

describe('a pasted clip’s lines open rows', () => {
	/**
	 * A clip's line break goes through the SPLIT, so the line it opens is a table line of its own
	 * and the cells either side of the caret stay cells. Spliced raw it was neither: the bare `\n`
	 * ended the table line and everything after the caret became a paragraph, one cell where there
	 * had been two.
	 */
	it('keeps the cells either side of the cut when a two-line clip lands in a cell', () => {
		const {store, container} = mount('| a | b\nafter')
		const range = caretIn(store, 1, 1)

		paste(container, range, 'one\ntwo')

		expect(store.tokens.value()).toBe('| aone\n| two | b\nafter')
		expect(rowsOf(store)[0].rows()).toHaveLength(1)
		// The line the paste opened is a table line, carrying the cell the caret was in front of.
		expect(
			rowsOf(store)[2]
				.rows()
				.map(cell => cell.slot())
		).toEqual(['two', 'b'])
		// The caret is at the end of what was pasted, which is the end of `two`.
		expect(selectionRange(store)).toEqual({start: 12, end: 12})
	})

	/**
	 * The line keeps the caret row's DEPTH, because the split writes the row's own lead — where the
	 * raw splice carried none and left the second line at depth 0, outside the list. Its KIND comes
	 * with it for the same reason Enter's does: the bullet `continues`.
	 */
	it('opens the pasted line at the caret row’s depth', () => {
		const {store, container} = mount('- parent\n\t- child\n- after')
		const range = caretIn(store, 1, 5)

		paste(container, range, 'one\ntwo')

		expect(store.tokens.value()).toBe('- parent\n\t- childone\n\t- two\n- after')
		expect(selectionRange(store)).toEqual({start: 27, end: 27})
	})

	/**
	 * THIS EDITOR'S OWN CLIP is the value's own projection — every line already carries its lead and
	 * its opener — so it is spliced verbatim. Opening rows for it would write a second opener in
	 * front of each line. The markup entry is what tells the two apart, and it is the same entry the
	 * copy above put there.
	 */
	it('splices this editor’s own markup verbatim', () => {
		const {store, container} = mount('- parent\n\t- child\n- after')
		const range = caretIn(store, 1, 5)

		pasteMarkup(container, range, '\n\t- own')

		expect(store.tokens.value()).toBe('- parent\n\t- child\n\t- own\n- after')
	})

	/**
	 * A PIECE CARRYING THE DOCUMENT'S OWN SEPARATOR IS TWO LINES. The caller cuts a clip on LINE
	 * BREAKS, which is the clip's platform's question; whether a piece still holds a separator is
	 * the DOCUMENT's, and only the plan knows it. Uncut, that piece opened a row the plan had not
	 * counted: `y` arrived with neither lead nor opener while `- z` got both — two readings of one
	 * clip inside one paste — and the pre-order `tail` named the row before the last, leaving the
	 * caret at offset 11, in the middle of what was pasted, instead of at its end.
	 *
	 * Only reachable for a separator with no newline in it; for the `'\n'` family the caller's own
	 * cut has already taken every one.
	 */
	it('opens a row per document separator inside a pasted line, and ends the caret past the clip', () => {
		const {store, container} = mountWith('- alpha;;- beta', ';;')
		const range = caretIn(store, 0, 5)

		paste(container, range, 'x;;y\nz')

		expect(store.tokens.value()).toBe('- alphax;;- y;;- z;;- beta')
		// Offset 18 is the end of `z`, which is the end of the clip.
		expect(selectionRange(store)).toEqual({start: 18, end: 18})
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
	 *
	 * THIS EDITOR'S OWN clip, through the markup entry — which is what makes the case about the SPAN
	 * rather than about the clip. Written through `paste()` it went out on the FOREIGN channel while
	 * carrying an opener per line and a `⏎` that happened to equal this fixture's separator: the one
	 * clip for which the verbatim splice and the row-aware answer produce the same bytes, so the
	 * case could not fail for the reading it claimed.
	 */
	it('replaces the selected row with the clip, opener and all', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		expect(store.rows.selected()).toHaveLength(1)

		pasteMarkup(container, liveRange(), '- one\n- two')

		expect(store.tokens.value()).toBe('- one\n- two\ntail')
	})

	/**
	 * A FOREIGN CLIP IS LINES, and over a row selection it takes the same rules it takes at a caret
	 * in the same row: the covered row's lead on every line, and its kind where the kind continues.
	 * Spliced verbatim — which is what this arm did — a two-line clip over a NESTED bullet landed
	 * both lines at depth 0 with no opener and cut the list in two, while the identical clip at a
	 * caret one keystroke earlier gave `'- parent⏎⇥- childone⏎⇥- two⏎- after'`.
	 *
	 * The literal `- ` in the second case is the point of it: foreign text is text. A clip that
	 * looks like this editor's own markup is not this editor's own markup, and the caret path has
	 * always written it as body content.
	 */
	it('opens a foreign clip’s lines as rows at the covered row’s depth and kind', () => {
		const {store, container} = mount('- parent\n\t- child\n- after')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		expect(store.rows.selected()).toHaveLength(1)

		paste(container, liveRange(), 'one\ntwo')

		expect(store.tokens.value()).toBe('- parent\n\t- one\n\t- two\n- after')
	})

	it('writes a foreign clip’s markup-looking bytes as body text', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')

		paste(container, liveRange(), '- one\n- two')

		expect(store.tokens.value()).toBe('- - one\n- - two\ntail')
	})

	/**
	 * A CARRIAGE RETURN IS A LINE BREAK, whatever the document's separator is — the rule
	 * `keyboard-handling.md` states — and this arm was the one place it was not. A Windows clip left
	 * a literal `\r` sitting inside a row's body, in the value handed to `onChange`.
	 */
	it('normalizes a CRLF clip to the document’s own separator', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')

		paste(container, liveRange(), 'one\r\ntwo')

		expect(store.tokens.value()).toBe('- one\n- two\ntail')
	})

	/**
	 * THE CASE THAT CANNOT BE ARGUED AS A PREFERENCE: with a separator that is not a newline, the
	 * verbatim splice wrote a `⏎` the document's own encoding has no meaning for — a character
	 * inside a row's body, produced by a paste, where the user pasted two lines and got one row.
	 */
	it('opens the lines as rows when the separator is not a newline', () => {
		const {store, container} = mountWith('- alpha;;- beta', ';;')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		expect(store.rows.selected()).toHaveLength(1)

		paste(container, liveRange(), 'one\ntwo')

		expect(store.tokens.value()).toBe('- one;;- two;;- beta')
	})

	/**
	 * A ONE-LINE foreign clip takes the same rule, which is what makes a paste agree with TYPING
	 * over the same selection — a character typed there already keeps the row's kind
	 * (`'## Head'` + `x` → `'## x'`). Pasting one lost it.
	 */
	it('keeps the covered row’s kind for a single-line clip', () => {
		const {store, container} = mount('- target\ntail')
		caretIn(store, 0, 0)
		press(container, 'Escape')

		paste(container, liveRange(), 'one')

		expect(store.tokens.value()).toBe('- one\ntail')
	})

	/**
	 * THE `cut` LISTENER, which is the one of the four gestures nothing reached. It is not the
	 * `deleteByCut` arm beside it: `#handleCopy` cancels the event, so the browser emits no
	 * `beforeinput` after a real cut and `rowKeys.spec`'s `deleteByCut` case cannot stand in for it.
	 * Measured before this pin — deleting the listener's `replaceRows` call left the whole core
	 * project green, and Cmd+X over a selected `'- alpha'` would have gone back to the husk `'- '`.
	 *
	 * Both halves are asserted, because the defect is precisely that they DISAGREED: what the
	 * clipboard carried out included the opener and what the removal took did not.
	 */
	it('cuts the rows a selection holds, and takes the same bytes it copied', () => {
		const {store, container} = mount('- alpha\n- beta')
		caretIn(store, 0, 0)
		press(container, 'Escape')
		expect(store.rows.selected()).toHaveLength(1)

		const clipboardData = new DataTransfer()
		container.dispatchEvent(new ClipboardEvent('cut', {bubbles: true, cancelable: true, clipboardData}))

		expect(clipboardData.getData(MARKPUT_MIME)).toBe('- alpha')
		expect(store.tokens.value()).toBe('- beta')
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
		expect(store.rows.selected()).toHaveLength(3)

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
		expect(store.rows.selected()).toHaveLength(0)

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
		expect(store.rows.selected()).toHaveLength(1)

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
		const selected = store.rows.selected()
		expect(selected).toHaveLength(2)

		press(container, 'Tab')

		expect(store.tokens.value()).toBe('- alpha\n\t- beta\n\t- gamma')
		// The same two rows, still selected: a re-indent moves no position and keeps every id.
		expect(store.rows.selected()).toEqual(selected)
	})

	/** Shift+Tab is the same verb with the step reversed, and the same set answers it. */
	it('outdents every row of a standing row selection', () => {
		const {store, container} = mount('- alpha\n\t- beta\n\t- gamma')
		caretIn(store, 1, 0)
		press(container, 'Escape')
		press(container, 'ArrowDown', {shiftKey: true})
		expect(store.rows.selected()).toHaveLength(2)

		press(container, 'Tab', {shiftKey: true})

		expect(store.tokens.value()).toBe('- alpha\n- beta\n- gamma')
	})

	/**
	 * A TEXT SWEEP IS NOT A ROW SELECTION, however much of a row it happens to cover. Tab asked the
	 * LOOSE question — "which rows does this span cover whole" — while Backspace, cut, paste and
	 * Enter asked the exact one, so a drag from the middle of `alpha` to the end of `beta` made Tab
	 * indent `beta`, a row the caret is not in, and leave the caret's own row where it was. Both now
	 * ask {@link TokenModel.rowSelection}, which answers the empty set here.
	 */
	it('does not move a row a plain text sweep merely covers', () => {
		const {store, container} = mount('- alpha\n- beta')
		sweep(store, 0, 2, 1, 4)
		expect(store.rows.selected()).toHaveLength(0)

		press(container, 'Tab')

		// Consumed — the caret's own row is a bullet — and the step is refused: `alpha` is already
		// at depth 0 with no row above it to nest under.
		expect(store.tokens.value()).toBe('- alpha\n- beta')
	})

	/**
	 * THE DECLARATION IS THE SET'S. The gate read the ANCHOR's row and the verb moved every covered
	 * row, so which row happened to be FIRST decided the outcome: a heading selected after a bullet
	 * was indented under it, while the same two rows selected the other way round consumed nothing.
	 * Tab with a caret in that heading alone is not consumed either, so the editor held two answers
	 * for one question.
	 */
	it('leaves the key alone when the set holds a kind that declares no indents', () => {
		for (const [value, key] of [
			['- alpha\n- beta\n## Head', 'ArrowDown'],
			['- alpha\n## Head\n- beta', 'ArrowUp'],
		] as const) {
			const {store, container} = mount(value)
			caretIn(store, key === 'ArrowDown' ? 1 : 2, 0)
			press(container, 'Escape')
			press(container, key, {shiftKey: true})
			expect(store.rows.selected()).toHaveLength(2)

			const event = press(container, 'Tab')

			expect(event.defaultPrevented).toBe(false)
			expect(store.tokens.value()).toBe(value)
		}
	})
})