import {nodeTarget} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'tokens' | 'props'>
import type {Anchors, NodeAnchor} from '../tokens'
import {
	anchorsForDelete,
	anchorsForInput,
	anchorsFromInputEvent,
	dropUnexpressedInput,
	isConsumerKeyOrigin,
	replacementForInput,
} from './beforeInput'

export function enableBlockEdit(store: KbCtx, container: HTMLElement): void {
	listen(container, 'keydown', e => {
		if (!store.props.layout.isBlock()) return
		// The same consumer-origin test `enableInput`'s keydown tier takes, and for the same
		// reason: the handlers below key on the STORED selection, not on where the key was
		// pressed, so Backspace or Enter inside a control or a consumer's editable island
		// would resolve a row and edit (or merge) it.
		if (isConsumerKeyOrigin(store, container, e)) return

		// No arrow arm: one host makes cross-row caret movement native.
		handleDelete(store, e)
		handleRowEnter(store, e)
	})

	listen(
		container,
		'beforeinput',
		e => {
			if (!store.props.layout.isBlock()) return
			if (e.defaultPrevented) return
			handleBlockBeforeInput(store, container, e)
		},
		true
	)
}

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
function rowEdgeAnchors(store: KbCtx): Anchors | undefined {
	const stored = store.tokens.selection.anchors()?.anchor
	const row = stored && rowOfAnchor(store, stored)
	if (!row) return undefined
	const handle = store.tokens.handle(row.id)
	const caret = handle?.caretIndex()
	if (!handle || caret === undefined) return undefined
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
 * Backspace/Delete, resolved entirely through ANCHORS — the same body `input.ts`'s inline arm
 * runs. A row boundary is no longer a case of its own: {@link anchorsForDelete} expands a
 * collapsed delete sitting on one onto the whole SEPARATOR, and removing that span IS the merge
 * `RowNode.mergeWith` used to perform on a row resolved out of the selection.
 */
function handleDelete(store: KbCtx, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.BACKSPACE && event.key !== KEYBOARD.DELETE) return
	// The same word/line decline the inline arm takes, and block needs it for the same reason
	// now that this one answers on the KEYDOWN: the extent of Alt/Ctrl/Cmd+Backspace rides on
	// the `beforeinput` that follows, so cancelling here would turn a word delete into a
	// one-character one. It folds into the inline test when the two arms become one.
	if (event.ctrlKey || event.altKey || event.metaKey) return

	const anchors = store.tokens.domAnchors() ?? rowEdgeAnchors(store)
	if (!anchors) return

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const target = anchorsForDelete(store, inputType, anchors)
	if (!target) return

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, '')
}

function handleRowEnter(store: KbCtx, event: KeyboardEvent) {
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

	// ONE arm (issue 08): Enter inserts the separator at the caret and reparse forms the rows —
	// no row content is composed, no markup consulted. Over a RANGE it splices at the LOW end
	// and KEEPS what was selected, which is deliberately not the shared table's replace-the-
	// range rule.
	//
	// The stored anchors stand behind the live selection here rather than
	// {@link rowEdgeAnchors}: a split needs the position itself, which only they carry, where
	// a delete needs to know which row EDGE it is on.
	const at = (store.tokens.domAnchors() ?? store.tokens.selection.anchors())?.anchor
	if (at === undefined) return

	event.preventDefault()
	store.edit.replace(at, at, store.props.separator())
}

function handleBlockBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent) {
	const target = nodeTarget(event)
	// A control root is consumer chrome that owns its own input, so its event passes through
	// untouched.
	if (target && store.tokens.handleAt(target) === 'control') return

	// Enter is {@link handleRowEnter}'s: its keydown arm cancels plain Enter and inserts the
	// SEPARATOR, so the shared table's '\n' mapping is wrong for a row — it would splice a
	// literal newline inside it instead of splitting it. An insertParagraph that still arrives
	// answered to no keydown, so it fails closed with the rest of the unexpressed.
	if (event.inputType === 'insertParagraph') {
		dropUnexpressedInput(container, event)
		return
	}

	// The SAME inputType→replacement table as `input.ts`, undefined failing CLOSED the same
	// way: block rows live in the one shared host, so an input type the table cannot
	// express would edit model-owned DOM.
	const replacement = replacementForInput(container, event)
	if (replacement === undefined) {
		dropUnexpressedInput(container, event)
		return
	}
	replaceBlockRange(store, container, event, replacement)
}

function replaceBlockRange(store: KbCtx, container: HTMLElement, event: InputEvent, replacement: string): void {
	const anchors = anchorsFromInputEvent(store, event)
	// The shared mark swallow is safe here since issue 08: a block row is a RowNode, never a
	// MarkNode, so `adjacentMark` can only answer an INLINE mark inside a row — a plain
	// Backspace beside a mention deletes the mention, never a whole row. Row-level deletes
	// are {@link handleDelete}'s, and it preventDefaults before this runs.
	const target = anchors && anchorsForInput(store, event, anchors)
	if (!target) {
		dropUnexpressedInput(container, event)
		return
	}

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement)
}