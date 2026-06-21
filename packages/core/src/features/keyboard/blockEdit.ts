import {KEYBOARD} from '../../shared/constants'
import type {Range} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'value' | 'selection' | 'edit' | 'tokens' | 'props'>
import {createRowContent} from '../block/createRowContent'
import {addDragRow, mergeDragRows, canMergeRows, deleteDragRow} from '../block/operations'
import {consumeMarkupPaste} from '../clipboard'
import type {Token, TokenHandle} from '../tokens'
import {rawRangeFromInputEvent} from './inputRange'

function isTextLikeRow(token: Token): boolean {
	if (token.type === 'text') return true
	return token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

type ActiveRow = {
	handle: TokenHandle
	index: number
}

function rowHandle(store: KbCtx, rowIndex: number): TokenHandle | undefined {
	return store.tokens.handleOf(store.tokens.current()[rowIndex])
}

function findActiveRow(store: KbCtx): ActiveRow | undefined {
	const active = document.activeElement
	if (!active) return undefined
	const handle = store.tokens.handleAt(active)
	if (!handle || handle === 'control') return undefined
	const index = handle.path()[0]
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

	// Fresh read: row positions slice value.current(); tokens() is the reconciled
	// tree consistent with the value, so the cuts hit the right ranges.
	const rows = store.tokens.current()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.value.current()

	if (event.key === KEYBOARD.BACKSPACE) {
		const blockText = 'content' in token ? token.content : ''
		if (blockText === '') {
			event.preventDefault()
			const newValue = deleteDragRow(value, rows, blockIndex)
			const previous = rows.at(Math.max(0, blockIndex - 1))
			const pos = previous ? previous.position.end : 0
			store.edit.replace({start: 0, end: -1}, newValue, pos)
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

	const rows = store.tokens.current()
	const token = rows[blockIndex]
	const value = store.value.current()

	const newRowContent = createRowContent(store.props.options())

	if (!isTextLikeRow(token)) {
		const newValue = addDragRow(value, rows, blockIndex, newRowContent)
		const pos = token.position.end + newRowContent.length
		store.edit.replace({start: 0, end: -1}, newValue, pos)
		return
	}

	const raw = store.selection.readRaw()
	const absolutePos = raw ? raw.range.start : token.position.end
	store.edit.replace({start: absolutePos, end: absolutePos}, newRowContent)
}

function focusRow(store: KbCtx, token: Token, rowIndex: number, caret: 'start' | 'end'): void {
	if (token.type === 'mark') {
		// Bridge the row token by its id to its live handle; placeAtHandle reads
		// the handle's current positions to disambiguate a shared boundary.
		const handle = store.tokens.handleOf(token)
		if (handle && store.selection.placeAtHandle(handle, caret)) return
	}

	const row = rowHandle(store, rowIndex)
	if (!row) return
	row.focus()
	row.placeCaret(caret === 'start' ? 0 : Infinity)
}

function handleBlockArrowLeftRight(store: KbCtx, event: KeyboardEvent, direction: 'left' | 'right'): void {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active
	const rowCount = store.tokens.current().length

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
	const rowCount = store.tokens.current().length

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
	const raw = rawRangeFromInputEvent(store, event)
	if (!raw) return
	const range = rangeForBlockInput(store, event, raw.range)
	if (!range) return

	event.preventDefault()
	store.edit.replace(range, replacement)
}

function rangeForBlockInput(store: KbCtx, event: InputEvent, range: Range): Range | undefined {
	if (!event.inputType.startsWith('delete')) return range
	if (range.start !== range.end) return range

	if (event.inputType.endsWith('Backward') && range.start > 0) {
		return {start: range.start - 1, end: range.start}
	}
	if (event.inputType.endsWith('Forward') && range.end < store.value.current().length) {
		return {start: range.start, end: range.end + 1}
	}
	return undefined
}

function mergeOrFocusNeighbor(
	store: KbCtx,
	event: KeyboardEvent,
	rows: readonly Token[],
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
		store.edit.replace({start: 0, end: -1}, merged.value, merged.caret)
		return
	}
	focusRow(store, rows[toIndex], toIndex, caretOnFocus)
}