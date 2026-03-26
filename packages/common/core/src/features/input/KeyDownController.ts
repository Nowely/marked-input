import type {NodeProxy} from '../../shared/classes'
import {KEYBOARD} from '../../shared/constants'
import {Caret} from '../caret'
import {addDragRow, getMergeDragRowJoinPos, mergeDragRows, canMergeRows} from '../drag/operations'
import {deleteMark} from '../editing'
import {shiftFocusNext, shiftFocusPrev} from '../navigation'
import type {MarkToken, Token} from '../parsing'
import {annotate} from '../parsing'
import {isFullSelection, selectAllText} from '../selection'
import type {Store} from '../store/Store'

function isTextLikeRow(token: Token): boolean {
	if (token.type === 'text') return true
	return token.type === 'mark' && token.descriptor.hasSlot && token.descriptor.segments.length === 1
}

export class KeyDownController {
	#keydownHandler?: (e: KeyboardEvent) => void
	#pasteHandler?: (e: ClipboardEvent) => void
	#beforeInputHandler?: (e: InputEvent) => void

	constructor(private store: Store) {}

	#createRowContent(): string {
		const firstOption = this.store.state.options.get()?.[0]
		if (!firstOption?.markup) return '\n'
		return annotate(firstOption.markup, {value: '', slot: '', meta: ''})
	}

	enable() {
		if (this.#keydownHandler) return

		const container = this.store.refs.container
		if (!container) return

		this.#keydownHandler = e => {
			if (e.key === KEYBOARD.LEFT) {
				if (!this.#handleBlockArrowLeftRight(e, 'left')) shiftFocusPrev(this.store, e)
			} else if (e.key === KEYBOARD.RIGHT) {
				if (!this.#handleBlockArrowLeftRight(e, 'right')) shiftFocusNext(this.store, e)
			} else if (e.key === KEYBOARD.UP || e.key === KEYBOARD.DOWN) {
				this.#handleArrowUpDown(e)
			}

			this.#handleDelete(e)
			this.#handleEnter(e)
			selectAllText(this.store, e)
		}

		this.#pasteHandler = e => {
			handlePaste(this.store, e)
		}

		this.#beforeInputHandler = e => {
			handleBeforeInput(this.store, e)
		}

		container.addEventListener('keydown', this.#keydownHandler)
		container.addEventListener('paste', this.#pasteHandler)
		container.addEventListener('beforeinput', this.#beforeInputHandler, true)
	}

	disable() {
		const container = this.store.refs.container
		if (!container || !this.#keydownHandler) return

		container.removeEventListener('keydown', this.#keydownHandler)
		container.removeEventListener('paste', this.#pasteHandler!)
		container.removeEventListener('beforeinput', this.#beforeInputHandler!, true)

		this.#keydownHandler = undefined
		this.#pasteHandler = undefined
		this.#beforeInputHandler = undefined
	}

	#handleDelete(event: KeyboardEvent) {
		const {focus} = this.store.nodes
		const isDragMode = !!this.store.state.drag.get()

		// Mark/span deletion only applies in non-drag mode.
		// In drag mode the focus target is a block div, not a span/mark.
		if (!isDragMode && (event.key === KEYBOARD.DELETE || event.key === KEYBOARD.BACKSPACE)) {
			if (focus.isMark) {
				if (focus.isEditable) {
					if (event.key === KEYBOARD.BACKSPACE && !focus.isCaretAtBeginning) return
					if (event.key === KEYBOARD.DELETE && !focus.isCaretAtEnd) return
				}
				event.preventDefault()
				deleteMark('self', this.store)
				return
			}

			if (event.key === KEYBOARD.BACKSPACE) {
				if (focus.isSpan && focus.isCaretAtBeginning && focus.prev.target) {
					event.preventDefault()
					deleteMark('prev', this.store)
					return
				}
			}

			if (event.key === KEYBOARD.DELETE) {
				if (focus.isSpan && focus.isCaretAtEnd && focus.next.target) {
					event.preventDefault()
					deleteMark('next', this.store)
					return
				}
			}
		}

		if (!isDragMode) return

		const container = this.store.refs.container
		if (!container) return

		const blockDivs = Array.from(container.children)
		const blockIndex = blockDivs.findIndex(
			div => div === document.activeElement || div.contains(document.activeElement as Node)
		)
		if (blockIndex === -1) return

		const rows = this.store.state.tokens.get()
		if (blockIndex >= rows.length) return

		const token = rows[blockIndex]
		const value = this.store.state.previousValue.get() ?? this.store.state.value.get() ?? ''
		if (!this.store.state.onChange.get()) return

		if (event.key === KEYBOARD.BACKSPACE) {
			const blockDiv = blockDivs[blockIndex] as HTMLElement
			const caretAtStart = Caret.getCaretIndex(blockDiv) === 0

			const blockText = 'content' in token ? token.content : ''
			if (blockText === '') {
				event.preventDefault()
				const newValue =
					rows.length <= 1
						? ''
						: (() => {
								if (blockIndex >= rows.length - 1)
									return value.slice(0, rows[blockIndex - 1].position.end)
								return (
									value.slice(0, rows[blockIndex].position.start) +
									value.slice(rows[blockIndex + 1].position.start)
								)
							})()
				this.store.applyValue(newValue)
				queueMicrotask(() => {
					const newDivs = container.children
					const targetIndex = Math.max(0, blockIndex - 1)
					const target = newDivs[targetIndex] as HTMLElement | undefined
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
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex - 1] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedRows = this.store.state.tokens.get()
							const updatedToken = updatedRows[blockIndex - 1]
							if (updatedToken) setCaretAtRawPos(target, updatedToken, joinPos)
						}
					})
					return
				}
				event.preventDefault()
				queueMicrotask(() => {
					const target = blockDivs[blockIndex - 1] as HTMLElement | undefined
					if (target) {
						target.focus()
						Caret.setCaretToEnd(target)
					}
				})
				return
			}
		}

		if (event.key === KEYBOARD.DELETE) {
			const blockDiv = blockDivs[blockIndex] as HTMLElement
			const caretIndex = Caret.getCaretIndex(blockDiv)
			const caretAtEnd = caretIndex === blockDiv.textContent?.length
			const caretAtStart = caretIndex === 0

			if (caretAtStart && blockIndex > 0) {
				const prevToken = rows[blockIndex - 1]
				const currToken = rows[blockIndex]
				if (canMergeRows(prevToken, currToken)) {
					event.preventDefault()
					const joinPos = getMergeDragRowJoinPos(rows, blockIndex)
					const newValue = mergeDragRows(value, rows, blockIndex)
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex - 1] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedRows = this.store.state.tokens.get()
							const updatedToken = updatedRows[blockIndex - 1]
							if (updatedToken) setCaretAtRawPos(target, updatedToken, joinPos)
						}
					})
					return
				}
				event.preventDefault()
				queueMicrotask(() => {
					const target = blockDivs[blockIndex - 1] as HTMLElement | undefined
					if (target) {
						target.focus()
						Caret.setCaretToEnd(target)
					}
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
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedRows = this.store.state.tokens.get()
							const updatedToken = updatedRows[blockIndex]
							if (updatedToken) setCaretAtRawPos(target, updatedToken, joinPos)
						}
					})
					return
				}
				event.preventDefault()
				queueMicrotask(() => {
					const target = blockDivs[blockIndex + 1] as HTMLElement | undefined
					if (target) {
						target.focus()
						Caret.trySetIndex(target, 0)
					}
				})
				return
			}
		}
	}

	#handleEnter(event: KeyboardEvent) {
		const isDragMode = !!this.store.state.drag.get()
		if (!isDragMode) return
		if (event.key !== KEYBOARD.ENTER) return
		if (event.shiftKey) return

		const container = this.store.refs.container
		if (!container) return

		const activeElement = document.activeElement as HTMLElement | null
		if (!activeElement || !container.contains(activeElement)) return

		event.preventDefault()

		const blockDivs = container.children
		let blockIndex = -1
		for (let i = 0; i < blockDivs.length; i++) {
			if (blockDivs[i] === activeElement || blockDivs[i].contains(activeElement)) {
				blockIndex = i
				break
			}
		}
		if (blockIndex === -1) return

		const rows = this.store.state.tokens.get()
		const token = rows[blockIndex]
		if (!token) return
		const blockDiv = blockDivs[blockIndex] as HTMLElement
		const value = this.store.state.previousValue.get() ?? this.store.state.value.get() ?? ''

		if (!this.store.state.onChange.get()) return

		const newRowContent = this.#createRowContent()

		if (!isTextLikeRow(token)) {
			const newValue = addDragRow(value, rows, blockIndex, newRowContent)
			this.store.applyValue(newValue)
			queueMicrotask(() => {
				const newBlockDivs = container.children
				const newBlockIndex = blockIndex + 1
				if (newBlockIndex < newBlockDivs.length) {
					const newBlockEl = newBlockDivs[newBlockIndex] as HTMLElement
					newBlockEl.focus()
					Caret.trySetIndex(newBlockEl, 0)
				}
			})
			return
		}

		const absolutePos = getCaretRawPosInBlock(blockDiv, token)
		const newValue = value.slice(0, absolutePos) + newRowContent + value.slice(absolutePos)
		this.store.applyValue(newValue)

		queueMicrotask(() => {
			const newBlockDivs = container.children
			const newBlockIndex = blockIndex + 1
			if (newBlockIndex < newBlockDivs.length) {
				const newBlockEl = newBlockDivs[newBlockIndex] as HTMLElement
				newBlockEl.focus()
				Caret.trySetIndex(newBlockEl, 0)
			}
		})
	}

	#handleBlockArrowLeftRight(event: KeyboardEvent, direction: 'left' | 'right'): boolean {
		if (!this.store.state.drag.get()) return false

		const container = this.store.refs.container
		if (!container) return false

		const activeElement = document.activeElement as HTMLElement | null
		if (!activeElement || !container.contains(activeElement)) return false

		const blockDivs = Array.from(container.children) as HTMLElement[]
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
		const textLen = blockDiv.textContent?.length ?? 0
		if (caretIndex !== textLen) return false
		if (blockIndex >= blockDivs.length - 1) return true
		event.preventDefault()
		const nextBlock = blockDivs[blockIndex + 1]
		nextBlock.focus()
		Caret.trySetIndex(nextBlock, 0)
		return true
	}

	#handleArrowUpDown(event: KeyboardEvent) {
		if (!this.store.state.drag.get()) return

		const container = this.store.refs.container
		if (!container) return

		const activeElement = document.activeElement as HTMLElement | null
		if (!activeElement || !container.contains(activeElement)) return

		const blockDivs = Array.from(container.children)
		const blockIndex = blockDivs.findIndex(div => div === activeElement || div.contains(activeElement))
		if (blockIndex === -1) return

		const blockDiv = blockDivs[blockIndex] as HTMLElement

		if (event.key === KEYBOARD.UP) {
			if (!Caret.isCaretOnFirstLine(blockDiv)) return
			if (blockIndex === 0) return

			event.preventDefault()
			const caretRect = Caret.getCaretRect()
			const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
			const prevBlockDiv = blockDivs[blockIndex - 1] as HTMLElement
			prevBlockDiv.focus()
			const prevRect = prevBlockDiv.getBoundingClientRect()
			Caret.setAtX(prevBlockDiv, caretX, prevRect.bottom - 4)
		} else if (event.key === KEYBOARD.DOWN) {
			if (!Caret.isCaretOnLastLine(blockDiv)) return
			if (blockIndex >= blockDivs.length - 1) return

			event.preventDefault()
			const caretRect = Caret.getCaretRect()
			const caretX = caretRect?.left ?? blockDiv.getBoundingClientRect().left
			const nextBlockDiv = blockDivs[blockIndex + 1] as HTMLElement
			nextBlockDiv.focus()
			const nextRect = nextBlockDiv.getBoundingClientRect()
			Caret.setAtX(nextBlockDiv, caretX, nextRect.top + 4)
		}
	}
}

/**
 * Computes the raw value offset (index into the full value string) corresponding
 * to the current caret position within `blockDiv`.
 *
 * Delegates to `getDomRawPos` using the current selection's focus node and offset.
 */
function getCaretRawPosInBlock(blockDiv: HTMLElement, token: Token): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return token.position.end

	const {focusNode, focusOffset} = selection
	if (!focusNode) return token.position.end

	return getDomRawPos(focusNode, focusOffset, blockDiv, token)
}

export function handleBeforeInput(store: Store, event: InputEvent): void {
	const selecting = store.state.selecting.get()
	if (selecting === 'all' && isFullSelection(store)) {
		if (event.inputType === 'insertFromPaste') {
			event.preventDefault()
			return
		}
		event.preventDefault()
		const newContent = event.inputType.startsWith('delete') ? '' : (event.data ?? '')
		replaceAllContentWith(store, newContent)
		return
	}
	if (selecting === 'all') store.state.selecting.set(undefined)

	// In drag mode the focus target is a block div, not a text span.
	// Block-level keys (Enter, Backspace, Delete) are handled by KeyDownController.
	// Text insertions and in-block deletions need special handling to update state.
	if (store.state.drag.get()) {
		handleBlockBeforeInput(store, event)
		return
	}

	const {focus} = store.nodes
	if (!focus.target || !focus.isEditable) return

	if (applySpanInput(focus, event)) {
		store.events.change()
	}
}

export function applySpanInput(focus: NodeProxy, event: InputEvent): boolean {
	const offset = focus.caret
	const content = focus.content
	let newContent: string
	let newCaret: number

	switch (event.inputType) {
		case 'insertText': {
			event.preventDefault()
			const data = event.data ?? ''
			newContent = content.slice(0, offset) + data + content.slice(offset)
			newCaret = offset + data.length
			break
		}
		case 'deleteContentBackward':
		case 'deleteContentForward':
		case 'deleteWordBackward':
		case 'deleteWordForward':
		case 'deleteSoftLineBackward':
		case 'deleteSoftLineForward': {
			const ranges = event.getTargetRanges()
			if (!ranges.length) return false
			const {startOffset, endOffset} = ranges[0]
			if (startOffset === endOffset) return false
			event.preventDefault()
			newContent = content.slice(0, startOffset) + content.slice(endOffset)
			newCaret = startOffset
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			const text = event.dataTransfer?.getData('text/plain') ?? ''
			const ranges = event.getTargetRanges()
			const start = ranges[0]?.startOffset ?? offset
			const end = ranges[0]?.endOffset ?? offset
			event.preventDefault()
			newContent = content.slice(0, start) + text + content.slice(end)
			newCaret = start + text.length
			break
		}
		default:
			return false
	}

	focus.content = newContent
	focus.caret = newCaret
	return true
}

export function handlePaste(store: Store, event: ClipboardEvent): void {
	const selecting = store.state.selecting.get()
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.state.selecting.set(undefined)
		return
	}

	event.preventDefault()
	const newContent = event.clipboardData?.getData('text/plain') ?? ''
	replaceAllContentWith(store, newContent)
}

export function replaceAllContentWith(store: Store, newContent: string): void {
	store.nodes.focus.target = null
	store.state.selecting.set(undefined)

	store.state.onChange.get()?.(newContent)

	if (store.state.value.get() === undefined) {
		store.state.tokens.set(
			store.state.parser.get()?.parse(newContent) ?? [
				{
					type: 'text' as const,
					content: newContent,
					position: {start: 0, end: newContent.length},
				},
			]
		)
	}

	queueMicrotask(() => {
		const firstChild = store.refs.container?.firstChild as HTMLElement | null
		if (firstChild) {
			store.state.recovery.set({
				anchor: store.nodes.focus,
				caret: newContent.length,
			})
			firstChild.focus()
		}
	})
}

/**
 * Handles `beforeinput` events when the editor is in drag mode.
 * Intercepts text insertion and in-block deletion to update the raw value via
 * `store.applyValue`, since `applySpanInput` is designed for span-level editing only.
 * Block-level operations (Enter, Backspace/Delete at boundaries) are handled by
 * `KeyDownController` via `keydown` events.
 */
function handleBlockBeforeInput(store: Store, event: InputEvent): void {
	const container = store.refs.container
	if (!container) return

	const activeElement = document.activeElement as HTMLElement | null
	if (!activeElement || !container.contains(activeElement)) return

	const blockDivs = Array.from(container.children) as HTMLElement[]
	const blockIndex = blockDivs.findIndex(div => div === activeElement || div.contains(activeElement))
	if (blockIndex === -1) return

	const blockDiv = blockDivs[blockIndex]
	const rows = store.state.tokens.get()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.state.previousValue.get() ?? store.state.value.get() ?? ''

	const focusAndSetCaret = (newRawPos: number) => {
		queueMicrotask(() => {
			const target = container.children[blockIndex] as HTMLElement | undefined
			if (!target) return
			target.focus()
			const updatedRows = store.state.tokens.get()
			const updatedToken = updatedRows[blockIndex]
			if (updatedToken) setCaretAtRawPos(target, updatedToken, newRawPos)
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
			store.applyValue(value.slice(0, rawFrom) + data + value.slice(rawTo))
			focusAndSetCaret(rawFrom + data.length)
			break
		}
		case 'insertFromPaste':
		case 'insertReplacementText': {
			event.preventDefault()
			const pasteData = event.dataTransfer?.getData('text/plain') ?? ''
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
			store.applyValue(value.slice(0, rawFrom) + pasteData + value.slice(rawTo))
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
			store.applyValue(value.slice(0, rawFrom) + value.slice(rawTo))
			focusAndSetCaret(rawFrom)
			break
		}
	}
}

/** A text-token span has no attributes, or only the contenteditable attribute. */
function isTextTokenSpan(el: HTMLElement): boolean {
	return (
		el.tagName === 'SPAN' &&
		(el.attributes.length === 0 || (el.attributes.length === 1 && el.hasAttribute('contenteditable')))
	)
}

/**
 * Recursively sets the caret inside a mark token's rendered DOM element.
 *
 * For simple marks (no children), the mark renders its nested content as a single
 * text node; we position the caret at `rawAbsolutePos - nested.start` within it.
 *
 * For complex marks with nested tokens (e.g. a heading that spans multiple inline
 * marks), we walk the mark element's childNodes in parallel with token children,
 * preferring later tokens at boundaries so a position equal to a mark's end
 * resolves into the following sibling text rather than the mark itself.
 *
 * Returns true when the caret was successfully placed, false when the position
 * could not be resolved (caller should fall back to end-of-block).
 */
function setCaretInMarkAtRawPos(markElement: HTMLElement, markToken: MarkToken, rawAbsolutePos: number): boolean {
	const sel = window.getSelection()
	if (!sel) return false

	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'text') {
			if (!isTextTokenSpan(childNode as HTMLElement)) continue
			if (rawAbsolutePos >= tokenChild.position.start && rawAbsolutePos <= tokenChild.position.end) {
				const textNode = childNode.firstChild as Text | null
				const offset = rawAbsolutePos - tokenChild.position.start
				if (textNode) {
					const range = document.createRange()
					range.setStart(textNode, Math.min(offset, textNode.length))
					range.collapse(true)
					sel.removeAllRanges()
					sel.addRange(range)
				} else {
					const range = document.createRange()
					range.setStart(childNode, 0)
					range.collapse(true)
					sel.removeAllRanges()
					sel.addRange(range)
				}
				return true
			}
			tokenIdx++
		} else if (childNode.nodeType === Node.TEXT_NODE && tokenChild.type === 'text') {
			if (rawAbsolutePos >= tokenChild.position.start && rawAbsolutePos <= tokenChild.position.end) {
				const offset = Math.min(rawAbsolutePos - tokenChild.position.start, (childNode as Text).length)
				const range = document.createRange()
				range.setStart(childNode, offset)
				range.collapse(true)
				sel.removeAllRanges()
				sel.addRange(range)
				return true
			}
			tokenIdx++
		} else if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'mark') {
			const nextChild = tokenIdx + 1 < markToken.children.length ? markToken.children[tokenIdx + 1] : null
			const atBoundary =
				rawAbsolutePos === tokenChild.position.end && nextChild?.position.start === rawAbsolutePos
			if (
				!atBoundary &&
				rawAbsolutePos >= tokenChild.position.start &&
				rawAbsolutePos <= tokenChild.position.end
			) {
				return setCaretInMarkAtRawPos(childNode as HTMLElement, tokenChild as MarkToken, rawAbsolutePos)
			}
			tokenIdx++
		}
	}

	return false
}

/**
 * Sets the caret at an absolute raw-value position within a drag row's DOM element.
 * For mark tokens, recursively searches nested content via setCaretInMarkAtRawPos.
 */
function setCaretAtRawPos(blockDiv: HTMLElement, token: Token, rawAbsolutePos: number): void {
	const sel = window.getSelection()
	if (!sel) return

	if (token.type === 'mark') {
		if (setCaretInMarkAtRawPos(blockDiv, token, rawAbsolutePos)) return
		Caret.setCaretToEnd(blockDiv)
		return
	}

	// Text token: position caret directly in the text node
	const offsetWithinToken = rawAbsolutePos - token.position.start
	const walker = document.createTreeWalker(blockDiv, 4 /* SHOW_TEXT */)
	const textNode = walker.nextNode() as Text | null
	if (textNode) {
		const charOffset = Math.min(offsetWithinToken, textNode.length)
		const range = document.createRange()
		range.setStart(textNode, charOffset)
		range.collapse(true)
		sel.removeAllRanges()
		sel.addRange(range)
		return
	}

	Caret.setCaretToEnd(blockDiv)
}

/**
 * Maps a DOM (node, offset) position to an absolute raw-value offset.
 * Walks up from `node` to find the direct child of `blockDiv`, then maps
 * to the corresponding token's raw position. For mark tokens with nested
 * content, recursively resolves the position within the mark's children.
 */
function getDomRawPos(node: Node, offset: number, blockDiv: HTMLElement, token: Token): number {
	if (node === blockDiv) {
		const sel = window.getSelection()
		if (sel?.focusNode && sel.focusNode !== blockDiv) {
			return getDomRawPos(sel.focusNode, sel.focusOffset, blockDiv, token)
		}
		return token.position.end
	}

	// When the text node is a direct child of blockDiv (mark tokens without
	// DraggableBlock wrapper), resolve position using the token directly.
	if (node.nodeType === Node.TEXT_NODE && node.parentElement === blockDiv) {
		if (token.type === 'mark') {
			return getDomRawPosInMark(node, offset, blockDiv, token)
		}
		return token.position.start + Math.min(offset, token.content.length)
	}

	let child: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
	while (child && child.parentElement !== blockDiv) {
		child = child.parentElement
	}
	if (!child) return token.position.end

	// For mark tokens (no DragMark wrapper), delegate to getDomRawPosInMark.
	if (token.type === 'mark') {
		return getDomRawPosInMark(node, offset, blockDiv, token)
	}

	// Text token
	return token.position.start + Math.min(offset, token.content.length)
}

/**
 * Recursively maps a DOM (node, offset) position to an absolute raw-value offset
 * within a mark token's nested content. Handles marks that contain other marks
 * (e.g. h1 containing bold), correctly mapping cursor positions through the
 * nested DOM/token structure.
 *
 * Key rules:
 * - cursor at offset === 0 → raw position at mark start
 * - cursor at offset === full nested length → raw position at mark end (after closing delimiter)
 * - cursor in the middle → raw position within nested content
 */
function getDomRawPosInMark(node: Node, offset: number, markElement: HTMLElement, markToken: MarkToken): number {
	if (!markToken.children || markToken.children.length === 0) {
		if (offset === 0) return markToken.position.start
		const nestedLen = markToken.slot?.content.length ?? markToken.value.length
		if (nestedLen > 0 && offset >= nestedLen) {
			if (markToken.content.endsWith('\n\n') && markToken.slot) {
				return markToken.slot.end
			}
			return markToken.position.end
		}
		return (markToken.slot?.start ?? markToken.position.start) + Math.min(offset, nestedLen)
	}

	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'text') {
			if (!isTextTokenSpan(childNode as HTMLElement)) continue
			if (node === childNode) {
				const charOffset = offset === 0 ? 0 : tokenChild.content.length
				return tokenChild.position.start + Math.min(charOffset, tokenChild.content.length)
			}
			if ((childNode as Element).contains(node)) {
				return tokenChild.position.start + Math.min(offset, tokenChild.content.length)
			}
			tokenIdx++
		} else if (childNode.nodeType === Node.TEXT_NODE && tokenChild.type === 'text') {
			if (node === childNode) {
				return tokenChild.position.start + Math.min(offset, tokenChild.content.length)
			}
			tokenIdx++
		} else if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'mark') {
			if (childNode === node || (childNode as Element).contains(node)) {
				return getDomRawPosInMark(node, offset, childNode as HTMLElement, tokenChild)
			}
			tokenIdx++
		}
	}

	return markToken.slot?.end ?? markToken.position.end
}