import {childAt, htmlChildren, isHtmlElement} from '../../shared/checkers'
import {KEYBOARD} from '../../shared/constants'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {Caret} from '../caret'
import {consumeMarkupPaste} from '../clipboard'
import {addDragRow, getMergeDragRowJoinPos, mergeDragRows, canMergeRows} from '../drag/operations'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'
import {getCaretRawPosInBlock, getDomRawPos, setCaretAtRawPos} from './rawPosition'

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
	const value = store.value.currentValue()
	if (!store.props.onChange()) return

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
			store.value.innerValue(newValue)
			queueMicrotask(() => {
				const targetIndex = Math.max(0, blockIndex - 1)
				const target = childAt(container, targetIndex)
				if (target) {
					target.focus()
					Caret.setCaretToEnd(target)
				}
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
				store.value.innerValue(newValue)
				queueMicrotask(() => {
					const target = childAt(container, blockIndex - 1)
					if (target) {
						target.focus()
						const updatedRows = store.parsing.tokens()
						const updatedToken = updatedRows[blockIndex - 1]
						setCaretAtRawPos(target, updatedToken, joinPos)
					}
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex - 1]
				target.focus()
				if (prevToken.type !== 'mark') Caret.setCaretToEnd(target)
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
				store.value.innerValue(newValue)
				queueMicrotask(() => {
					const target = childAt(container, blockIndex - 1)
					if (target) {
						target.focus()
						const updatedRows = store.parsing.tokens()
						const updatedToken = updatedRows[blockIndex - 1]
						setCaretAtRawPos(target, updatedToken, joinPos)
					}
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex - 1]
				target.focus()
				if (prevToken.type !== 'mark') Caret.setCaretToEnd(target)
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
				store.value.innerValue(newValue)
				queueMicrotask(() => {
					const target = childAt(container, blockIndex)
					if (target) {
						target.focus()
						const updatedRows = store.parsing.tokens()
						const updatedToken = updatedRows[blockIndex]
						setCaretAtRawPos(target, updatedToken, joinPos)
					}
				})
				return
			}
			event.preventDefault()
			queueMicrotask(() => {
				const target = blockDivs[blockIndex + 1]
				target.focus()
				Caret.trySetIndex(target, 0)
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
	const blockDiv = blockDivs[blockIndex]
	const value = store.value.currentValue()

	if (!store.props.onChange()) return

	const newRowContent = createRowContent(store.props.options())

	if (!isTextLikeRow(token)) {
		const newValue = addDragRow(value, rows, blockIndex, newRowContent)
		store.value.innerValue(newValue)
		queueMicrotask(() => {
			const newBlockIndex = blockIndex + 1
			if (newBlockIndex < container.children.length) {
				const newBlockEl = childAt(container, newBlockIndex)
				if (newBlockEl) {
					newBlockEl.focus()
					Caret.trySetIndex(newBlockEl, 0)
				}
			}
		})
		return
	}

	const absolutePos = getCaretRawPosInBlock(blockDiv, token)
	const newValue = value.slice(0, absolutePos) + newRowContent + value.slice(absolutePos)
	store.value.innerValue(newValue)

	queueMicrotask(() => {
		const newBlockIndex = blockIndex + 1
		if (newBlockIndex < container.children.length) {
			const newBlockEl = childAt(container, newBlockIndex)
			if (newBlockEl) {
				newBlockEl.focus()
				Caret.trySetIndex(newBlockEl, 0)
			}
		}
	})
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

	const blockDiv = blockDivs[blockIndex]
	const rows = store.parsing.tokens()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.value.currentValue()

	const focusAndSetCaret = (newRawPos: number) => {
		queueMicrotask(() => {
			const target = childAt(container, blockIndex)
			if (!target) return
			target.focus()
			const updatedRows = store.parsing.tokens()
			const updatedToken = updatedRows[blockIndex]
			setCaretAtRawPos(target, updatedToken, newRawPos)
		})
	}

	switch (event.inputType) {
		case 'insertText': {
			event.preventDefault()
			const data = event.data ?? ''
			const ranges = event.getTargetRanges()
			let rawFrom: number
			let rawTo: number
			if (ranges.length > 0) {
				const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, token)
				const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, token)
				;[rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			} else {
				rawFrom = rawTo = getCaretRawPosInBlock(blockDiv, token)
			}
			store.value.innerValue(value.slice(0, rawFrom) + data + value.slice(rawTo))
			focusAndSetCaret(rawFrom + data.length)
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			event.preventDefault()
			const c = store.slots.container()
			const markup = c ? consumeMarkupPaste(c) : undefined
			const pasteData = markup ?? event.dataTransfer?.getData('text/plain') ?? ''
			const ranges = event.getTargetRanges()
			let rawFrom: number
			let rawTo: number
			if (ranges.length > 0) {
				const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, token)
				const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, token)
				;[rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			} else {
				rawFrom = rawTo = getCaretRawPosInBlock(blockDiv, token)
			}
			store.value.innerValue(value.slice(0, rawFrom) + pasteData + value.slice(rawTo))
			focusAndSetCaret(rawFrom + pasteData.length)
			break
		}
		case 'deleteContentBackward':
		case 'deleteContentForward':
		case 'deleteWordBackward':
		case 'deleteWordForward':
		case 'deleteSoftLineBackward':
		case 'deleteSoftLineForward': {
			const ranges = event.getTargetRanges()
			if (!ranges.length) return
			const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, token)
			const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, token)
			const [rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			if (rawFrom === rawTo) return
			event.preventDefault()
			store.value.innerValue(value.slice(0, rawFrom) + value.slice(rawTo))
			focusAndSetCaret(rawFrom)
			break
		}
	}
}