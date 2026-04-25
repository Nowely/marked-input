import {htmlChildren, isHtmlElement} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import type {BoundaryPositionResult, RawRange, RawSelectionResult} from '../../shared/editorContracts'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {Caret} from '../caret'
import {consumeMarkupPaste} from '../clipboard'
import {addDragRow, getMergeDragRowJoinPos, mergeDragRows, canMergeRows} from '../drag/operations'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

function isTextLikeRow(token: Token): boolean {
	if (token.type === 'text') return true
	return token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

export function enableBlockEdit(store: Store): () => void {
	const container = store.slots.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'keydown', e => {
			if (!store.slots.isBlock()) return

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
				if (!store.slots.isBlock()) return
				if (e.defaultPrevented) return
				handleBlockBeforeInput(store, e)
			},
			true
		)
	})

	return () => scope()
}

function handleDelete(store: Store, event: KeyboardEvent) {
	const container = store.slots.container()
	if (!container) return

	const blockDivs = htmlChildren(container)
	const blockIndex = blockDivs.findIndex(
		div => div === document.activeElement || div.contains(document.activeElement)
	)
	if (blockIndex === -1) return

	const rows = store.parsing.tokens()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.value.current()

	if (event.key === KEYBOARD.BACKSPACE) {
		const blockDiv = blockDivs[blockIndex]
		const caretAtStart = Caret.getCaretIndex(blockDiv) === 0

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
			store.value.replaceAll(newValue, {
				source: 'block',
				recover: {kind: 'caret', rawPosition: previous ? previous.position.end : 0},
			})
			return
		}

		if (caretAtStart && blockIndex > 0) {
			const prevToken = rows[blockIndex - 1]
			const currToken = rows[blockIndex]
			if (canMergeRows(prevToken, currToken)) {
				event.preventDefault()
				const joinPos = getMergeDragRowJoinPos(rows, blockIndex)
				const newValue = mergeDragRows(value, rows, blockIndex)
				store.value.replaceAll(newValue, {
					source: 'block',
					recover: {kind: 'caret', rawPosition: joinPos},
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex - 1]
				focusRow(store, prevToken, target, 'end')
			})
			return
		}
	}

	if (event.key === KEYBOARD.DELETE) {
		const blockDiv = blockDivs[blockIndex]
		const caretIndex = Caret.getCaretIndex(blockDiv)
		const caretAtEnd = caretIndex === blockDiv.textContent.length
		const caretAtStart = caretIndex === 0

		if (caretAtStart && blockIndex > 0) {
			const prevToken = rows[blockIndex - 1]
			const currToken = rows[blockIndex]
			if (canMergeRows(prevToken, currToken)) {
				event.preventDefault()
				const joinPos = getMergeDragRowJoinPos(rows, blockIndex)
				const newValue = mergeDragRows(value, rows, blockIndex)
				store.value.replaceAll(newValue, {
					source: 'block',
					recover: {kind: 'caret', rawPosition: joinPos},
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex - 1]
				focusRow(store, prevToken, target, 'end')
			})
			return
		}

		if (caretAtEnd && blockIndex < rows.length - 1) {
			const currToken = rows[blockIndex]
			const nextToken = rows[blockIndex + 1]
			if (canMergeRows(currToken, nextToken)) {
				event.preventDefault()
				const joinPos = getMergeDragRowJoinPos(rows, blockIndex + 1)
				const newValue = mergeDragRows(value, rows, blockIndex + 1)
				store.value.replaceAll(newValue, {
					source: 'block',
					recover: {kind: 'caret', rawPosition: joinPos},
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex + 1]
				focusRow(store, nextToken, target, 'start')
			})
			return
		}
	}
}

function handleEnter(store: Store, event: KeyboardEvent) {
	if (event.key !== KEYBOARD.ENTER) return
	if (event.shiftKey) return

	const container = store.slots.container()
	if (!container) return

	const activeElement = document.activeElement
	if (!isHtmlElement(activeElement) || !container.contains(activeElement)) return

	event.preventDefault()

	const blockDivs = htmlChildren(container)
	let blockIndex = -1
	for (let i = 0; i < blockDivs.length; i++) {
		if (blockDivs[i] === activeElement || blockDivs[i].contains(activeElement)) {
			blockIndex = i
			break
		}
	}
	if (blockIndex === -1) return

	const rows = store.parsing.tokens()
	const token = rows[blockIndex]
	const value = store.value.current()

	const newRowContent = createRowContent(store.props.options())

	if (!isTextLikeRow(token)) {
		const newValue = addDragRow(value, rows, blockIndex, newRowContent)
		store.value.replaceAll(newValue, {
			source: 'block',
			recover: {kind: 'caret', rawPosition: token.position.end + newRowContent.length},
		})
		return
	}

	const raw = store.dom.readRawSelection()
	const absolutePos = raw.ok ? raw.value.range.start : token.position.end
	store.value.replaceRange({start: absolutePos, end: absolutePos}, newRowContent, {
		source: 'block',
		recover: {kind: 'caret', rawPosition: absolutePos + newRowContent.length},
	})
}

function focusRow(store: Store, token: Token, row: HTMLElement, caret: 'start' | 'end'): void {
	if (token.type === 'mark') {
		const path = store.parsing.index().pathFor(token)
		const address = path ? store.parsing.index().addressFor(path) : undefined
		if (address && store.caret.focus(address).ok) return
	}

	row.focus()
	if (caret === 'start') {
		Caret.trySetIndex(row, 0)
		return
	}
	Caret.setCaretToEnd(row)
}

function handleBlockArrowLeftRight(store: Store, event: KeyboardEvent, direction: 'left' | 'right'): boolean {
	const container = store.slots.container()
	if (!container) return false

	const activeElement = document.activeElement
	if (!isHtmlElement(activeElement) || !container.contains(activeElement)) return false

	const blockDivs = htmlChildren(container)
	const blockIndex = blockDivs.findIndex(div => div === activeElement || div.contains(activeElement))
	if (blockIndex === -1) return false

	const blockDiv = blockDivs[blockIndex]

	if (direction === 'left') {
		if (Caret.getCaretIndex(blockDiv) !== 0) return false
		if (blockIndex === 0) return true
		event.preventDefault()
		const prevBlock = blockDivs[blockIndex - 1]
		prevBlock.focus()
		Caret.setCaretToEnd(prevBlock)
		return true
	}

	const caretIndex = Caret.getCaretIndex(blockDiv)
	const textLen = blockDiv.textContent.length
	if (caretIndex !== textLen) return false
	if (blockIndex >= blockDivs.length - 1) return true
	event.preventDefault()
	const nextBlock = blockDivs[blockIndex + 1]
	nextBlock.focus()
	Caret.trySetIndex(nextBlock, 0)
	return true
}

function handleArrowUpDown(store: Store, event: KeyboardEvent) {
	const container = store.slots.container()
	if (!container) return

	const activeElement = document.activeElement
	if (!isHtmlElement(activeElement) || !container.contains(activeElement)) return

	const blockDivs = htmlChildren(container)
	const blockIndex = blockDivs.findIndex(div => div === activeElement || div.contains(activeElement))
	if (blockIndex === -1) return

	const blockDiv = blockDivs[blockIndex]

	if (event.key === KEYBOARD.UP) {
		if (!Caret.isCaretOnFirstLine(blockDiv)) return
		if (blockIndex === 0) return

		event.preventDefault()
		const caretRect = Caret.getCaretRect()
		const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
		const prevBlockDiv = blockDivs[blockIndex - 1]
		prevBlockDiv.focus()
		const prevRect = prevBlockDiv.getBoundingClientRect()
		Caret.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)
	} else if (event.key === KEYBOARD.DOWN) {
		if (!Caret.isCaretOnLastLine(blockDiv)) return
		if (blockIndex >= blockDivs.length - 1) return

		event.preventDefault()
		const caretRect = Caret.getCaretRect()
		const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
		const nextBlockDiv = blockDivs[blockIndex + 1]
		nextBlockDiv.focus()
		const nextRect = nextBlockDiv.getBoundingClientRect()
		Caret.setAtX(nextBlockDiv, caretX, nextRect.top + 4)
	}
}

function handleBlockBeforeInput(store: Store, event: InputEvent) {
	const container = store.slots.container()
	if (!container) return

	const activeElement = document.activeElement
	if (!isHtmlElement(activeElement) || !container.contains(activeElement)) return

	const blockDivs = htmlChildren(container)
	const blockIndex = blockDivs.findIndex(div => div === activeElement || div.contains(activeElement))
	if (blockIndex === -1) return

	switch (event.inputType) {
		case 'insertText': {
			const data = event.data ?? ''
			replaceBlockRange(store, event, data)
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			const c = store.slots.container()
			const markup = c ? consumeMarkupPaste(c) : undefined
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

function replaceBlockRange(store: Store, event: InputEvent, replacement: string): void {
	const raw = rawRangeFromInputEvent(store, event)
	if (!raw.ok) return
	const range = rangeForBlockInput(store, event, raw.value.range)
	if (!range) return

	event.preventDefault()
	store.value.replaceRange(range, replacement, {
		source: 'block',
		recover: {kind: 'caret', rawPosition: range.start + replacement.length},
	})
}

function rawRangeFromInputEvent(store: Store, event: InputEvent): RawSelectionResult {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.dom.readRawSelection()
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: Store, range: InputTargetRange): RawSelectionResult {
	const start = store.dom.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
	const end = store.dom.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')
	if (!start.ok) return {ok: false, reason: rawSelectionReason(start)}
	if (!end.ok) return {ok: false, reason: rawSelectionReason(end)}
	return {
		ok: true,
		value: {
			range:
				start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value},
		},
	}
}

function rawSelectionReason(result: BoundaryPositionResult): RawSelectionFailureReason {
	if (result.ok) return 'invalidBoundary'
	if (result.reason === 'composing') return 'invalidBoundary'
	return result.reason
}

function rangeForBlockInput(store: Store, event: InputEvent, range: RawRange): RawRange | undefined {
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