import {KEYBOARD} from '../../shared/constants'
import type {Store} from '../../store/Store'
import type {AnchoredRow, Anchors} from '../tokens'
import {anchorEquals} from '../tokens'
import {dropUnexpressedInput} from './beforeInput'

type KbCtx = Pick<Store, 'edit' | 'tokens'>

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
 * Shift+Enter opens a CONTINUATION LINE — a child row with no kind — which is the soft break this
 * encoding can express: one line is one row (ADR-0011), so a second line inside a row has to be a
 * row, and the only question is whose. As a CHILD it travels with its parent on a drag, copies
 * with it, and renders inside the parent's own component; as a sibling it would be a block of its
 * own. It is an insert and a depth rather than a verb, and both are written in ONE splice, because
 * two verbs cannot compose here: in controlled mode the tree has not moved when the first returns,
 * so the second would address the document as it was.
 *
 * A RAW CLOSED body — a fence, frontmatter — takes neither: its interior already holds separators,
 * so Enter there is a literal newline. Derived from the compiled markup rather than declared,
 * because a kind whose body is raw and closed is exactly the kind that can hold one.
 */
export function handleRowEnter(store: KbCtx, event: KeyboardEvent): void {
	const rowConfig = store.tokens.rowConfig()
	if (rowConfig === undefined) return
	if (event.key !== KEYBOARD.ENTER) return

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
		// `childDepth`, not `depth + 1`: an EMPTY row takes no children, so the continuation would
		// come back as a sibling carrying an indent run the scan never granted. Asking the tree for
		// the depth a child would land at makes that case a plain split, with no rule restated here.
		store.edit.replace(at, at, rowConfig.separator + rowConfig.indent.repeat(caret.childDepth))
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
 * TAB and SHIFT+TAB, on the keydown: the row's depth, when its kind declares `indents`.
 *
 * The declaration gates the KEY and not the verb — a Tab that indents on one row and moves focus on
 * the next is worse than either — so a row of an indenting kind consumes Tab even where the scan
 * refuses the depth (at depth 0 with Shift, or under a row that grants no more). Everywhere else
 * Tab still leaves the field, which is ADR-0002's accepted cost, preserved.
 */
export function handleRowIndent(store: KbCtx, event: KeyboardEvent): void {
	if (event.key !== KEYBOARD.TAB) return
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return
	const caret = store.tokens.rowOf(at)
	if (caret === undefined) return
	if (store.tokens.rowSpec(caret.row)?.indents !== true) return

	event.preventDefault()
	caret.row.setDepth(event.shiftKey ? caret.depth - 1 : caret.depth + 1)
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