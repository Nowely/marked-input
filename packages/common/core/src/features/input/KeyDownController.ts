import type {NodeProxy} from '../../shared/classes/NodeProxy'
import {KEYBOARD} from '../../shared/constants'
import {BLOCK_SEPARATOR} from '../blocks/config'
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

		if (event.key === KEYBOARD.DELETE || event.key === KEYBOARD.BACKSPACE) {
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
				}
			}

			if (event.key === KEYBOARD.DELETE) {
				if (focus.isSpan && focus.isCaretAtEnd && focus.next.target) {
					event.preventDefault()
					deleteMark('next', this.store)
				}
			}
		}
	}

	#handleEnter(event: KeyboardEvent) {
		if (!this.store.state.block.get()) return
		if (event.key !== KEYBOARD.ENTER) return

		const {focus} = this.store.nodes
		if (!focus.target || !focus.isEditable) return

		if (event.shiftKey) return

		event.preventDefault()

		const offset = focus.caret
		const content = focus.content
		const newContent = content.slice(0, offset) + BLOCK_SEPARATOR + content.slice(offset)
		focus.content = newContent
		focus.caret = offset + BLOCK_SEPARATOR.length

		this.store.events.change()
	}
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