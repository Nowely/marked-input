import {KEYBOARD} from '../../shared/constants'
import type {Store} from '../../store/Store'
import type {AnchoredRow, Anchors} from '../tokens'
import {anchorEquals, entryAnchor} from '../tokens'
import {dropUnexpressedInput} from './beforeInput'

type KbCtx = Pick<Store, 'block' | 'edit' | 'overlay' | 'tokens'>

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
 * stays above and the subtree follows the tail. On an EMPTY row it DEMOTES instead, and only falls
 * through to the split when the ladder has nothing left to give.
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

	// THE SUGGESTIONS PROTOCOL GETS ITS OWN KEY BACK. Both listeners sit on the container, and this
	// keymap is bound at editor setup while `SuggestionsModel.activate` binds when the popup mounts
	// — later, same element, same phase — so this arm ran first and split the row out from under a
	// highlighted name. {@link handleRowSelection} already defers to an open overlay on Esc; one arm
	// deferring and its neighbour not is the asymmetry this closes. `consumes` is
	// `navigateSuggestions` itself, so a key nothing will take (the `/` menu, which declares no
	// keyboard navigation) still reaches the split.
	if (store.overlay.suggestions.consumes(event.key)) return

	// Everything selected: Enter REPLACES the document with one fresh row — the block analogue of
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
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return
	const caret = store.tokens.rowOf(at)
	if (caret === undefined) return

	// Cancelled before the verb answers, not after: the container is the ONE editing host, so a
	// default left standing here edits model-owned DOM whatever the verb decides.
	event.preventDefault()

	if (isRawBody(caret)) {
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
	if (caret.row.slot() === '' && demote(caret)) return
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
 * TAB and SHIFT+TAB, on the keydown: the row's depth, when the kind that owns its line declares
 * `indents` — or the NEXT CARVED PIECE when the caret is in one.
 *
 * The cell walk declares nothing and is not a third setting: a piece is a Row in its parent's own
 * child list, so "the next cell" is that list's next entry, and a kind that carves its body has
 * said everything needed to answer it. At the first or last piece there is no neighbour and Tab is
 * not consumed, so it leaves the field exactly as it does everywhere else (ADR-0002's accepted
 * cost) rather than wrapping into a row the user did not point at.
 *
 * The declaration gates the KEY and not the verb — a Tab that indents on one row and moves focus on
 * the next is worse than either — so a row of an indenting kind consumes Tab even where the scan
 * refuses the depth (at depth 0 with Shift, or under a row that grants no more). Everywhere else
 * Tab still leaves the field, which is ADR-0002's accepted cost, preserved.
 *
 * OWNS THE LINE, not "is the row": a continuation carries no kind of its own, so reading the
 * declaration off the caret's own row let Tab eject focus from the SECOND line of a list item and
 * keep it on the first — the very split the sentence above calls worse than either. The row it is
 * nested in is the one that declared anything, so a kindless row asks it. It re-indents ITSELF, as
 * every other row does; Shift+Tab there detaches the line from its item, which is the answer
 * Backspace at its entry already gives (ADR-0011's declared cost (a)).
 */
export function handleRowIndent(store: KbCtx, event: KeyboardEvent): void {
	if (event.key !== KEYBOARD.TAB) return
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return
	const caret = store.tokens.rowOf(at)
	if (caret === undefined) return

	if (caret.cell) {
		const cells = caret.row.rows()
		// `.at`, and the negative guard with it: `noUncheckedIndexedAccess` is off, so an index read
		// types as non-nullable and the no-neighbour guard reads as impossible — while `.at(-1)`
		// alone would wrap Shift+Tab from the first piece onto the last.
		const step = cells.indexOf(caret.cell) + (event.shiftKey ? -1 : 1)
		const next = step < 0 ? undefined : cells.at(step)
		if (!next) return
		event.preventDefault()
		store.tokens.selection.select(entryAnchor(next))
		return
	}

	const owner = caret.row.descriptor() === undefined ? (caret.parent ?? caret.row) : caret.row
	if (store.tokens.rowSpec(owner)?.indents !== true) return

	event.preventDefault()
	caret.row.setDepth(event.shiftKey ? caret.depth - 1 : caret.depth + 1)
}

/**
 * THE ROW SELECTION'S OWN KEYS: Esc, which escalates a caret into a row selection and then widens
 * it a level at a time, and Shift+Up/Down, which grow it by a row.
 *
 * There is no row-selection STORE behind any of this — `store.block.selected` derives from the
 * text selection — so every arm is one `select` of a span the tree answered. What each key means
 * is therefore the same question asked four ways, and {@link TokenModel.rowScope} is the one place
 * it is answered.
 *
 * SHIFT+ARROWS ARE CONSUMED ONLY ONCE A ROW SELECTION STANDS, and that is not a courtesy: an
 * ordinary arrow may never be cancelled (`rowKeys.spec`'s two arrow cases), and the scope answers
 * `undefined` until a whole row is covered, so the key falls through to the browser by the same
 * test that decides there is nothing to grow.
 *
 * ESC DEFERS TO ANYTHING ALREADY OPEN — the suggestions overlay and the block row menu — which is
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
		if (store.overlay.match() || store.block.state.menu()) return
		// The widening rung FIRST, so a second Esc climbs rather than re-selecting the same row.
		// The `'row'` rung is the ENTRY into a row selection and runs only while none stands: with
		// whole rows already held and nothing above them to climb to, re-stating the ANCHOR's row
		// alone SHRINKS a selection that spans several, which is the one thing Esc must not do.
		const entering = store.tokens.rowsWithin(anchors).length === 0
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

/** The one write these gestures make: a span of the value, as the anchors that name its ends. */
function selectSpan(store: KbCtx, span: {start: number; end: number} | undefined): boolean {
	if (!span) return false
	store.tokens.selection.select(store.tokens.anchorAt(span.start), store.tokens.anchorAt(span.end))
	return true
}

/**
 * THE DEPTH A CONTINUATION LINE IS WRITTEN AT, which is the whole of WHOSE line it becomes: N soft
 * breaks in one row are N lines at ONE level, never a chain N deep.
 *
 * The caret's row is the row that OWNS the lines when it has a kind, or when it is a root — a root
 * with no kind is a paragraph, and a paragraph IS its own block. The continuation goes under it, at
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
 */
function demote(caret: AnchoredRow): boolean {
	return caret.depth > 0 ? caret.row.setDepth(caret.depth - 1) : caret.row.turnInto(undefined)
}

/**
 * Is this row's body RAW AND CLOSED — a body the parse never re-enters, bounded by a closing
 * literal rather than by the row's own separator. Such a body already spans separators, so a
 * newline inside it is content.
 *
 * Read off the compiled markup (`!hasSlot && trailingGap === undefined`) rather than declared on
 * the option: it had exactly one user, and a kind that declares one and compiles to the other would
 * be a second answer to a question the compiler settles.
 */
function isRawBody(caret: AnchoredRow): boolean {
	const descriptor = caret.row.descriptor()
	return descriptor !== undefined && !descriptor.hasSlot && descriptor.trailingGap === undefined
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