import {KEYBOARD} from '../../shared/constants'
import type {BoundaryPositionResult, RawRange, RawSelectionResult} from '../../shared/editorContracts'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {isFullSelection} from '../caret'
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import type {Token} from '../parsing'

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
	let compositionRange: RawRange | undefined

	const scope = effectScope(() => {
		listen(container, 'paste', e => {
			const c = store.slots.container()
			if (c) captureMarkupPaste(e, c)
			handlePaste(store, e)
		})

		listen(container, 'compositionstart', () => {
			const selection = store.dom.readRawSelection()
			compositionRange = selection.ok ? selection.value.range : undefined
			store.dom.compositionStarted()
		})

		listen(container, 'compositionend', e => {
			const range = compositionRange
			compositionRange = undefined
			store.dom.compositionEnded()
			if (store.slots.isBlock()) return
			if (!range) return
			const data = e.data
			store.value.replaceRange(range, data, {
				source: 'input',
				recover: {kind: 'caret', rawPosition: range.start + data.length},
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

		listen(container, 'keydown', e => {
			handleDeleteKey(store, e)
		})
	})

	return () => scope()
}

function handleDeleteKey(store: Store, event: KeyboardEvent): void {
	if (store.slots.isBlock()) return
	if (event.key !== KEYBOARD.BACKSPACE && event.key !== KEYBOARD.DELETE) return

	if (store.caret.selecting() === 'all' && isFullSelection(store)) {
		event.preventDefault()
		replaceAllContentWith(store, '')
		return
	}
	if (store.caret.selecting() === 'all') store.caret.selecting(undefined)

	const raw = store.dom.readRawSelection()
	if (!raw.ok) return

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const range = rangeForDelete(store, inputType, raw.value.range)
	if (!range) return

	event.preventDefault()
	store.value.replaceRange(range, '', {
		source: 'input',
		recover: {kind: 'caret', rawPosition: range.start},
	})
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
	return rangeForDelete(store, event.inputType, range)
}

function rangeForDelete(store: Store, inputType: string, range: RawRange): RawRange | undefined {
	if (range.start !== range.end) return range

	const adjacentMark = adjacentMarkRange(store.parsing.tokens(), range.start, inputType.endsWith('Backward'))
	if (adjacentMark) return adjacentMark

	if (inputType.endsWith('Backward') && range.start > 0) {
		return {start: range.start - 1, end: range.start}
	}
	if (inputType.endsWith('Forward') && range.end < store.value.current().length) {
		return {start: range.start, end: range.end + 1}
	}
	return undefined
}

function adjacentMarkRange(tokens: readonly Token[], position: number, backward: boolean): RawRange | undefined {
	for (const token of tokens) {
		const nested = token.type === 'mark' ? adjacentMarkRange(token.children, position, backward) : undefined
		if (nested) return nested
		if (token.type === 'mark' && (backward ? token.position.end === position : token.position.start === position)) {
			return token.position
		}
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