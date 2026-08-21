import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'props' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import {
	anchorsForDelete,
	anchorsForInput,
	anchorsFromInputEvent,
	dropUnexpressedInput,
	isConsumerKeyOrigin,
	isConsumerOrigin,
} from './beforeInput'

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
		handleDeleteKey(store, e)
	})
}

function handleDeleteKey(store: KbCtx, event: KeyboardEvent): void {
	if (store.props.layout.isBlock()) return
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

	const anchors = store.tokens.domAnchors()
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

	// Block layout's own guard is `blockEdit`'s `handleBlockBeforeInput`, which fails
	// closed the same way this tail does.
	if (store.props.layout.isBlock()) return

	const anchors = anchorsFromInputEvent(store, event)
	const replacement = replacementForInput(container, event)
	if (anchors === undefined || replacement === undefined) {
		dropUnexpressedInput(container, event)
		return
	}

	const target = anchorsForInput(store, event, anchors)
	if (!target) {
		dropUnexpressedInput(container, event)
		return
	}

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement)
}

function replacementForInput(container: HTMLElement, event: InputEvent): string | undefined {
	if (event.inputType.startsWith('delete')) return ''
	if (event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') {
		const markup = consumeMarkupPaste(container)
		return markup ?? event.dataTransfer?.getData('text/plain') ?? event.data ?? ''
	}
	if (event.inputType === 'insertText') return event.data ?? ''
	// Enter is a newline in the VALUE, not a DOM line break: the guard owns the edit, so
	// the browser never gets to build a <div>/<br> inside the host.
	if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') return '\n'
	if (event.inputType === 'insertFromDrop') return event.dataTransfer?.getData('text/plain') ?? ''
	return undefined
}

function handlePaste(store: KbCtx, container: HTMLElement, event: ClipboardEvent): void {
	if (!store.tokens.selection.isAllSelected()) return

	event.preventDefault()
	const markup = consumeMarkupPaste(container)
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	store.edit.setValue(newContent)
}