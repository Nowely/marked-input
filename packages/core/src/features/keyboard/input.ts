import {KEYBOARD} from '../../shared/constants'
import type {Range} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'value' | 'selection' | 'edit' | 'props' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import type {Token} from '../tokens'
import {rawRangeFromInputEvent} from './inputRange'

export function enableInput(store: KbCtx, container: HTMLElement): void {
	listen(container, 'paste', e => {
		captureMarkupPaste(e, container)
		handlePaste(store, container, e)
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

	const raw = store.selection.readRaw()
	if (!raw) return

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const range = rangeForDelete(store, inputType, raw.range)
	if (!range) return

	event.preventDefault()
	store.edit.replace(range, '')
}

function handleBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent): void {
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
	if (!raw) return

	const replacement = replacementForInput(container, event)
	if (replacement === undefined) return

	const range = rangeForInput(store, event, raw.range)
	if (!range) return

	event.preventDefault()
	store.edit.replace(range, replacement)
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

	// Fresh read: adjacency compares mark POSITIONS against the live caret
	// position; tokens() is the reconciled tree consistent with value.current()
	// (typing right before a mark, then deleting, must still swallow the mark).
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

function handlePaste(store: KbCtx, container: HTMLElement, event: ClipboardEvent): void {
	if (!store.selection.isAllSelected()) return

	event.preventDefault()
	const markup = consumeMarkupPaste(container)
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	store.edit.replace({start: 0, end: -1}, newContent)
}