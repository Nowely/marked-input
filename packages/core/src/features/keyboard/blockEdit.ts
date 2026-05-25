import {htmlChildren, isHtmlElement} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import type {Range} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'dom' | 'value' | 'selection' | 'edit' | 'tokens' | 'props'>
import {createRowContent} from '../block/createRowContent'
import {addDragRow, mergeDragRows, canMergeRows} from '../block/operations'
import {consumeMarkupPaste} from '../clipboard'
import type {Token} from '../parsing'
import * as caretDom from '../selection/caretDom'
import {rawRangeFromInputEvent} from './inputRange'

function isTextLikeRow(token: Token): boolean {
	if (token.type === 'text') return true
	return token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

type ActiveBlock = {
	blockDivs: HTMLElement[]
	index: number
	div: HTMLElement
}

function findActiveBlock(container: HTMLElement): ActiveBlock | undefined {
	const active = document.activeElement
	if (!isHtmlElement(active) || !container.contains(active)) return undefined
	const blockDivs = htmlChildren(container)
	const index = blockDivs.findIndex(div => div === active || div.contains(active))
	if (index === -1) return undefined
	return {blockDivs, index, div: blockDivs[index]}
}

export function enableBlockEdit(store: KbCtx, container: HTMLElement): void {
	listen(container, 'keydown', e => {
		if (!store.props.layout.isBlock()) return

		if (e.key === KEYBOARD.LEFT || e.key === KEYBOARD.RIGHT) {
			handleBlockArrowLeftRight(store, container, e, e.key === KEYBOARD.LEFT ? 'left' : 'right')
		} else if (e.key === KEYBOARD.UP || e.key === KEYBOARD.DOWN) {
			handleArrowUpDown(store, container, e)
		}

		handleDelete(store, container, e)
		handleEnter(store, container, e)
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

function handleDelete(store: KbCtx, container: HTMLElement, event: KeyboardEvent) {
	const active = findActiveBlock(container)
	if (!active) return
	const {blockDivs, index: blockIndex} = active

	const rows = store.tokens.current()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.value.current()

	if (event.key === KEYBOARD.BACKSPACE) {
		const blockDiv = blockDivs[blockIndex]
		const caretAtStart = caretDom.getCaretIndex(blockDiv) === 0

		const blockText = 'content' in token ? token.content : ''
		if (blockText === '') {
			event.preventDefault()
			const newValue =
				rows.length <= 1
					? ''
					: (() => {
							if (blockIndex >= rows.length - 1) return value.slice(0, rows[blockIndex - 1].position.end)
							return (
								value.slice(0, rows[blockIndex].position.start) +
								value.slice(rows[blockIndex + 1].position.start)
							)
						})()
			const previous = rows.at(Math.max(0, blockIndex - 1))
			const pos = previous ? previous.position.end : 0
			store.edit.replace({start: 0, end: -1}, newValue, pos)
			return
		}

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex - 1, blockDivs, 'end')
			return
		}
	}

	if (event.key === KEYBOARD.DELETE) {
		const blockDiv = blockDivs[blockIndex]
		const caretIndex = caretDom.getCaretIndex(blockDiv)
		const caretAtEnd = caretIndex === blockDiv.textContent.length
		const caretAtStart = caretIndex === 0

		if (caretAtStart && blockIndex > 0) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex - 1, blockDivs, 'end')
			return
		}

		if (caretAtEnd && blockIndex < rows.length - 1) {
			mergeOrFocusNeighbor(store, event, rows, value, blockIndex, blockIndex + 1, blockDivs, 'start')
			return
		}
	}
}

function handleEnter(store: KbCtx, container: HTMLElement, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	const active = findActiveBlock(container)
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

function focusRow(store: KbCtx, token: Token, row: HTMLElement, caret: 'start' | 'end'): void {
	if (token.type === 'mark') {
		const path = store.tokens.index().pathFor(token)
		const address = path ? store.tokens.index().addressFor(path) : undefined
		if (address && store.selection.placeAtAddress(address, caret)) return
	}

	row.focus()
	if (caret === 'start') {
		caretDom.setAtElement(row, 0)
		return
	}
	caretDom.setAtElement(row, Infinity)
}

function handleBlockArrowLeftRight(
	store: KbCtx,
	container: HTMLElement,
	event: KeyboardEvent,
	direction: 'left' | 'right'
): void {
	const active = findActiveBlock(container)
	if (!active) return
	const {blockDivs, index: blockIndex, div: blockDiv} = active

	if (direction === 'left') {
		if (caretDom.getCaretIndex(blockDiv) !== 0) return
		if (blockIndex === 0) return
		event.preventDefault()
		const prevBlock = blockDivs[blockIndex - 1]
		prevBlock.focus()
		caretDom.setAtElement(prevBlock, Infinity)
		return
	}

	const caretIndex = caretDom.getCaretIndex(blockDiv)
	const textLen = blockDiv.textContent.length
	if (caretIndex !== textLen) return
	if (blockIndex >= blockDivs.length - 1) return
	event.preventDefault()
	const nextBlock = blockDivs[blockIndex + 1]
	nextBlock.focus()
	caretDom.setAtElement(nextBlock, 0)
}

function handleArrowUpDown(store: KbCtx, container: HTMLElement, event: KeyboardEvent) {
	const active = findActiveBlock(container)
	if (!active) return
	const {blockDivs, index: blockIndex, div: blockDiv} = active

	if (event.key === KEYBOARD.UP) {
		if (!caretDom.isOnFirstLine(blockDiv)) return
		if (blockIndex === 0) return

		event.preventDefault()
		const caretRect = caretDom.getRect()
		const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
		const prevBlockDiv = blockDivs[blockIndex - 1]
		prevBlockDiv.focus()
		const prevRect = prevBlockDiv.getBoundingClientRect()
		caretDom.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)
	} else if (event.key === KEYBOARD.DOWN) {
		if (!caretDom.isOnLastLine(blockDiv)) return
		if (blockIndex >= blockDivs.length - 1) return

		event.preventDefault()
		const caretRect = caretDom.getRect()
		const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
		const nextBlockDiv = blockDivs[blockIndex + 1]
		nextBlockDiv.focus()
		const nextRect = nextBlockDiv.getBoundingClientRect()
		caretDom.setAtX(nextBlockDiv, caretX, nextRect.top + 4)
	}
}

function handleBlockBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent) {
	if (!findActiveBlock(container)) return

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
	rows: Token[],
	value: string,
	fromIndex: number,
	toIndex: number,
	blockDivs: HTMLElement[],
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
	focusRow(store, rows[toIndex], blockDivs[toIndex], caretOnFocus)
}