import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'block' | 'edit' | 'history' | 'overlay' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import {
	anchorsForDelete,
	anchorsFromInputEvent,
	dropUnexpressedInput,
	isConsumerKeyOrigin,
	isConsumerOrigin,
	replacementForInput,
} from './beforeInput'
import {
	demoteAtRowEntry,
	handleRowEnter,
	handleRowIndent,
	handleRowParagraph,
	handleRowSelection,
	widenRowScope,
} from './rowKeys'

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
		// block rows are values too. In block layout it gains ONE rung below that: while a row
		// selection stands inside a NESTED row, Mod+A widens to the row it is nested in before it
		// reaches for the whole document. Everywhere else — every inline editor, and every caret
		// that has not been escalated with Esc — the rung declines and this is select-all as it was.
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
			e.preventDefault()
			if (!widenRowScope(store)) store.tokens.selection.selectAll()
			return
		}

		// THE EDITOR'S OWN UNDO (ADR-0012), and it cancels whether or not there is anything to
		// undo: the browser's stack is empty by construction — every input path prevents its
		// default (ADR-0006) — so leaving the key alone would produce nothing anyway, and letting
		// it through would be a promise this editor cannot keep. `code`, like select-all above,
		// because the physical key is the shortcut.
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
			e.preventDefault()
			if (e.shiftKey) store.history.redo()
			else store.history.undo()
			return
		}
		// The ROW arms, after the shared checks and answering only where the value parses into
		// rows. They used to be a second keydown listener on this same container that repeated
		// both checks; Backspace's row arm is the one that is not here, because it belongs INSIDE
		// the delete arm rather than beside it.
		handleRowEnter(store, e)
		handleRowIndent(store, e)
		handleRowSelection(store, e)
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

	// DOM TRUTH, and nothing behind it. Both layouts resolve a delete the same way since
	// `anchorsForDelete` learned the row separator; the row-edge fallback that used to sit here
	// answered off the STORED anchors, which is not a caret, and no user reached it.
	const anchors = store.tokens.domAnchors()
	if (!anchors) return

	// The ROW arm, and it sits HERE rather than beside this one so it inherits every check above:
	// at a row's own entry Backspace DEMOTES — depth first, then kind — and only once the row has
	// neither left does the expansion below take the boundary and merge the two rows.
	if (event.key === KEYBOARD.BACKSPACE && demoteAtRowEntry(store, anchors)) {
		event.preventDefault()
		return
	}

	const inputType = event.key === KEYBOARD.BACKSPACE ? 'deleteContentBackward' : 'deleteContentForward'
	const target = anchorsForDelete(store, inputType, anchors)

	// CANCELLED WHETHER OR NOT THE MODEL CAN EXPRESS IT, which is ADR-0006's rule and the one
	// place a plain delete was still leaking out of it. `undefined` means the neighbour is not
	// anchorable — a raw closed body's closing literal, a document edge — and declining here does
	// not leave the key alone: Chromium then emits its OWN `deleteContentForward` carrying a
	// RANGED target range, which outranks the live caret downstream and is applied verbatim.
	// Measured on a fence: `'```bash⏎ls⏎```⏎plain'` with the caret at the end of `ls` emitted
	// `'```bash⏎lsplain'` — the closing line and the kind gone, from one keystroke. There is no
	// merge to offer across such a boundary in either direction, so the key is consumed and does
	// nothing, which is Backspace's answer at a carved piece's start.
	//
	// The extents that legitimately need the browser's own event — a word or line delete — never
	// reach here: the modifier test above declines ahead of this.
	event.preventDefault()
	if (!target) return
	store.edit.replace(target.anchor, target.head, '')
}

function handleBeforeInput(store: KbCtx, container: HTMLElement, event: InputEvent): void {
	// Consumer DOM is neither edited nor cancelled here, and the all-selected branch below
	// is why this has to come FIRST: it keys on the STORED selection, not on where the
	// event came from, so a character typed into a control's own `<input>` would replace
	// the entire value with that character.
	if (isConsumerOrigin(store, container, event)) return

	// The same two commands as the keydown arm, in the spelling that does NOT come from a key: the
	// Edit menu, a trackpad gesture, a touch keyboard's own undo. Ahead of the all-selected branch,
	// which would otherwise read them as a replacement of the whole value, and ahead of the
	// replacement table, which has no expression for them — so this is what stops both types
	// failing closed through `dropUnexpressedInput` (ADR-0012 amends ADR-0006).
	if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
		event.preventDefault()
		if (event.inputType === 'historyUndo') store.history.undo()
		else store.history.redo()
		return
	}

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