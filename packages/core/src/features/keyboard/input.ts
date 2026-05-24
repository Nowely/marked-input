import {KEYBOARD} from '../../shared/constants'
import type {Range} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'dom' | 'value' | 'selection' | 'edit' | 'props' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import type {Token} from '../parsing'
import {rawRangeFromInputEvent} from './inputRange'

type SpanInputTarget = {
	content: string
	caret: number
}

export function enableInput(store: KbCtx, container: HTMLElement): void {
	let compositionRange: Range | undefined

	listen(container, 'paste', e => {
		captureMarkupPaste(e, container)
		handlePaste(store, container, e)
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
		if (store.props.layout.isBlock()) return
		if (!range) return
		const data = e.data
		store.edit.replace(range, data)
	})

	listen(
		container,
		'beforeinput',
		e => {
			handleBeforeInput(store, container, e)
		},
		true
	)

	listen(container, 'keydown', e => {
		handleDeleteKey(store, e)
	})
}

function handleDeleteKey(store: KbCtx, event: KeyboardEvent): void {
	if (store.props.layout.isBlock()) return
	if (event.key !== KEYBOARD.BACKSPACE && event.key !== KEYBOARD.DELETE) return

	if (store.selection.isAllSelected()) {
		event.preventDefault()
		store.edit.replace({start: 0, end: -1}, '')
		return
	}

	const raw = store.dom.readRawSelection()
	if (!raw.ok) return

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const range = rangeForDelete(store, inputType, raw.value.range)
	if (!range) return

	event.preventDefault()
	store.edit.replace(range, '')
}

export function handleBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent): void {
	if (store.selection.isAllSelected()) {
		if (event.inputType === 'insertFromPaste') {
			event.preventDefault()
			return
		}
		event.preventDefault()
		const newContent = event.inputType.startsWith('delete') ? '' : (event.data ?? '')
		store.edit.replace({start: 0, end: -1}, newContent)
		return
	}

	if (store.props.layout.isBlock()) return

	const raw = rawRangeFromInputEvent(store, event)
	if (!raw.ok) return

	const replacement = replacementForInput(container, event)
	if (replacement === undefined) return

	const range = rangeForInput(store, event, raw.value.range)
	if (!range) return

	event.preventDefault()
	store.edit.replace(range, replacement)
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

function replacementForInput(container: HTMLElement, event: InputEvent): string | undefined {
	if (event.inputType.startsWith('delete')) return ''
	if (event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') {
		const markup = consumeMarkupPaste(container)
		return markup ?? event.dataTransfer?.getData('text/plain') ?? event.data ?? ''
	}
	if (event.inputType === 'insertText') return event.data ?? ''
	return undefined
}

function rangeForInput(store: KbCtx, event: InputEvent, range: Range): Range | undefined {
	if (!event.inputType.startsWith('delete')) return range
	return rangeForDelete(store, event.inputType, range)
}

function rangeForDelete(store: KbCtx, inputType: string, range: Range): Range | undefined {
	if (range.start !== range.end) return range

	const adjacentMark = adjacentMarkRange(store.tokens.current(), range.start, inputType.endsWith('Backward'))
	if (adjacentMark) return adjacentMark

	if (inputType.endsWith('Backward') && range.start > 0) {
		return {start: range.start - 1, end: range.start}
	}
	if (inputType.endsWith('Forward') && range.end < store.value.current().length) {
		return {start: range.start, end: range.end + 1}
	}
	return undefined
}

function adjacentMarkRange(tokens: readonly Token[], position: number, backward: boolean): Range | undefined {
	for (const token of tokens) {
		const nested = token.type === 'mark' ? adjacentMarkRange(token.children, position, backward) : undefined
		if (nested) return nested
		if (token.type === 'mark' && (backward ? token.position.end === position : token.position.start === position)) {
			return token.position
		}
	}
	return undefined
}

export function handlePaste(store: KbCtx, container: HTMLElement, event: ClipboardEvent): void {
	if (!store.selection.isAllSelected()) return

	event.preventDefault()
	const markup = consumeMarkupPaste(container)
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	store.edit.replace({start: 0, end: -1}, newContent)
}