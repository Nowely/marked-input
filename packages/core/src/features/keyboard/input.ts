import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'props' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import {
	anchorsForDelete,
	anchorsFromInputEvent,
	dropUnexpressedInput,
	isConsumerKeyOrigin,
	isConsumerOrigin,
	replacementForInput,
} from './beforeInput'
import {handleRowEnter, handleRowParagraph, rowEdgeAnchors} from './blockEdit'

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
		// ONE consumer-origin test for the WHOLE keydown tier, matching what
		// `handleBeforeInput` does on its own: DOM the consumer owns — a registered control
		// root, or an explicit `contenteditable` island — handles its own keys, and the model
		// must neither act on them nor cancel them.
		//
		// It used to guard the select-all branch alone, and only against controls. Both gaps
		// ended in silent data loss through the SAME door, because the branches below key on
		// the STORED selection rather than on where the keystroke came from: Ctrl+A inside an
		// island hijacked select-all, and the next character — or a Backspace, through
		// `handleDeleteKey`'s all-selected arm — replaced the whole value.
		if (isConsumerKeyOrigin(store, container, e)) return

		// Layout-independent on purpose: selecting the whole value is a model operation, and
		// block rows are values too.
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
			e.preventDefault()
			store.tokens.selection.selectAll()
			return
		}
		// The block ARM, after the shared checks and answering only in block layout. It used to
		// be a second keydown listener on this same container that repeated both of them.
		handleRowEnter(store, e)
		handleDeleteKey(store, e)
	})
}

function handleDeleteKey(store: KbCtx, event: KeyboardEvent): void {
	if (event.key !== KEYBOARD.BACKSPACE && event.key !== KEYBOARD.DELETE) return

	// NOT redundant with the fallthrough below, and the difference is measured rather than
	// argued: when the STORED selection says all-selected but the live DOM selection is gone,
	// `domAnchors()` answers `undefined` and the fallthrough returns without preventing the
	// default — letting the browser mutate contenteditable behind the model's back. Gated by
	// `input.spec`'s 'clears the whole value even when the DOM selection is gone'; the
	// obvious "Backspace with everything selected" case does NOT discriminate it.
	if (store.tokens.selection.isAllSelected()) {
		event.preventDefault()
		store.edit.setValue('')
		return
	}

	// A WORD or LINE delete is not this arm's to answer. The keys are the same Backspace and
	// Delete, but the extent is the platform's — Alt+Backspace deletes a word on macOS,
	// Ctrl+Backspace on Windows, Cmd+Backspace a whole line — and this arm can only form a
	// one-character step. Cancelling here kept the browser from ever emitting the
	// `deleteWordBackward`/`deleteSoftLine*` `beforeinput` that carries the RANGED target range
	// the extent lives in, so a word delete silently became a character delete. Declining lets
	// that event arrive, where the shared tail resolves it — the precedence `handleBeforeInput`
	// already pins ('a RANGED target range outranks the live caret'). Shift is deliberately not
	// in this test: Shift+Backspace is a plain delete.
	if (event.ctrlKey || event.altKey || event.metaKey) return

	// DOM truth, with the row-edge fallback behind it for a boundary this layer declines. That
	// fallback answers for a ROW and nothing else, so it leaves the discrimination above intact
	// and inline reaches it never.
	const anchors = store.tokens.domAnchors() ?? rowEdgeAnchors(store)
	if (!anchors) return

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const target = anchorsForDelete(store, inputType, anchors)
	if (!target) return

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, '')
}

function handleBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent): void {
	// Consumer DOM is neither edited nor cancelled here, and the all-selected branch below
	// is why this has to come FIRST: it keys on the STORED selection, not on where the
	// event came from, so a character typed into a control's own `<input>` would replace
	// the entire value with that character.
	if (isConsumerOrigin(store, container, event)) return

	if (store.tokens.selection.isAllSelected()) {
		// The `paste` listener owns this one end-to-end: it consumes the markup
		// clipboard entry and performs the whole-value replace itself.
		if (event.inputType === 'insertFromPaste') {
			event.preventDefault()
			return
		}
		// Same replacement policy as the ordinary path below, instead of a private
		// `event.data ?? ''`. That shortcut treated every unhandled input type as
		// "replace everything with the empty string", so Enter (insertParagraph) and a
		// drop (insertFromDrop, whose payload is on dataTransfer) wiped the value; it
		// also ignored the markup clipboard on insertReplacementText.
		const replacement = replacementForInput(container, event)
		if (replacement === undefined) {
			dropUnexpressedInput(container, event)
			return
		}
		event.preventDefault()
		store.edit.setValue(replacement)
		return
	}

	// The block ARM, after the two checks above and answering only in block layout. It used to
	// be a second CAPTURE listener on this same container, which repeated the control-root half
	// of `isConsumerOrigin`, skipped whatever this one had already prevented, and — the reason
	// this order matters — never took the island half at all. Everything past it is shared: the
	// block tail was a copy of the one below.
	if (handleRowParagraph(store, container, event)) return

	const anchors = anchorsFromInputEvent(store, event)
	const replacement = replacementForInput(container, event)
	if (anchors === undefined || replacement === undefined) {
		dropUnexpressedInput(container, event)
		return
	}

	// Only a DELETE expands; every other type edits exactly the span the event named.
	const target = event.inputType.startsWith('delete') ? anchorsForDelete(store, event.inputType, anchors) : anchors
	if (!target) {
		dropUnexpressedInput(container, event)
		return
	}

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement)
}

function handlePaste(store: KbCtx, container: HTMLElement, event: ClipboardEvent): void {
	if (!store.tokens.selection.isAllSelected()) return

	event.preventDefault()
	const markup = consumeMarkupPaste(container)
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	store.edit.setValue(newContent)
}