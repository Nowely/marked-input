import type {NodeProxy} from '../../shared/classes/NodeProxy'
import {KEYBOARD} from '../../shared/constants'
import {deleteBlock, mergeBlocks} from '../blocks/blockOperations'
import {BLOCK_SEPARATOR} from '../blocks/config'
import {splitTokensIntoBlocks, type Block} from '../blocks/splitTokensIntoBlocks'
import {Caret} from '../caret'
import {shiftFocusNext, shiftFocusPrev} from '../navigation'
import {selectAllText} from '../selection'
import type {Store} from '../store/Store'
import {deleteMark} from '../text-manipulation'

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
		const isBlockMode = !!this.store.state.block.get()

		// Mark/span deletion only applies in non-block mode.
		// In block mode the focus target is a block div, not a span/mark.
		if (!isBlockMode && (event.key === KEYBOARD.DELETE || event.key === KEYBOARD.BACKSPACE)) {
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

		if (!isBlockMode) return

		const container = this.store.refs.container
		if (!container) return

		const blockDivs = Array.from(container.children)
		const blockIndex = blockDivs.findIndex(
			div => div === document.activeElement || div.contains(document.activeElement as Node)
		)
		if (blockIndex === -1) return

		const tokens = this.store.state.tokens.get()
		const blocks = splitTokensIntoBlocks(tokens)
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
				const newValue = deleteBlock(value, blocks, blockIndex)
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
				event.preventDefault()
				const joinPos = blocks[blockIndex - 1].endPos
				const newValue = mergeBlocks(value, blocks, blockIndex)
				this.store.applyValue(newValue)
				queueMicrotask(() => {
					const newDivs = container.children
					const target = newDivs[blockIndex - 1] as HTMLElement | undefined
					if (target) {
						target.focus()
						const charOffset = joinPos - blocks[blockIndex - 1].startPos
						Caret.trySetIndex(target, charOffset)
					}
				})
				return
			}
		}

		if (event.key === KEYBOARD.DELETE) {
			const blockDiv = blockDivs[blockIndex] as HTMLElement
			const caretAtEnd = Caret.getCaretIndex(blockDiv) === blockDiv.textContent?.length

			// Caret at end of non-last block: merge next block into current
			if (caretAtEnd && blockIndex < blocks.length - 1) {
				event.preventDefault()
				const joinPos = block.endPos
				const newValue = mergeBlocks(value, blocks, blockIndex + 1)
				this.store.applyValue(newValue)
				queueMicrotask(() => {
					const newDivs = container.children
					const target = newDivs[blockIndex] as HTMLElement | undefined
					if (target) {
						target.focus()
						const charOffset = joinPos - block.startPos
						Caret.trySetIndex(target, charOffset)
					}
				})
				return
			}
		}
	}

	#handleEnter(event: KeyboardEvent) {
		if (!this.store.state.block.get()) return
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
		const blocks = splitTokensIntoBlocks(tokens)
		if (blockIndex >= blocks.length) return

		const block = blocks[blockIndex]
		const blockDiv = blockDivs[blockIndex] as HTMLElement
		const value = this.store.state.value.get() ?? this.store.state.previousValue.get() ?? ''

		// Compute raw value offset at caret position using token positions
		const absolutePos = getCaretRawPosInBlock(blockDiv, block)

		// Insert BLOCK_SEPARATOR at the raw position
		const newValue = value.slice(0, absolutePos) + BLOCK_SEPARATOR + value.slice(absolutePos)

		if (!this.store.state.onChange.get()) return
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
		if (!this.store.state.block.get()) return

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
 * For text tokens, the visual character offset equals the raw offset.
 * For mark tokens, the caret is treated as being at the mark's end (after the mark).
 */
function getCaretRawPosInBlock(blockDiv: HTMLElement, block: Block): number {
	const selection = window.getSelection()
	if (!selection?.rangeCount) return block.endPos

	const {focusNode} = selection
	if (!focusNode) return block.endPos

	// Walk up from focusNode to find the direct child of blockDiv that contains it
	let node: Node | null = focusNode.nodeType === Node.ELEMENT_NODE ? focusNode : focusNode.parentElement
	while (node && node.parentElement !== blockDiv) {
		node = node.parentElement
	}

	if (!node) return block.endPos

	// Find the child index in blockDiv.children (element children only)
	const childIndex = Array.from(blockDiv.children).indexOf(node as Element)
	if (childIndex < 0) return block.endPos

	// Token index: child 0 is the drag handle, tokens start at child 1
	const tokenIndex = childIndex - 1
	if (tokenIndex < 0) return block.startPos // caret in drag handle
	if (tokenIndex >= block.tokens.length) return block.endPos

	const token = block.tokens[tokenIndex]

	if (token.type === 'text') {
		// Visual offset within this span = raw offset within this text token
		const visualOffset = Caret.getCaretIndex(node as HTMLElement)
		return token.position.start + visualOffset
	}

	// For mark tokens: treat the caret as being at the end of the mark
	return token.position.end
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

function isFullSelection(store: Store): boolean {
	const sel = window.getSelection()
	const container = store.refs.container
	if (!sel?.rangeCount || !container?.firstChild || !container?.lastChild) return false

	try {
		const range = sel.getRangeAt(0)
		return (
			container.contains(range.startContainer) &&
			container.contains(range.endContainer) &&
			range.toString().length > 0
		)
	} catch {
		return false
	}
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