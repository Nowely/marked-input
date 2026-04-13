import {isHtmlElement} from '../../shared/checkers'
import type {NodeProxy} from '../../shared/classes'
import {KEYBOARD} from '../../shared/constants'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {captureMarkupPaste, consumeMarkupPaste, getBoundaryOffset} from '../clipboard'
import {deleteMark} from '../editing/utils/deleteMark'
import {isFullSelection} from '../selection'

export class InputFeature {
	#scope?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#scope) return

		const container = this.store.refs.container
		if (!container) return

		this.#scope = effectScope(() => {
			listen(container, 'keydown', e => {
				if (!this.store.props.drag()) {
					this.#handleDelete(e)
				}
			})

			listen(container, 'paste', e => {
				const c = this.store.refs.container
				if (c) captureMarkupPaste(e, c)
				handlePaste(this.store, e)
			})

			listen(
				container,
				'beforeinput',
				e => {
					handleBeforeInput(this.store, e)
				},
				true
			)
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	#handleDelete(event: KeyboardEvent) {
		const {focus} = this.store.nodes

		if (event.key !== KEYBOARD.DELETE && event.key !== KEYBOARD.BACKSPACE) return

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

		if (focus.isSpan && focus.isEditable && window.getSelection()?.isCollapsed) {
			const content = focus.content
			const caret = focus.caret
			if (event.key === KEYBOARD.BACKSPACE && caret > 0) {
				event.preventDefault()
				focus.content = content.slice(0, caret - 1) + content.slice(caret)
				focus.caret = caret - 1
				this.store.event.change()
				return
			}
			if (event.key === KEYBOARD.DELETE && caret >= 0 && caret < content.length) {
				event.preventDefault()
				focus.content = content.slice(0, caret) + content.slice(caret + 1)
				focus.caret = caret
				this.store.event.change()
				return
			}
		}
	}
}

export function handleBeforeInput(store: Store, event: InputEvent): void {
	const selecting = store.state.selecting()
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
	if (selecting === 'all') store.state.selecting(undefined)

	if (store.props.drag()) return

	const {focus} = store.nodes
	if (!focus.target || !focus.isEditable) return

	if (
		(event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') &&
		handleMarkputSpanPaste(store, focus, event)
	) {
		return
	}

	if (applySpanInput(focus, event)) {
		store.event.change()
	}
}

function handleMarkputSpanPaste(store: Store, focus: NodeProxy, event: InputEvent): boolean {
	const container = store.refs.container
	if (!container) return false
	const markup = consumeMarkupPaste(container)
	if (!markup) return false

	event.preventDefault()

	const tokens = store.state.tokens()
	const token = tokens[focus.index]
	const offset = focus.caret
	const currentValue = store.state.previousValue() ?? store.props.value() ?? ''

	const ranges = event.getTargetRanges()
	const childElement = container.children[focus.index]
	let rawInsertPos: number
	let rawEndPos: number
	if (ranges.length > 0) {
		const cumStart = getBoundaryOffset(ranges[0], childElement, true)
		const cumEnd = getBoundaryOffset(ranges[0], childElement, false)
		rawInsertPos = token.position.start + cumStart
		rawEndPos = token.position.start + cumEnd
	} else {
		rawInsertPos = token.position.start + offset
		rawEndPos = token.position.start + offset
	}

	const caretPos = rawInsertPos + markup.length
	const newValue = currentValue.slice(0, rawInsertPos) + markup + currentValue.slice(rawEndPos)
	store.state.innerValue(newValue)

	const newTokens = store.state.tokens()
	let targetIdx = newTokens.findIndex(
		t => t.type === 'text' && caretPos >= t.position.start && caretPos <= t.position.end
	)
	if (targetIdx === -1) targetIdx = newTokens.length - 1
	const caretWithinToken = caretPos - newTokens[targetIdx].position.start

	store.state.recovery({
		anchor: store.nodes.focus,
		caret: caretWithinToken,
		isNext: true,
		childIndex: targetIdx - 2,
	})
	return true
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
			let startOffset: number
			let endOffset: number
			if (ranges.length > 0 && ranges[0].startOffset !== ranges[0].endOffset) {
				startOffset = ranges[0].startOffset
				endOffset = ranges[0].endOffset
			} else {
				if (event.inputType === 'deleteContentBackward' && offset > 0) {
					startOffset = offset - 1
					endOffset = offset
				} else if (event.inputType === 'deleteContentForward' && offset < content.length) {
					startOffset = offset
					endOffset = offset + 1
				} else {
					return false
				}
			}
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
	const selecting = store.state.selecting()
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.state.selecting(undefined)
		return
	}

	event.preventDefault()
	const markup = store.refs.container ? consumeMarkupPaste(store.refs.container) : undefined
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	replaceAllContentWith(store, newContent)
}

export function replaceAllContentWith(store: Store, newContent: string): void {
	store.nodes.focus.target = null
	store.state.selecting(undefined)
	store.state.previousValue(newContent)

	store.props.onChange()?.(newContent)

	if (store.props.value() === undefined) {
		store.state.tokens(
			store.computed.parser()?.parse(newContent) ?? [
				{
					type: 'text' as const,
					content: newContent,
					position: {start: 0, end: newContent.length},
				},
			]
		)
	}

	queueMicrotask(() => {
		const rawFirstChild = store.refs.container?.firstChild
		const firstChild = isHtmlElement(rawFirstChild) ? rawFirstChild : null
		if (firstChild) {
			store.state.recovery({
				anchor: store.nodes.focus,
				caret: newContent.length,
			})
			firstChild.focus()
		}
	})
}