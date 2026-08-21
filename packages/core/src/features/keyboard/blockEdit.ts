import {nodeTarget} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'tokens' | 'props'>
import {consumeMarkupPaste} from '../clipboard'
import type {NodeAnchor, TokenHandle, TreeNode} from '../tokens'
import {anchorsForInput, anchorsFromInputEvent, dropUnexpressedInput, isConsumerKeyOrigin} from './beforeInput'

type ActiveRow = {
	handle: TokenHandle
	index: number
}

function rowHandle(store: KbCtx, rowIndex: number): TokenHandle | undefined {
	// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
	// `TreeNode` and the out-of-range guard is linted away as an impossible condition.
	// Every caller passes a non-negative index, so `.at`'s wrap-around cannot fire.
	const row = store.tokens.nodes().at(rowIndex)
	return row && store.tokens.handle(row.id)
}

/** The anchor's own node — the tree identity every anchor form carries except the document edges. */
function anchorOwner(anchor: NodeAnchor): TreeNode | undefined {
	if (typeof anchor === 'string') return undefined
	if ('node' in anchor) return anchor.node
	if ('before' in anchor) return anchor.before
	return anchor.after
}

/** The row an anchor names: the root its node belongs to, as handle + index. */
function rowFromAnchor(store: KbCtx, anchor: NodeAnchor | undefined): ActiveRow | undefined {
	if (!anchor) return undefined
	const owner = anchorOwner(anchor)
	if (!owner) return undefined
	const index = store.tokens.rootIndexOf(owner.id)
	if (index === undefined) return undefined
	const handle = rowHandle(store, index)
	return handle && {handle, index}
}

function findActiveRow(store: KbCtx): ActiveRow | undefined {
	// THE two tiers, and the only ones: row identity is the selection's. DOM truth first;
	// stored anchors cover the cases the DOM cannot answer — no window selection at all, or a
	// range this layer declines to resolve.
	//
	// That reason is NARROWER than the one written here before ADR-0008, and the old one was
	// wrong: it claimed tier two covered the pendingStructural window, but `rowFromAnchor`
	// ends at `tokens.handle`, which the latch refused for EVERY id — so both tiers returned
	// undefined there and the fallback bought nothing. With the latch gone tier two does now
	// answer mid-window, for a row whose node survived the commit.
	//
	// (The third tier read `document.activeElement` back when each row was its own host and
	// focus alone could name one. Under the single host activeElement is always the
	// container, which owns no row.)
	return (
		rowFromAnchor(store, store.tokens.domAnchors()?.anchor) ??
		rowFromAnchor(store, store.tokens.selection.anchors()?.anchor)
	)
}

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
		handleEnter(store, e)
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

function handleDelete(store: KbCtx, event: KeyboardEvent) {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active

	const rows = store.tokens.nodes()
	const row = rows[blockIndex]

	if (event.key === KEYBOARD.BACKSPACE) {
		// The ROW's own projection, which for a mark row is its whole markup — the
		// `Token.content` this used to read, and NOT `node.text()`: every block row is a
		// mark, so a text-only reading would make plain Backspace delete the row.
		const blockText = store.tokens.valueBetween({before: row}, {after: row})
		if (blockText === '') {
			event.preventDefault()
			row.remove()
			return
		}

		const caretAtStart = (handle.caretIndex() ?? 0) === 0

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, blockIndex, blockIndex - 1, 'end')
			return
		}
	}

	if (event.key === KEYBOARD.DELETE) {
		const caretIndex = handle.caretIndex() ?? 0
		const caretAtEnd = caretIndex === handle.textLength()
		const caretAtStart = caretIndex === 0

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, blockIndex, blockIndex - 1, 'end')
			return
		}

		if (caretAtEnd && blockIndex < rows.length - 1) {
			mergeOrFocusNeighbor(store, event, rows, blockIndex, blockIndex + 1, 'start')
			return
		}
	}
}

function handleEnter(store: KbCtx, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	// Everything selected: Enter REPLACES the document with one fresh row — the block
	// analogue of inline's whole-value replace. Ahead of the row lookup, which would
	// resolve the single row the selection merely STARTS in and split that one instead,
	// appending an empty row while keeping everything selected.
	if (store.tokens.selection.isAllSelected()) {
		event.preventDefault()
		// An empty document IS one empty row (issue 08's trailing convention), so the block
		// analogue of inline's whole-value replace needs no row content at all.
		store.tokens.setValueEnteringRoot('', 0)
		return
	}

	const active = findActiveRow(store)
	if (!active) return

	event.preventDefault()
	const {index: blockIndex} = active

	const rows = store.tokens.nodes()
	const row = rows[blockIndex]

	// ONE arm (issue 08): Enter inserts the separator at the caret and reparse forms the
	// rows — no row content is composed, no markup consulted. The fallback with no
	// readable DOM selection is the end of this row: `{after: row}` sits past its own
	// separator, so the fresh empty row lands directly after it.
	const at: NodeAnchor = store.tokens.domAnchors()?.anchor ?? {after: row}
	store.edit.replace(at, at, store.props.separator())
}

function focusRow(store: KbCtx, rowIndex: number, caret: 'start' | 'end'): void {
	// No focus call ahead of the placement: `placeCaret` focuses the editing host itself,
	// and under one host that host is the container either way.
	rowHandle(store, rowIndex)?.placeCaret(caret === 'start' ? 0 : Infinity)
}

function handleBlockBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent) {
	const target = nodeTarget(event)
	// TWO verdicts, not one. A control root is consumer chrome that owns its own input, so
	// its event passes through untouched. "No resolvable row" is the opposite: the event
	// still targets model-owned DOM (Enter would split it into a <div> the tree never
	// sanctioned — `handleEnter` bails on the same missing row, and `input.ts` has already
	// returned on `isBlock`), so it fails closed like every other unexpressed edit.
	if (target && store.tokens.handleAt(target) === 'control') return
	if (!findActiveRow(store)) {
		dropUnexpressedInput(container, event)
		return
	}

	switch (event.inputType) {
		case 'insertText': {
			const data = event.data ?? ''
			replaceBlockRange(store, container, event, data)
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			const markup = consumeMarkupPaste(container)
			const pasteData = markup ?? event.dataTransfer?.getData('text/plain') ?? ''
			replaceBlockRange(store, container, event, pasteData)
			break
		}
		case 'deleteContentBackward':
		case 'deleteContentForward':
		case 'deleteWordBackward':
		case 'deleteWordForward':
		case 'deleteSoftLineBackward':
		case 'deleteSoftLineForward': {
			replaceBlockRange(store, container, event, '')
			break
		}
		// PARITY with `input.ts`'s `replacementForInput`, which the closed default below
		// would otherwise turn into a silent drop. Shift+Enter is a newline INSIDE the row
		// (plain Enter never reaches here — `handleEnter` cancels its keydown and splits
		// the row instead).
		case 'insertLineBreak': {
			replaceBlockRange(store, container, event, '\n')
			break
		}
		case 'insertFromDrop': {
			replaceBlockRange(store, container, event, event.dataTransfer?.getData('text/plain') ?? '')
			break
		}
		// FAIL CLOSED, same contract as `input.ts`: block rows live in the SAME single
		// host, so an input type this switch cannot express would edit model-owned DOM.
		// Enter is not among the cases because `handleEnter` already cancelled its
		// keydown, so no `insertParagraph` reaches this at all.
		default:
			dropUnexpressedInput(container, event)
	}
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

function mergeOrFocusNeighbor(
	store: KbCtx,
	event: KeyboardEvent,
	rows: readonly TreeNode[],
	fromIndex: number,
	toIndex: number,
	caretOnFocus: 'start' | 'end'
): void {
	const a = rows[Math.min(fromIndex, toIndex)]
	const b = rows[Math.max(fromIndex, toIndex)]
	event.preventDefault()
	// The verb ANSWERS whether the pair had a boundary to remove, so the separate
	// `canMergeRows` predicate is gone: asking and then doing was two readings of one question.
	if (a.mergeWith(b)) return
	focusRow(store, toIndex, caretOnFocus)
}