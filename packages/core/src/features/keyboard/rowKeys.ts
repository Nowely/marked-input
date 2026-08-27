import {KEYBOARD} from '../../shared/constants'
import type {Store} from '../../store/Store'
import type {AnchoredRow, Anchors, RowNode} from '../tokens'
import {anchorEquals, entryAnchor, hasRawBody} from '../tokens'
import type {Replacement} from './beforeInput'
import {dropUnexpressedInput} from './beforeInput'

type KbCtx = Pick<Store, 'edit' | 'overlay' | 'rows' | 'tokens'>

/**
 * THE ROW KEYMAP: the keys that mean something different when the value parses into rows. Every
 * arm here resolves the caret's row and then calls a ROW VERB — the keymap holds no rule of its
 * own, because a rule it held would be a second copy of one the verbs already answer.
 *
 * There is no arrow arm: one host makes cross-row caret movement native, and nothing may cancel an
 * arrow keydown (`rowKeys.spec`'s two arrow cases). Delete is not here either — a row boundary is
 * an ANCHOR question since `anchorsForDelete` learned the separator, so both layouts run one
 * delete arm, and Backspace's own row arm below sits IN it rather than beside it.
 */

/**
 * ENTER, on the keydown, and SHIFT+ENTER with it: both open a row, and which row is the whole
 * difference between them.
 *
 * Plain Enter SPLITS at the caret — `RowNode.splitAt` — which is one call for three gestures
 * the old text listed separately — at a row's end the tail is empty and takes this kind when the
 * kind `continues`, mid-row it carries the rest of the body, and at a row's start the empty head
 * stays above and the subtree follows the tail. On an EMPTY row of a kind that CONTINUES it
 * DEMOTES instead ({@link continuesARun}), and only falls through to the split when the ladder has
 * nothing left to give.
 *
 * Shift+Enter opens a CONTINUATION LINE — a row with no kind, under the row whose kind owns the
 * line — which is the soft break this encoding can express: one line is one row (ADR-0011), so a
 * second line inside a row has to be a row, and the only question is whose. Inside the KIND's
 * subtree it travels with it on a drag, copies with it, and reaches its component as the `rows`
 * prop; outside, it would be a row of its own. It is an insert and a depth rather than a verb, and
 * both are written in ONE splice, because two verbs cannot compose here: in controlled mode the
 * tree has not moved when the first returns, so the second would address the document as it was.
 * {@link continuationDepth} is the whole of which row it joins.
 *
 * A RAW CLOSED body — a fence, frontmatter — takes neither: its interior already holds separators,
 * so Enter there is a literal newline. Derived from the compiled markup rather than declared,
 * because a kind whose body is raw and closed is exactly the kind that can hold one.
 *
 * A CARVED row takes the split and REFUSES the continuation, and the asymmetry is the encoding's:
 * a continuation is a row nested under the one whose kind owns the line, and a carved row's
 * children are its own body, so the scan's ceiling grants it none. See {@link handleRowEnter}'s
 * Shift arm.
 */
export function handleRowEnter(store: KbCtx, event: KeyboardEvent): void {
	const rowConfig = store.tokens.rowConfig()
	if (rowConfig === undefined) return
	if (event.key !== KEYBOARD.ENTER) return

	// THE OVERLAY LIST GETS ITS OWN KEY BACK. Both listeners sit on the container, and this keymap
	// is bound at editor setup while `OverlayListModel.activate` binds when the popup mounts —
	// later, same element, same phase — so this arm ran first and split the row out from under a
	// highlighted row. {@link handleRowSelection} already defers to an open overlay on Esc; one arm
	// deferring and its neighbour not is the asymmetry this closes. `consumes` is
	// `navigateSuggestions` itself, so a key the protocol will not take — no rows, or Enter with
	// nothing highlighted — still reaches the split.
	if (store.overlay.list.consumes(event.key)) return

	// Everything selected: Enter REPLACES the document with one fresh row — the row analogue of
	// inline's whole-value replace. Ahead of the anchor read, which would resolve the position the
	// selection merely STARTS at and split the row there instead, appending an empty row while
	// keeping everything selected.
	if (store.tokens.selection.isAllSelected()) {
		event.preventDefault()
		// An empty document IS one empty row (ADR-0009's trailing convention), so the replace needs
		// no row content at all, and the caret lands inside that row on its own: the post-edit
		// anchor at offset 0 resolves to the row's entry.
		store.edit.setValue('')
		return
	}

	// Over a RANGE this splices at the LOW end and KEEPS what was selected, which is deliberately
	// not the shared table's replace-the-range rule.
	//
	// The stored anchors stand behind the live selection, and this is the one arm that still wants
	// them: a split needs THE POSITION, which only they carry. The delete arm dropped its own
	// fallback — an edge measured off the row's DOM — because it could disagree with them.
	const anchors = store.tokens.domAnchors() ?? store.tokens.selection.anchors()
	if (!anchors) return

	// A ROW SELECTION is REPLACED, not split at its low end: whole rows are what the user named, so
	// Enter opens one fresh row in their place — the same answer it gives for an all-selected
	// document, at row granularity. Splitting instead slid the anchors under the inserted separator
	// and left the caret at the start of the row BELOW the one Enter had opened, where the next
	// character typed deleted the row that was selected.
	if (store.tokens.replaceRows(anchors, '')) {
		event.preventDefault()
		return
	}

	const at = anchors.anchor
	const caret = store.tokens.rowOf(at)
	if (caret === undefined) return

	// Cancelled before the verb answers, not after: the container is the ONE editing host, so a
	// default left standing here edits model-owned DOM whatever the verb decides.
	event.preventDefault()

	if (hasRawBody(caret.row)) {
		store.edit.replace(at, at, '\n')
		return
	}
	if (event.shiftKey) {
		// A CARVED piece takes no continuation: the row's children ARE its body, so the scan's
		// ceiling grants it none, and the separator this writes would land INSIDE the body — cutting
		// the line in two and leaving the pieces after the caret in a row of their own. Consumed and
		// refused, which is the answer Backspace at a piece's start already gives.
		if (caret.cell) return
		store.edit.replace(at, at, rowConfig.separator + rowConfig.indent.repeat(continuationDepth(caret)))
		return
	}
	if (caret.row.slot() === '' && continuesARun(store, caret.row) && demote(caret)) return
	caret.row.splitAt(at)
}

/**
 * BACKSPACE at a row's own ENTRY, as the {@link demote} ladder — answers whether it consumed the
 * key. Called from the shared delete arm AFTER its own checks (a modifier means the platform's
 * word or line extent, and an all-selected Backspace clears the value), because those are not row
 * questions and answering them twice is how two arms drift.
 *
 * `false` leaves the delete arm to run, and that IS the merge: a collapsed delete at a row boundary
 * expands onto the separator, the next row's lead and its opener, and removing that span joins the
 * two rows. There is no `mergeWith` call here — the merge has one owner, and it is that expansion.
 */
export function demoteAtRowEntry(store: KbCtx, anchors: Anchors): boolean {
	// A RANGED Backspace deletes what is selected, wherever it starts.
	if (!anchorEquals(anchors.anchor, anchors.head)) return false
	const caret = store.tokens.rowOf(anchors.anchor)
	if (caret?.atEntry !== true) return false
	return demote(caret)
}

/**
 * TAB and SHIFT+TAB, on the keydown: the row's depth, in an editor whose options declare
 * `indents` — or the NEXT CARVED PIECE when the caret is in one.
 *
 * The cell walk declares nothing and is not a third setting: a piece is a Row in its parent's own
 * child list, so "the next cell" is that list's next entry, and a kind that carves its body has
 * said everything needed to answer it. At the first or last piece there is no neighbour and the
 * caret does not move — Tab does NOT wrap into a row the user did not point at.
 *
 * IT IS STILL CONSUMED THERE, by the rule the paragraph below already states for `indents`: the
 * declaration gates the KEY, not the verb. It used not to be, and the split was a defect rather
 * than a nicety. A table line the menu inserts has ONE cell, so its first cell is also its last:
 * Tab moved no caret, fell through, and the browser moved focus OUT of the editor onto the next
 * control — measured, `document.activeElement` a `<button>` after one Tab past the last cell. The
 * user saw nothing happen, and the next Enter was a dead key, because the editor no longer had
 * focus to split a row with. Consuming it costs what every `indents` kind already costs (ADR-0002),
 * and it costs it only while the caret is inside a carved body.
 *
 * THE DECLARATION IS THE EDITOR'S, NOT THE ROW'S, and that is what makes the keyboard and the
 * MOVER agree. `RowSpec.indents` gates the KEY — a Tab that indents on one row and moves focus on
 * the next is worse than either — and {@link TokenModel.rowsIndent} is that gate read where the
 * answer belongs: once per editor. Which row may actually go deeper is
 * {@link TokenModel.indentRows}' question and always was, and the DROP asks the same one through
 * `dropPlacements`; asked per KIND, the two gave different answers for the same gesture (see
 * {@link TokenModel.rowsIndent} for the measurement). So a row of ANY kind consumes Tab in an
 * editor that indents, even where the verb then refuses the depth — at depth 0 with Shift, under a
 * row that grants no more, or under a parent whose component paints no child rows. In an editor
 * where NO option declares `indents`, Tab still leaves the field: ADR-0002's accepted cost,
 * preserved exactly where it was.
 *
 * A STANDING ROW SELECTION IS WHAT MOVES, and the caret's own row only when none stands: the rows
 * the selection holds are the rows the editor is acting on everywhere else — the drag, the menu
 * verbs — and re-indenting the anchor's row alone left every other selected row where it was. One
 * verb answers both, because a caret is the set of one and a second arm beside it would be a
 * second reading of what Tab acts on.
 */
export function handleRowIndent(store: KbCtx, event: KeyboardEvent): void {
	if (event.key !== KEYBOARD.TAB) return
	const anchors = store.tokens.domAnchors() ?? store.tokens.selection.anchors()
	if (!anchors) return
	const caret = store.tokens.rowOf(anchors.anchor)
	if (caret === undefined) return

	if (caret.cell) {
		event.preventDefault()
		const cells = caret.row.rows()
		// `.at`, and the negative guard with it: `noUncheckedIndexedAccess` is off, so an index read
		// types as non-nullable and the no-neighbour guard reads as impossible — while `.at(-1)`
		// alone would wrap Shift+Tab from the first piece onto the last.
		const step = cells.indexOf(caret.cell) + (event.shiftKey ? -1 : 1)
		const next = step < 0 ? undefined : cells.at(step)
		if (next) store.tokens.selection.select(entryAnchor(next))
		return
	}

	if (!store.tokens.rowsIndent()) return
	const selected = store.tokens.rowSelection(anchors)

	event.preventDefault()
	store.tokens.indentRows(selected.length > 0 ? selected : [caret.row], event.shiftKey ? -1 : 1)
}

/**
 * THE ROW SELECTION'S OWN KEYS: Esc, which escalates a caret into a row selection and then widens
 * it a level at a time, and Shift+Up/Down, which grow it by a row.
 *
 * There is no row-selection STORE behind any of this — `store.rows.selected` derives from the
 * text selection — so every arm is one `select` of a span the tree answered. What each key means
 * is therefore the same question asked four ways, and {@link TokenModel.rowScope} is the one place
 * it is answered.
 *
 * SHIFT+ARROWS ARE CONSUMED ONLY ONCE A ROW SELECTION STANDS, and that is not a courtesy: an
 * ordinary arrow may never be cancelled (`rowKeys.spec`'s two arrow cases), and the scope answers
 * `undefined` until a whole row is covered, so the key falls through to the browser by the same
 * test that decides there is nothing to grow.
 *
 * ESC DEFERS TO ANYTHING ALREADY OPEN — the suggestions overlay and the row menu — which is
 * where two features want the same key: each closes on Escape from a listener of its own, on
 * `window` and on `document`, so BOTH run after this container one and neither can see that this
 * arm consumed the key. Escalating underneath them moves the selection out from under a menu the
 * user was dismissing — one keystroke from replacing the row, since the next character typed
 * replaces whatever is selected.
 */
export function handleRowSelection(store: KbCtx, event: KeyboardEvent): void {
	if (store.tokens.rowConfig() === undefined) return
	const anchors = store.tokens.domAnchors() ?? store.tokens.selection.anchors()
	if (!anchors) return

	if (event.key === KEYBOARD.ESC) {
		if (store.overlay.match() || store.rows.state.menu()) return
		// The widening rung FIRST, so a second Esc climbs rather than re-selecting the same row.
		// The `'row'` rung is the ENTRY into a row selection and runs only while none stands: with
		// whole rows already held and nothing above them to climb to, re-stating the ANCHOR's row
		// alone SHRINKS a selection that spans several, which is the one thing Esc must not do.
		const entering = store.tokens.rowSelection(anchors).length === 0
		const span =
			store.tokens.rowScope(anchors, 'out') ?? (entering ? store.tokens.rowScope(anchors, 'row') : undefined)
		if (selectSpan(store, span)) event.preventDefault()
		return
	}
	if (!event.shiftKey || (event.key !== KEYBOARD.UP && event.key !== KEYBOARD.DOWN)) return
	const span = store.tokens.rowScope(anchors, event.key === KEYBOARD.UP ? 'up' : 'down')
	if (selectSpan(store, span)) event.preventDefault()
}

/**
 * MOD+A'S ROW RUNG, answering whether it consumed the widening — `false` leaves select-all to run,
 * which is what it has always done and still does everywhere no row selection stands.
 *
 * It is the same `'out'` scope Esc climbs, so the two keys cannot disagree about what one level
 * wider means. The difference is only where they stop: Esc has nothing above the outermost row,
 * while Mod+A's next rung is the whole document.
 */
export function widenRowScope(store: KbCtx): boolean {
	if (store.tokens.rowConfig() === undefined) return false
	const anchors = store.tokens.domAnchors() ?? store.tokens.selection.anchors()
	if (!anchors) return false
	return selectSpan(store, store.tokens.rowScope(anchors, 'out'))
}

/**
 * The one write these gestures make: a span of the value, through {@link TokenModel.selectRowSpan}
 * — which is where an end no surface paints falls back on its row's own element edge.
 */
function selectSpan(store: KbCtx, span: {start: number; end: number} | undefined): boolean {
	if (!span) return false
	store.tokens.selectRowSpan(span)
	return true
}

/**
 * THE DEPTH A CONTINUATION LINE IS WRITTEN AT, which is the whole of WHOSE line it becomes: N soft
 * breaks in one row are N lines at ONE level, never a chain N deep.
 *
 * The caret's row is the row that OWNS the lines when it has a kind, or when it is a root — a root
 * with no kind is a paragraph, and a ROOT paragraph owns its own lines. The continuation goes under it, at
 * `childDepth` rather than `depth + 1`: an EMPTY row takes no children, so asking the tree keeps
 * that case a plain split instead of writing an indent run the scan never granted.
 *
 * A NESTED row with no kind is already an interior line of the row above it, so the next line is
 * its SIBLING. Measuring from the caret's row unconditionally built a staircase — `'- a'` soft
 * broken three times emitted `'- a⏎⇥one⏎⇥⇥two⏎⇥⇥⇥'`, four levels deep for one list item, and only
 * the second line rendered where the amendment said it would.
 *
 * A row the user NESTED with Tab answers the same way, because it is the same document — ADR-0011's
 * declared cost (b), read here as the rule it always was.
 */
function continuationDepth(caret: AnchoredRow): number {
	const ownsItsLines = caret.row.descriptor() !== undefined || caret.depth === 0
	return ownsItsLines ? caret.childDepth : caret.depth
}

/**
 * THE DEMOTE LADDER, and there is exactly one: a row gives up its DEPTH first, then its KIND, and
 * answers `false` once it has neither left — where Enter inserts a row and Backspace merges.
 *
 * Both rungs are verbs, and the second rung's own gate is the verb's: `turnInto(undefined)` on a
 * row that is already a paragraph is a no-op, which the verb refuses on its own, so "and typed" is
 * not a condition written here.
 *
 * WHICH KEY MAY CLIMB IT IS NOT DECIDED HERE, and the two do not ask the same question: Backspace
 * asks about the POSITION (at the row's entry, un-type what is to my left — true of every kind),
 * Enter asks about the ROW (this run is finished — see {@link continuesARun}).
 */
function demote(caret: AnchoredRow): boolean {
	return caret.depth > 0 ? caret.row.setDepth(caret.depth - 1) : caret.row.turnInto(undefined)
}

/**
 * IS THERE A RUN TO LEAVE — the whole of what separates Enter's empty-row ladder from Backspace's.
 *
 * Enter on an empty item means "this list is finished", and a kind that declares no CONTINUATION
 * has no list: its body is empty because the kind HAS none, not because the user emptied one.
 * MEASURED on the showcase's divider (`'---__slot__'`), whose rule is the row's only large target,
 * so a click below the text lands the caret in it: Enter there un-typed the kind and
 * `'target row⏎---'` came back `'target row⏎'`, with the divider simply gone and nothing said. It
 * takes the SPLIT now, which at a row's own start opens the empty row above and KEEPS the kind
 * (round seven's rule): `'target row⏎⏎---'`.
 *
 * A ROW WITH NO KIND AT ALL ANSWERS YES, and that is not an exemption: a nested row with no kind IS
 * a continuation line of the row above it ({@link continuationDepth}), so its depth rung is the
 * same "leave the run" gesture spelled without a declaration.
 */
function continuesARun(store: KbCtx, row: RowNode): boolean {
	const spec = store.tokens.rowSpec(row)
	return spec === undefined || spec.continues !== undefined
}

/**
 * Any line break, whichever platform the clip came from. A clip carries LINES; the document's own
 * separator is a different question and is the verb's.
 */
const LINE_BREAK = /\r\n|\r|\n/

/**
 * THE ROW SELECTION'S ARM OF `beforeinput`: a paste or a delete over whole rows edits the ROWS,
 * openers and leads included, rather than the span between two anchors. Answers whether it consumed
 * the event; `false` leaves the ordinary path, which is every selection that is not a whole number
 * of rows. See {@link TokenModel.replaceRows} for the reading all four gestures share.
 *
 * A DELETE removes them and a PASTE replaces them with the clip. TYPING stays TEXT — a character
 * replaces the rows' own text and the first row keeps its kind, which is the granularity every
 * other inline edit has — but it is on the list all the same, for the SPAN: the anchors an event
 * names run to the NEXT row's entry whenever the browser formed the selection (Shift+ArrowDown, a
 * mouse sweep), so replacing them verbatim deleted the row boundary with the text. Typing over a
 * selected `'BBB'` in `'AAA⏎BBB⏎CCC⏎DDD'` emitted `'AAA⏎XCCC⏎DDD'` — one row and its whole KIND
 * gone, silently. {@link TokenModel.rowSelectionText} is that span, read through the same boundary
 * test the other three gestures go through.
 *
 * WHOSE LANGUAGE THE CLIP IS IN is the same question {@link writeRowsFromInput} asks at a caret,
 * and this arm asked it nowhere: it handed the verb a finished STRING, so a foreign clip pasted
 * over a row selection took none of the row rules — its lines lost the covered row's lead and kind,
 * its `\r` survived into the value, and its `⏎` became a row boundary in a document whose separator
 * is not one. {@link Replacement} carries the answer, computed one layer up, and it now reaches the
 * verb: this editor's own projection stays a string, a foreign clip arrives as LINES.
 *
 * THE DELETE ARM IS THE ONE FOR DELETES THAT ANSWER TO NO KEYDOWN OF OURS — an Edit-menu delete, a
 * synthetic `deleteByCut`. Backspace's own keydown arm and the `cut` listener both cancel their
 * event and call {@link TokenModel.replaceRows} directly, so neither reaches this function; what
 * the three spellings share is the verb, not this route.
 */
export function replaceRowSelection(
	store: KbCtx,
	event: InputEvent,
	anchors: Anchors,
	replacement: Replacement
): boolean {
	if (event.inputType.startsWith('delete')) return store.tokens.replaceRows(anchors, null)
	if (event.inputType === 'insertFromPaste') {
		return store.tokens.replaceRows(
			anchors,
			replacement.markup ? replacement.text : replacement.text.split(LINE_BREAK)
		)
	}
	// AND A ROW THAT HOLDS NO EDITABLE POSITION IS CONSUMED AND LEFT ALONE. A frozen row's body is
	// the kind's own markup rather than prose, so the character has nothing in that row to replace
	// and the key does nothing.
	//
	// ASKED OF BOTH PAIRS, because neither one alone is a witness. The RESOLVED span acquires rows
	// the raw pair never held — a sweep from a plain row into a fence's interior is an ordinary text
	// selection by the raw pair while the resolution stops at the fence's boundary and covers the
	// frozen row whole — and that is the shape this refusal moved onto the span for. But the
	// resolution also LOSES rows the raw pair held, in three measured ways, and each one wrote:
	// a frozen row whose body is EMPTY resolves to a collapsed position INSIDE it, which overlaps
	// no line, and `'before⏎@card ⏎after'` typed over emitted `'before⏎@card a⏎after'` — bytes in a
	// body the kind cannot read back; and a plain sweep across a frozen row resolves to NO span at
	// all, so the raw pair reached the write and `'aa⏎@card panel⏎bb'` swept mid-`aa` to mid-`bb`
	// emitted `'aZb'`. The union is the rule the invariant actually states: a typed character may
	// not reach any part of such a row, by either reading.
	//
	// SELECT-ALL IS NOT THIS QUESTION and never arrives here: `isAllSelected` replaces the whole
	// value one layer up (`input.ts`), which is what Mod+A and a keystroke mean everywhere.
	if (store.tokens.holdsFrozenRow(anchors)) return true
	const span = store.tokens.rowSelectionText(anchors)
	if (span) {
		if (store.tokens.holdsFrozenRow(span)) return true
		store.edit.replace(span.anchor, span.head, replacement.text)
		return true
	}
	// AND SO IS A ROW SELECTION THE SPAN COULD NOT BE FORMED FOR. `rowSelection` is empty wherever
	// no whole row is held, so an ordinary text edit still falls through here.
	//
	// IT USED TO REPLACE THE ROW WHOLE, and that made ONE CLICK PLUS ONE KEYSTROKE a page-scale
	// delete. A block selection is what a pointer landing on frozen presentation produces
	// (`TokenModel.#claimRow`), so a click on a chip inside a properties panel — a target with no
	// behaviour of its own, that nobody reads as "select this block" — armed it. MEASURED on the
	// showcase: one click on the `In progress` chip and one `'a'` took `@properties … @end` with
	// it, 76 lines to 67, and the same gesture on an avatar did the same. Nothing on the way said
	// so and only Mod+Z brought it back.
	//
	// THE GESTURES THAT SAY SO STILL TAKE THE ROW: Backspace and Delete reach
	// {@link TokenModel.replaceRows} through the arm above and through `handleDeleteKey`, and a
	// PASTE still replaces it. Only the typed character is refused.
	//
	// `false` WOULD NOT DO. It falls through to the ordinary text path, which writes over the
	// anchors verbatim — a frozen row's are its own ELEMENT edges — and that is the same deletion
	// through another door. The refusal has to be the consumption.
	return store.tokens.rowSelection(anchors).length > 0
}

/**
 * A CLIP THAT CROSSES ROWS, OPENED AS ROWS — the row world's answer for a paste at a caret, and
 * the same plan Enter's own split writes. Answers whether it consumed the event.
 *
 * The clip was spliced verbatim before this, which took none of the row rules with it. For a
 * FOREIGN clip the bytes between two lines carried no lead and no opener, so a two-line clip
 * pasted into a nested list item left its second line at depth 0, and one pasted into a table cell
 * ended the table line and cost the row every cell after the caret.
 *
 * FOR THIS EDITOR'S OWN CLIP the same splice failed the other way round, and that half was open
 * until now: the projection carries a lead and an opener PER LINE, so splicing it into a row's
 * body wrote those bytes as PROSE — pasting two rows at the end of a paragraph produced a literal
 * tab and a literal `'- '` in the middle of the sentence, while the same clip on an empty row was
 * clean. Both readings reach {@link RowNode.writeRows} now, and WHICH language the clip is in is
 * the string-or-array it is handed as ({@link Replacement}), which is the convention
 * {@link TokenModel.replaceRows} already reads over a row selection.
 *
 * A RAW CLOSED body is refused for the reason Enter is: its interior already holds separators, so
 * a line break inside one is content. The ordinary replacement splices the clip there verbatim.
 */
export function writeRowsFromInput(store: KbCtx, anchors: Anchors, replacement: Replacement): boolean {
	const rows = replacement.markup ? replacement.text : replacement.text.split(LINE_BREAK)
	// A clip that opens no row is an ordinary insert. For LINES that is the count; for MARKUP the
	// document's own SEPARATOR decides, and the plan is the layer holding it — so the string arm
	// asks the verb and takes its refusal.
	if (typeof rows !== 'string' && rows.length < 2) return false
	const caret = store.tokens.rowOf(anchors.anchor)
	if (!caret || hasRawBody(caret.row)) return false
	return caret.row.writeRows(anchors, rows)
}

/**
 * The row world's ONE divergence from the shared inputType table, and the whole of what its
 * `beforeinput` arm is. Answers whether it consumed the event.
 *
 * Both Enter inputTypes belong to {@link handleRowEnter}'s keydown, which cancels the key and
 * splices rows through the verbs — so an `insertParagraph` or an `insertLineBreak` reaching here
 * answered to no keydown of ours and fails closed with the rest of the unexpressed, where the
 * table's `'\n'` would splice a bare newline into a row whose separator is anything but `'\n'` and
 * take none of the row rules with it.
 */
export function handleRowParagraph(store: KbCtx, container: HTMLElement, event: InputEvent): boolean {
	if (store.tokens.rowConfig() === undefined) return false
	if (event.inputType !== 'insertParagraph' && event.inputType !== 'insertLineBreak') return false
	dropUnexpressedInput(container, event)
	return true
}