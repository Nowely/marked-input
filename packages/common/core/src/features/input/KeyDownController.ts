import type {NodeProxy} from '../../shared/classes'
import {KEYBOARD} from '../../shared/constants'
import {BLOCK_SEPARATOR} from '../blocks/config'
import {addDragRow, getMergeDragRowJoinPos, mergeDragRows, isTextRow} from '../blocks/dragOperations'
import {splitTokensIntoDragRows, type Block} from '../blocks/splitTokensIntoDragRows'
import {Caret} from '../caret'
import {deleteMark} from '../editing'
import {shiftFocusNext, shiftFocusPrev} from '../navigation'
import type {MarkToken} from '../parsing'
import {isFullSelection, selectAllText} from '../selection'
import type {Store} from '../store/Store'

export class KeyDownController {
	#keydownHandler?: (e: KeyboardEvent) => void
	#pasteHandler?: (e: ClipboardEvent) => void
	#beforeInputHandler?: (e: InputEvent) => void

	constructor(private store: Store) {}

	enable() {
		if (this.#keydownHandler) return

		const container = this.store.refs.container
		if (!container) return

		this.#keydownHandler = e => {
			if (e.key === KEYBOARD.LEFT) {
				shiftFocusPrev(this.store, e)
			} else if (e.key === KEYBOARD.RIGHT) {
				shiftFocusNext(this.store, e)
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

		const tokens = this.store.state.tokens.get()
		const blocks = splitTokensIntoDragRows(tokens)
		if (blockIndex >= blocks.length) return

		const block = blocks[blockIndex]
		const value = this.store.state.value.get() ?? this.store.state.previousValue.get() ?? ''
		if (!this.store.state.onChange.get()) return

		if (event.key === KEYBOARD.BACKSPACE) {
			const blockDiv = blockDivs[blockIndex] as HTMLElement
			const caretAtStart = Caret.getCaretIndex(blockDiv) === 0

			// Empty block: delete the block entirely
			const blockText = block.tokens.map(t => ('content' in t ? (t as {content: string}).content : '')).join('')
			if (blockText === '') {
				event.preventDefault()
				const newValue =
					blocks.length <= 1
						? ''
						: (() => {
								if (blockIndex >= blocks.length - 1)
									return value.slice(0, blocks[blockIndex - 1].endPos)
								return (
									value.slice(0, blocks[blockIndex].startPos) +
									value.slice(blocks[blockIndex + 1].startPos)
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

			// Non-empty block at position 0: merge with previous block
			if (caretAtStart && blockIndex > 0) {
				const prevBlock = blocks[blockIndex - 1]
				const currBlock = blocks[blockIndex]
				const gap = currBlock.startPos - prevBlock.endPos
				if (isTextRow(prevBlock) && isTextRow(currBlock) && gap === 2) {
					// Text-text merge: remove the \n\n separator
					event.preventDefault()
					const joinPos = getMergeDragRowJoinPos(blocks, blockIndex)
					const newValue = mergeDragRows(value, blocks, blockIndex)
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex - 1] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedBlocks = splitTokensIntoDragRows(this.store.state.tokens.get())
							const updatedBlock = updatedBlocks[blockIndex - 1]
							if (updatedBlock) setCaretAtRawPos(target, updatedBlock, joinPos)
						}
					})
					return
				}
				// Previous row is a mark (or gap=0): navigate only
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

			// Caret at start of non-first block: merge current block into previous (like Backspace at start)
			if (caretAtStart && blockIndex > 0) {
				const prevBlock = blocks[blockIndex - 1]
				const currBlock = blocks[blockIndex]
				const gap = currBlock.startPos - prevBlock.endPos
				if (isTextRow(prevBlock) && isTextRow(currBlock) && gap === 2) {
					event.preventDefault()
					const joinPos = getMergeDragRowJoinPos(blocks, blockIndex)
					const newValue = mergeDragRows(value, blocks, blockIndex)
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex - 1] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedBlocks = splitTokensIntoDragRows(this.store.state.tokens.get())
							const updatedBlock = updatedBlocks[blockIndex - 1]
							if (updatedBlock) setCaretAtRawPos(target, updatedBlock, joinPos)
						}
					})
					return
				}
				// Previous row is a mark: navigate only
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

			// Caret at end of non-last block: merge next block into current
			if (caretAtEnd && blockIndex < blocks.length - 1) {
				const currBlock = blocks[blockIndex]
				const nextBlock = blocks[blockIndex + 1]
				const gap = nextBlock.startPos - currBlock.endPos
				if (isTextRow(currBlock) && isTextRow(nextBlock) && gap === 2) {
					event.preventDefault()
					const joinPos = currBlock.endPos
					const newValue = mergeDragRows(value, blocks, blockIndex + 1)
					this.store.applyValue(newValue)
					queueMicrotask(() => {
						const newDivs = container.children
						const target = newDivs[blockIndex] as HTMLElement | undefined
						if (target) {
							target.focus()
							const updatedBlocks = splitTokensIntoDragRows(this.store.state.tokens.get())
							const updatedBlock = updatedBlocks[blockIndex]
							if (updatedBlock) setCaretAtRawPos(target, updatedBlock, joinPos)
						}
					})
					return
				}
				// Next row is a mark: navigate only
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

		// Find which block (container child) contains the active element
		const blockDivs = container.children
		let blockIndex = -1
		for (let i = 0; i < blockDivs.length; i++) {
			if (blockDivs[i] === activeElement || blockDivs[i].contains(activeElement)) {
				blockIndex = i
				break
			}
		}
		if (blockIndex === -1) return

		const tokens = this.store.state.tokens.get()
		const blocks = splitTokensIntoDragRows(tokens)
		const block = blocks[blockIndex]
		if (!block) return
		const blockDiv = blockDivs[blockIndex] as HTMLElement
		const value = this.store.state.value.get() ?? ''

		if (!this.store.state.onChange.get()) return

		if (!isTextRow(block)) {
			// Mark row in drag mode: add a new empty text row after this row
			const newValue = addDragRow(value, blocks, blockIndex)
			this.store.applyValue(newValue)
			queueMicrotask(() => {
				const newBlockDivs = container.children
				const newBlockIndex = blockIndex + 1
				if (newBlockIndex < newBlockDivs.length) {
					const newBlock = newBlockDivs[newBlockIndex] as HTMLElement
					newBlock.focus()
					Caret.trySetIndex(newBlock, 0)
				}
			})
			return
		}

		// Text row: split at caret position
		const absolutePos = getCaretRawPosInBlock(blockDiv, block)
		// Inserting '\n\n' at position 0 of a row doesn't create a new leading row
		// because the leading separator is ignored by splitTokensIntoDragRows. Use a double
		// separator to produce an empty text row before the existing content.
		const sep = absolutePos === block.startPos ? BLOCK_SEPARATOR + BLOCK_SEPARATOR : BLOCK_SEPARATOR
		const newValue = value.slice(0, absolutePos) + sep + value.slice(absolutePos)
		this.store.applyValue(newValue)

		// Focus the new block after re-render
		queueMicrotask(() => {
			const newBlockDivs = container.children
			const newBlockIndex = blockIndex + 1
			if (newBlockIndex < newBlockDivs.length) {
				const newBlock = newBlockDivs[newBlockIndex] as HTMLElement
				newBlock.focus()
				Caret.trySetIndex(newBlock, 0)
			}
		})
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
function getCaretRawPosInBlock(blockDiv: HTMLElement, block: Block): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return block.endPos

	const {focusNode, focusOffset} = selection
	if (!focusNode) return block.endPos

	return getDomRawPos(focusNode, focusOffset, blockDiv, block)
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

	// In block/drag mode the focus target is a block div, not a text span.
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
	const tokens = store.state.tokens.get()
	const blocks = splitTokensIntoDragRows(tokens)
	if (blockIndex >= blocks.length) return

	const block = blocks[blockIndex]
	const value = store.state.value.get() ?? store.state.previousValue.get() ?? ''

	const focusAndSetCaret = (newRawPos: number) => {
		queueMicrotask(() => {
			const target = container.children[blockIndex] as HTMLElement | undefined
			if (!target) return
			target.focus()
			// Use updated tokens (post-applyValue) for correct token positions
			const updatedBlocks = splitTokensIntoDragRows(store.state.tokens.get())
			const updatedBlock = updatedBlocks[blockIndex]
			if (updatedBlock) setCaretAtRawPos(target, updatedBlock, newRawPos)
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
				const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, block)
				const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, block)
				;[rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			} else {
				// getTargetRanges() can be empty when the caret is adjacent to a mark element.
				// Fall back to reading the caret position directly from the selection.
				rawFrom = rawTo = getCaretRawPosInBlock(blockDiv, block)
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
				const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, block)
				const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, block)
				;[rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			} else {
				// Fall back to current selection when target ranges are unavailable
				// (e.g. synthetic events used in tests, or caret adjacent to mark elements).
				rawFrom = rawTo = getCaretRawPosInBlock(blockDiv, block)
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
			const rawStart = getDomRawPos(ranges[0].startContainer, ranges[0].startOffset, blockDiv, block)
			const rawEnd = getDomRawPos(ranges[0].endContainer, ranges[0].endOffset, blockDiv, block)
			const [rawFrom, rawTo] = rawStart <= rawEnd ? [rawStart, rawEnd] : [rawEnd, rawStart]
			if (rawFrom === rawTo) return
			event.preventDefault()
			store.applyValue(value.slice(0, rawFrom) + value.slice(rawTo))
			focusAndSetCaret(rawFrom)
			break
		}
	}
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

	// Walk childNodes in parallel with token children.
	// Comment / fragment nodes are skipped without advancing the token index.
	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'text') {
			// Text token rendered as <span> element — place caret inside its text node.
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
					// Empty span — place caret at start of the element
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
			// Legacy: text token as direct text node
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
			// At a boundary, prefer the next sibling text over the current mark end.
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
		// Other node types (comments, etc.) — skip without advancing tokenIdx.
	}

	return false
}

/**
 * Sets the caret at an absolute raw-value position within a block's DOM element.
 * Finds the token that contains `rawAbsolutePos`, then directly positions the
 * caret in that token's DOM text node — bypassing visual character counting
 * which is incorrect when mark tokens are present (raw length ≠ visual length).
 * For mark tokens, recursively searches nested content via setCaretInMarkAtRawPos.
 */
function setCaretAtRawPos(blockDiv: HTMLElement, block: Block, rawAbsolutePos: number): void {
	const sel = window.getSelection()
	if (!sel) return

	const blockChildren = Array.from(blockDiv.children)
	// DraggableBlock wraps tokens in a div with a side panel as child[0].
	// Mark blocks rendered without DraggableBlock have no side panel.
	const hasSidePanel = blockDiv.hasAttribute('data-testid')

	// In drag mode, mark blocks render the mark element directly as blockDiv
	// (no DragMark wrapper). So blockDiv IS the mark element itself.
	if (!hasSidePanel && block.tokens.length === 1 && block.tokens[0].type === 'mark') {
		if (setCaretInMarkAtRawPos(blockDiv, block.tokens[0] as MarkToken, rawAbsolutePos)) return
		Caret.setCaretToEnd(blockDiv)
		return
	}

	for (let i = 0; i < block.tokens.length; i++) {
		const token = block.tokens[i]
		const domChild = blockChildren[i + (hasSidePanel ? 1 : 0)] as HTMLElement | undefined
		if (!domChild) continue

		// At a boundary between tokens, prefer the later (next) token so that
		// a position equal to the end of a mark resolves into the following text.
		const nextToken = block.tokens[i + 1]
		if (nextToken && rawAbsolutePos === token.position.end && rawAbsolutePos === nextToken.position.start) {
			continue
		}

		if (rawAbsolutePos >= token.position.start && rawAbsolutePos <= token.position.end) {
			if (token.type === 'text') {
				const offsetWithinToken = rawAbsolutePos - token.position.start
				const walker = document.createTreeWalker(domChild, 4 /* SHOW_TEXT */)
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
			}
			// Mark token: recurse into its nested DOM content
			if (setCaretInMarkAtRawPos(domChild, token as MarkToken, rawAbsolutePos)) return
			break
		}
	}

	// Fallback: position caret at end of block
	Caret.setCaretToEnd(blockDiv)
}

/**
 * Maps a DOM (node, offset) position to an absolute raw-value offset.
 * Walks up from `node` to find the direct child of `blockDiv`, then maps
 * to the corresponding token's raw position. For mark tokens with nested
 * content, recursively resolves the position within the mark's children.
 */
function getDomRawPos(node: Node, offset: number, blockDiv: HTMLElement, block: Block): number {
	// When the browser represents the caret as (blockDiv, childNodeOffset) — common
	// at element boundaries (e.g. after a mark span in Vue where comment nodes
	// shift childNode indices) — fall back to the current selection which gives
	// a more precise (textNode, offset) position.
	if (node === blockDiv) {
		const sel = window.getSelection()
		if (sel?.focusNode && sel.focusNode !== blockDiv) {
			return getDomRawPos(sel.focusNode, sel.focusOffset, blockDiv, block)
		}
		return block.endPos
	}

	// When the text node is a direct child of blockDiv (mark blocks without
	// DraggableBlock wrapper), resolve position using the mark token directly.
	if (node.nodeType === Node.TEXT_NODE && node.parentElement === blockDiv) {
		const token = block.tokens[0]
		if (token?.type === 'mark') {
			return getDomRawPosInMark(node, offset, blockDiv, token)
		}
		if (token?.type === 'text') {
			return token.position.start + Math.min(offset, token.content.length)
		}
		return block.endPos
	}

	let child: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
	while (child && child.parentElement !== blockDiv) {
		child = child.parentElement
	}
	if (!child) return block.endPos

	const childIndex = Array.from(blockDiv.children).indexOf(child as Element)
	if (childIndex < 0) return block.endPos

	// DraggableBlock wraps tokens in a div with a side panel as child[0].
	// Mark blocks rendered without DraggableBlock have no side panel.
	const hasSidePanel = blockDiv.hasAttribute('data-testid')
	const tokenIndex = childIndex - (hasSidePanel ? 1 : 0)
	if (tokenIndex < 0) return block.startPos
	if (tokenIndex >= block.tokens.length) return block.endPos

	const token = block.tokens[tokenIndex]
	if (token.type === 'text') {
		return token.position.start + Math.min(offset, token.content.length)
	}
	// For mark tokens: recursively resolve position within nested mark structure
	return getDomRawPosInMark(node, offset, child as HTMLElement, token)
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
		const nestedLen = markToken.childrenRaw?.content.length ?? markToken.value.length
		if (nestedLen > 0 && offset >= nestedLen) {
			// When the mark's raw content ends with a block separator, the cursor
			// at the visual end should map to nested.end (before the separator),
			// not position.end (after it). Otherwise use position.end to place
			// the cursor after the closing delimiter (e.g. ** in bold).
			if (markToken.content.endsWith('\n\n') && markToken.childrenRaw) {
				return markToken.childrenRaw.end
			}
			return markToken.position.end
		}
		return (markToken.childrenRaw?.start ?? markToken.position.start) + Math.min(offset, nestedLen)
	}

	// Walk child nodes of markElement and match to token children.
	// TextToken children render as span elements; MarkToken children render as elements.
	let tokenIdx = 0
	for (const childNode of Array.from(markElement.childNodes)) {
		if (tokenIdx >= markToken.children.length) break
		const tokenChild = markToken.children[tokenIdx]

		if (childNode.nodeType === Node.ELEMENT_NODE && tokenChild.type === 'text') {
			if (node === childNode) {
				// Element-level offset: 0 = before children, >= childNodes.length = after all children
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

	// Fallback: cursor at or beyond end of nested content
	return markToken.childrenRaw?.end ?? markToken.position.end
}