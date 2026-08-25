import {KEYBOARD} from '../../shared/constants'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'tokens'>
import {dropUnexpressedInput} from './beforeInput'

/**
 * Block layout's KEYDOWN arm, called by `enableInput` after the shared consumer-origin and
 * select-all checks: Enter splits the row by inserting the SEPARATOR, and reparse forms the
 * rows — no row content is composed, no markup consulted (issue 08).
 *
 * It is the only key block answers differently. There is no arrow arm: one host makes cross-row
 * caret movement native, and nothing may cancel an arrow keydown (`blockEdit.spec`'s two arrow
 * cases). Delete is not here either — a row boundary is an ANCHOR question since
 * `anchorsForDelete` learned the separator, so both layouts run one delete arm.
 */
export function handleRowEnter(store: KbCtx, event: KeyboardEvent): void {
	const rowConfig = store.tokens.rowConfig()
	if (rowConfig === undefined) return
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	// Everything selected: Enter REPLACES the document with one fresh row — the block
	// analogue of inline's whole-value replace. Ahead of the anchor read, which would resolve
	// the position the selection merely STARTS at and split the row there instead, appending
	// an empty row while keeping everything selected.
	if (store.tokens.selection.isAllSelected()) {
		event.preventDefault()
		// An empty document IS one empty row (issue 08's trailing convention), so the block
		// analogue of inline's whole-value replace needs no row content at all.
		store.tokens.setValue('', 0)
		return
	}

	// Over a RANGE this splices at the LOW end and KEEPS what was selected, which is
	// deliberately not the shared table's replace-the-range rule.
	//
	// The stored anchors stand behind the live selection, and this is the one arm that still
	// wants them: a split needs THE POSITION, which only they carry. The delete arm dropped its
	// own fallback — an edge measured off the row's DOM — because it could disagree with them.
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return

	event.preventDefault()
	store.edit.replace(at, at, rowConfig.separator)
}

/**
 * Block layout's ONE divergence from the shared inputType table, and the whole of what its
 * `beforeinput` arm still is. Answers whether it consumed the event.
 *
 * Enter belongs to {@link handleRowEnter}'s keydown, which cancels plain Enter and inserts the
 * SEPARATOR, so the table's `'\n'` mapping is wrong for a row — it would splice a literal
 * newline INSIDE the row instead of splitting it. An insertParagraph that still arrives
 * answered to no keydown, so it fails closed with the rest of the unexpressed.
 */
export function handleRowParagraph(store: KbCtx, container: HTMLElement, event: InputEvent): boolean {
	if (store.tokens.rowConfig() === undefined) return false
	if (event.inputType !== 'insertParagraph') return false
	dropUnexpressedInput(container, event)
	return true
}