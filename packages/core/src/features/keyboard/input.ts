import {KEYBOARD} from '../../shared/constants'
import type {BoundaryPositionResult, RawRange, RawSelectionResult} from '../../shared/editorContracts'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {isFullSelection} from '../caret'
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import {deleteMark} from '../editing/utils/deleteMark'

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

type SpanInputTarget = {
	content: string
	caret: number
}

type RawSelectionFailureReason = Extract<RawSelectionResult, {ok: false}>['reason']

export function enableInput(store: Store): () => void {
	const container = store.slots.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'keydown', e => {
			if (!store.slots.isBlock()) {
				handleDelete(store, e)
			}
		})

		listen(container, 'paste', e => {
			const c = store.slots.container()
			if (c) captureMarkupPaste(e, c)
			handlePaste(store, e)
		})

		listen(container, 'compositionstart', () => {
			store.dom.compositionStarted()
		})

		listen(container, 'compositionend', e => {
			store.dom.compositionEnded()
			if (store.slots.isBlock()) return
			const selection = store.dom.readRawSelection()
			if (!selection.ok) return
			const data = e.data
			store.value.replaceRange(selection.value.range, data, {
				source: 'input',
				recover: {kind: 'caret', rawPosition: selection.value.range.start + data.length},
			})
		})

		listen(
			container,
			'beforeinput',
			e => {
				handleBeforeInput(store, e)
			},
			true
		)
	})

	return () => scope()
}

function handleDelete(store: Store, event: KeyboardEvent) {
	const {focus} = store.nodes

	if (event.key !== KEYBOARD.DELETE && event.key !== KEYBOARD.BACKSPACE) return

	if (focus.isMark) {
		if (focus.isEditable) {
			if (event.key === KEYBOARD.BACKSPACE && !focus.isCaretAtBeginning) return
			if (event.key === KEYBOARD.DELETE && !focus.isCaretAtEnd) return
		}
		event.preventDefault()
		deleteMark('self', store)
		return
	}

	if (event.key === KEYBOARD.BACKSPACE) {
		if (focus.isSpan && focus.isCaretAtBeginning && focus.prev.target) {
			event.preventDefault()
			deleteMark('prev', store)
			return
		}
	}

	if (event.key === KEYBOARD.DELETE) {
		if (focus.isSpan && focus.isCaretAtEnd && focus.next.target) {
			event.preventDefault()
			deleteMark('next', store)
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
			store.value.change()
			return
		}
		if (event.key === KEYBOARD.DELETE && caret >= 0 && caret < content.length) {
			event.preventDefault()
			focus.content = content.slice(0, caret) + content.slice(caret + 1)
			focus.caret = caret
			store.value.change()
			return
		}
	}
}

export function handleBeforeInput(store: Store, event: InputEvent): void {
	const selecting = store.caret.selecting()
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
	if (selecting === 'all') store.caret.selecting(undefined)

	if (store.slots.isBlock()) return

	const raw = rawRangeFromInputEvent(store, event)
	if (!raw.ok) return

	const replacement = replacementForInput(store, event)
	if (replacement === undefined) return

	const range = rangeForInput(store, event, raw.value.range)
	if (!range) return

	event.preventDefault()
	store.value.replaceRange(range, replacement, {
		source: 'input',
		recover: {kind: 'caret', rawPosition: range.start + replacement.length},
	})
}

export function applySpanInput(focus: SpanInputTarget, event: InputEvent): boolean {
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

function rawRangeFromInputEvent(store: Store, event: InputEvent): RawSelectionResult {
	const ranges = getTargetRanges(event)
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

function getTargetRanges(event: InputEvent): readonly InputTargetRange[] {
	return event.getTargetRanges()
}

function replacementForInput(store: Store, event: InputEvent): string | undefined {
	if (event.inputType.startsWith('delete')) return ''
	if (event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') {
		const container = store.slots.container()
		const markup = container ? consumeMarkupPaste(container) : undefined
		return markup ?? event.dataTransfer?.getData('text/plain') ?? event.data ?? ''
	}
	if (event.inputType === 'insertText') return event.data ?? ''
	return undefined
}

function rangeForInput(store: Store, event: InputEvent, range: RawRange): RawRange | undefined {
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

export function handlePaste(store: Store, event: ClipboardEvent): void {
	const selecting = store.caret.selecting()
	if (selecting !== 'all' || !isFullSelection(store)) {
		if (selecting === 'all') store.caret.selecting(undefined)
		return
	}

	event.preventDefault()
	const c = store.slots.container()
	const markup = c ? consumeMarkupPaste(c) : undefined
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	replaceAllContentWith(store, newContent)
}

export function replaceAllContentWith(store: Store, newContent: string): void {
	store.caret.selecting(undefined)
	store.value.replaceAll(newContent, {
		source: 'input',
		recover: {kind: 'caret', rawPosition: newContent.length},
	})
}