import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'selection' | 'edit' | 'tokens' | 'props'>
import {createRowContent} from '../block/createRowContent'
import {addDragRow, mergeDragRows, canMergeRows, deleteDragRow} from '../block/operations'
import {consumeMarkupPaste} from '../clipboard'
import type {Anchors, NodeAnchor, TokenHandle, TreeNode} from '../tokens'
import {anchorEquals} from '../tokens'
import {anchorsFromInputEvent} from './inputAnchors'

function isTextLikeRow(node: TreeNode): boolean {
	if (node.kind === 'text') return true
	return node.descriptor.hasSlot && node.descriptor.segments.length === 1
}

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

function findActiveRow(store: KbCtx): ActiveRow | undefined {
	const active = document.activeElement
	if (!active) return undefined
	const handle = store.tokens.handleAt(active)
	if (!handle || handle === 'control') return undefined
	// The ROW index off the live tree. `handle.path()` was bind-generation state on a
	// handle that is reused across binds, so it could answer from a stale generation.
	const index = store.tokens.rootIndexOf(handle.id)
	if (index === undefined) return undefined
	const row = rowHandle(store, index)
	if (!row) return undefined
	return {handle: row, index}
}

export function enableBlockEdit(store: KbCtx, container: HTMLElement): void {
	listen(container, 'keydown', e => {
		if (!store.props.layout.isBlock()) return

		if (e.key === KEYBOARD.LEFT || e.key === KEYBOARD.RIGHT) {
			handleBlockArrowLeftRight(store, e, e.key === KEYBOARD.LEFT ? 'left' : 'right')
		} else if (e.key === KEYBOARD.UP || e.key === KEYBOARD.DOWN) {
			handleArrowUpDown(store, e)
		}

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

	// Fresh read: row positions slice value.current(); the live roots are the tree
	// those positions were written into, so the cuts hit the right ranges.
	const rows = store.tokens.nodes()
	if (blockIndex >= rows.length) return

	const row = rows[blockIndex]
	const value = store.tokens.value()

	if (event.key === KEYBOARD.BACKSPACE) {
		// The ROW's own projection, which for a mark row is its whole markup — the
		// `Token.content` this used to read, and NOT `node.text()`: every block row is a
		// mark, so a text-only reading would make plain Backspace delete the row.
		const blockText = store.tokens.valueBetween({before: row}, {after: row})
		if (blockText === '') {
			event.preventDefault()
			const newValue = deleteDragRow(value, rows, blockIndex)
			const previous = rows.at(Math.max(0, blockIndex - 1))
			const pos = previous ? previous.position.end : 0
			store.edit.setValue(newValue, pos)
			return
		}

		const caretAtStart = (handle.caretIndex() ?? 0) === 0

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex - 1, 'end')
			return
		}
	}

	if (event.key === KEYBOARD.DELETE) {
		const caretIndex = handle.caretIndex() ?? 0
		const caretAtEnd = caretIndex === handle.textLength()
		const caretAtStart = caretIndex === 0

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex - 1, 'end')
			return
		}

		if (caretAtEnd && blockIndex < rows.length - 1) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex + 1, 'start')
			return
		}
	}
}

function handleEnter(store: KbCtx, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	const active = findActiveRow(store)
	if (!active) return

	event.preventDefault()
	const {index: blockIndex} = active

	const rows = store.tokens.nodes()
	const row = rows[blockIndex]
	const value = store.tokens.value()

	const newRowContent = createRowContent(store.props.options())

	if (!isTextLikeRow(row)) {
		const newValue = addDragRow(value, rows, blockIndex, newRowContent)
		const pos = row.position.end + newRowContent.length
		store.edit.setValue(newValue, pos)
		return
	}

	// The caret, or — with no readable DOM selection — the end of the row this Enter
	// split. `{after: row}` IS `row.position.end` without forming the offset.
	const at: NodeAnchor = store.selection.domAnchors()?.anchor ?? {after: row}
	store.edit.replace(at, at, newRowContent)
}

function focusRow(store: KbCtx, row: TreeNode, rowIndex: number, caret: 'start' | 'end'): void {
	if (row.kind === 'mark') {
		// placeAtHandle reads the handle's current positions to disambiguate a shared boundary.
		const handle = store.tokens.handle(row.id)
		if (handle && store.selection.placeAtHandle(handle, caret)) return
	}

	const handle = rowHandle(store, rowIndex)
	if (!handle) return
	handle.focus()
	handle.placeCaret(caret === 'start' ? 0 : Infinity)
}

function handleBlockArrowLeftRight(store: KbCtx, event: KeyboardEvent, direction: 'left' | 'right'): void {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active
	const rowCount = store.tokens.nodes().length

	if (direction === 'left') {
		if ((handle.caretIndex() ?? 0) !== 0) return
		if (blockIndex === 0) return
		event.preventDefault()
		const prev = rowHandle(store, blockIndex - 1)
		if (!prev) return
		prev.focus()
		prev.placeCaret(Infinity)
		return
	}

	if ((handle.caretIndex() ?? 0) !== handle.textLength()) return
	if (blockIndex >= rowCount - 1) return
	event.preventDefault()
	const next = rowHandle(store, blockIndex + 1)
	if (!next) return
	next.focus()
	next.placeCaret(0)
}

function handleArrowUpDown(store: KbCtx, event: KeyboardEvent) {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active
	const rowCount = store.tokens.nodes().length

	if (event.key === KEYBOARD.UP) {
		if (!handle.caretOnFirstLine()) return
		if (blockIndex === 0) return

		event.preventDefault()
		const caretX = store.tokens.selection()?.rect?.left ?? handle.rect()?.left ?? 0
		const prev = rowHandle(store, blockIndex - 1)
		if (!prev) return
		prev.focus()
		const prevRect = prev.rect()
		prev.placeCaretAtX(caretX, prevRect ? prevRect.bottom - 4 : undefined)
	} else if (event.key === KEYBOARD.DOWN) {
		if (!handle.caretOnLastLine()) return
		if (blockIndex >= rowCount - 1) return

		event.preventDefault()
		const caretX = store.tokens.selection()?.rect?.left ?? handle.rect()?.left ?? 0
		const next = rowHandle(store, blockIndex + 1)
		if (!next) return
		next.focus()
		const nextRect = next.rect()
		next.placeCaretAtX(caretX, nextRect ? nextRect.top + 4 : undefined)
	}
}

function handleBlockBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent) {
	if (!findActiveRow(store)) return

	switch (event.inputType) {
		case 'insertText': {
			const data = event.data ?? ''
			replaceBlockRange(store, event, data)
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			const markup = consumeMarkupPaste(container)
			const pasteData = markup ?? event.dataTransfer?.getData('text/plain') ?? ''
			replaceBlockRange(store, event, pasteData)
			break
		}
		case 'deleteContentBackward':
		case 'deleteContentForward':
		case 'deleteWordBackward':
		case 'deleteWordForward':
		case 'deleteSoftLineBackward':
		case 'deleteSoftLineForward': {
			replaceBlockRange(store, event, '')
			break
		}
	}
}

function replaceBlockRange(store: KbCtx, event: InputEvent, replacement: string): void {
	const anchors = anchorsFromInputEvent(store, event)
	if (!anchors) return
	const target = anchorsForBlockInput(store, event, anchors)
	if (!target) return

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement)
}

/**
 * No mark-swallow arm, unlike `input.ts`: every block row IS a mark, so expanding onto the
 * adjacent one would delete a whole row on a plain Backspace. Row-level deletes are
 * {@link handleDelete}'s, and it preventDefaults before this ever runs.
 */
function anchorsForBlockInput(store: KbCtx, event: InputEvent, anchors: Anchors): Anchors | undefined {
	if (!event.inputType.startsWith('delete')) return anchors
	if (!anchorEquals(anchors.anchor, anchors.head)) return anchors

	const direction = event.inputType.endsWith('Backward') ? -1 : 1
	const stepped = store.tokens.step(anchors.anchor, direction)
	if (!stepped) return undefined
	return direction === -1 ? {anchor: stepped, head: anchors.head} : {anchor: anchors.anchor, head: stepped}
}

function mergeOrFocusNeighbor(
	store: KbCtx,
	event: KeyboardEvent,
	rows: readonly TreeNode[],
	value: string,
	fromIndex: number,
	toIndex: number,
	caretOnFocus: 'start' | 'end'
): void {
	const joinIndex = Math.max(fromIndex, toIndex)
	const a = rows[Math.min(fromIndex, toIndex)]
	const b = rows[joinIndex]
	event.preventDefault()
	if (canMergeRows(a, b)) {
		const merged = mergeDragRows(value, rows, joinIndex)
		store.edit.setValue(merged.value, merged.caret)
		return
	}
	focusRow(store, rows[toIndex], toIndex, caretOnFocus)
}