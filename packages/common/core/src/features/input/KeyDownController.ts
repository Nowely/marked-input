import {KEYBOARD} from '../../shared/constants'
import {deleteMark} from '../text-manipulation'
import {selectAllText} from '../selection'
import {shiftFocusNext, shiftFocusPrev} from '../navigation'
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
			}

			this.#handleDelete(e)
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
}

export function handleBeforeInput(store: Store, event: InputEvent): void {
	const selecting = store.state.selecting
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.state.selecting = undefined
		return
	}

	if (event.inputType === 'insertFromPaste') return

	event.preventDefault()

	const newContent = event.inputType.startsWith('delete') ? '' : (event.data ?? '')

	replaceAllContentWith(store, newContent)
}

export function handlePaste(store: Store, event: ClipboardEvent): void {
	const selecting = store.state.selecting
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.state.selecting = undefined
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
	store.state.selecting = undefined

	store.props.onChange?.(newContent)

	if (store.props.value === undefined) {
		store.state.tokens = store.state.parser?.parse(newContent) ?? [
			{
				type: 'text' as const,
				content: newContent,
				position: {start: 0, end: newContent.length},
			},
		]
	}

	queueMicrotask(() => {
		const firstChild = store.refs.container?.firstChild as HTMLElement | null
		if (firstChild) {
			store.state.recovery = {
				anchor: store.nodes.focus,
				caret: newContent.length,
			}
			firstChild.focus()
		}
	})
}
