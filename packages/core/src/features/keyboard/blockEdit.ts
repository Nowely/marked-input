import {KEYBOARD} from '../../shared/constants'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'tokens' | 'props'>
import type {Anchors, NodeAnchor} from '../tokens'
import {dropUnexpressedInput} from './beforeInput'

/**
 * THE anchor a delete falls back on when the live DOM boundary resolves to none — the near EDGE
 * of the row the stored selection names, measured off that row's own DOM. `undefined` for a
 * caret this layer cannot place on an edge, and for every anchor in inline layout, whose roots
 * are never rows: `valueBoundary.ts` gates `parseRowsValue` on `isBlock`, so a RowNode exists
 * only under it and `rowOfAnchor` declines everything else. No layout test of its own.
 *
 * TWO authorities, each answering the half it can be trusted for. The stored anchors survive an
 * unresolvable boundary — `SelectionDriver`'s sync leaves them standing when `domAnchors()`
 * declines — so they still name the right ROW, but their OFFSET is wherever the last resolvable
 * position was. MEASURED on the vue project: a caret placed at the start of a row whose leading
 * child is a framework placeholder (Vue anchors a fragment on an empty text node) leaves them
 * pointing at that row's END, and a delete taken from them eats the wrong character —
 * `Drag.spec`'s nine `focusAtStart` merges. The row's own DOM text measure is what says which
 * edge the caret is at, and it reads the placeholder correctly.
 *
 * That is the whole of the row tier that survives resolving deletes through anchors, and it is
 * an anchor SOURCE now rather than a merge of its own. The reason written for the tier before
 * ADR-0008's 2026-08-19 amendment was different and is dead: it claimed the tier covered the
 * `pendingStructural` window, where in fact the latch refused every id, so both authorities
 * answered `undefined` there and the fallback bought nothing.
 *
 * A caret INSIDE the row answers `undefined`: naming it would need an offset this layer may not
 * form (ADR-0003), and a mid-row delete arrives again as a `beforeinput` carrying its own
 * target range.
 */
export function rowEdgeAnchors(store: KbCtx): Anchors | undefined {
	const stored = store.tokens.selection.anchors()?.anchor
	const row = stored && rowOfAnchor(store, stored)
	if (!row) return undefined
	const handle = store.tokens.handle(row.id)
	if (!handle) return undefined
	const caret = handle.caretIndex()
	if (caret === undefined) return undefined
	if (caret === 0) return collapsed({before: row})
	// The row's children END with a text token (`RowBuilder.groupRows`' edge invariant), so its
	// content end is that child's trailing edge. `{after: row}` would sit PAST the separator.
	const last = row.children().at(-1)
	if (!last || caret !== handle.textLength()) return undefined
	return collapsed({after: last})
}

function collapsed(anchor: NodeAnchor): Anchors {
	return {anchor, head: anchor}
}

/** The ROOT row an anchor's own node belongs to — the tree identity every anchor form carries except the document edges. */
function rowOfAnchor(store: KbCtx, anchor: NodeAnchor) {
	if (typeof anchor === 'string') return undefined
	const owner = 'node' in anchor ? anchor.node : 'before' in anchor ? anchor.before : anchor.after
	const index = store.tokens.rootIndexOf(owner.id)
	if (index === undefined) return undefined
	// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as `TreeNode`
	// and the out-of-range guard is linted away as an impossible condition.
	const root = store.tokens.nodes().at(index)
	return root?.kind === 'row' ? root : undefined
}

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
	if (!store.props.layout.isBlock()) return
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
	// The stored anchors stand behind the live selection here rather than
	// {@link rowEdgeAnchors}: a split needs the position itself, which only they carry, where
	// a delete needs to know which row EDGE it is on.
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return

	event.preventDefault()
	store.edit.replace(at, at, store.props.separator())
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
	if (!store.props.layout.isBlock()) return false
	if (event.inputType !== 'insertParagraph') return false
	dropUnexpressedInput(container, event)
	return true
}