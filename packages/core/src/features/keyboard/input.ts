import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'edit' | 'history' | 'overlay' | 'rows' | 'tokens'>
import {captureMarkupPaste, consumeMarkupPaste} from '../clipboard'
import {
	anchorsForDelete,
	anchorsFromInputEvent,
	dropUnexpressedInput,
	isConsumerKeyOrigin,
	isConsumerOrigin,
	ownsPlatformUndo,
	replacementForInput,
} from './beforeInput'
import {
	demoteAtRowEntry,
	handleRowEnter,
	handleRowIndent,
	handleRowParagraph,
	handleRowSelection,
	replaceRowSelection,
	widenRowScope,
	writeRowsFromInput,
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
		// THE EDITOR'S OWN UNDO (ADR-0012), and it is the ONE arm that runs ahead of the
		// consumer-origin gate below, because a consumer control's edit is an edit to the
		// DOCUMENT and this stack is the only thing that can take it back. Ticking a to-do
		// leaves focus on the `<input type=checkbox>` — the browser's own default, reached by
		// the plainest gesture the page has — and the gate then swallowed the `Mod+Z` after it
		// whole. The entry was on the stack the whole time and replayed the moment focus
		// returned to a text row; only the key was dead.
		//
		// It cancels whether or not there is anything to undo: the browser's stack is empty by
		// construction — every input path prevents its default (ADR-0006) — so leaving the key
		// alone would produce nothing anyway, and letting it through would be a promise this
		// editor cannot keep. `code`, like select-all below, because the physical key is the
		// shortcut. {@link ownsPlatformUndo} is the exception: a text field or an editable island
		// has a stack of its own, and that one is not ours to take.
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !ownsPlatformUndo(container, e)) {
			e.preventDefault()
			if (e.shiftKey) store.history.redo()
			else store.history.undo()
			return
		}

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
		// rows are values too. Where the document has rows it gains ONE rung below that: while a row
		// selection stands inside a NESTED row, Mod+A widens to the row it is nested in before it
		// reaches for the whole document. Everywhere else — every inline editor, and every caret
		// that has not been escalated with Esc — the rung declines and this is select-all as it was.
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
			e.preventDefault()
			if (!widenRowScope(store)) store.tokens.selection.selectAll()
			return
		}

		if (handleLineBoundary(store, e)) return

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

/**
 * HOME AND END, and the shifted pair with them — the caret to its visual line's edge. Answers
 * whether it consumed the key.
 *
 * THE EDITOR OWNS THESE TWO KEYS, which is a change and not a repair of one: on macOS the browser
 * binds them to SCROLLING the document, so inside any page with room left to scroll the key
 * scrolled and the caret stayed where it was — then the next press, with nothing left to scroll,
 * moved it. Measured with no editor in the page at all, so this is not a defect the editor
 * introduced; it is the platform's answer, and it is the wrong one for a field whose content is
 * the thing being navigated. See {@link DomModel.moveToLineBoundary} for the primitive.
 *
 * A MODIFIER LEAVES IT ALONE. Cmd+Left/Right is macOS's own line-edge pair and Ctrl+Home is the
 * document edge everywhere else; both belong to the platform, and this arm only claims the bare
 * key. It is also AFTER the consumer-origin gate above, so a `<select>`, an `<input>` or an
 * editable island inside a row keeps its own Home and End.
 */
function handleLineBoundary(store: KbCtx, event: KeyboardEvent): boolean {
	if (event.key !== KEYBOARD.HOME && event.key !== KEYBOARD.END) return false
	if (event.ctrlKey || event.metaKey || event.altKey) return false
	if (!store.tokens.moveToLineBoundary(event.key === KEYBOARD.END ? 'forward' : 'backward', event.shiftKey)) {
		return false
	}
	event.preventDefault()
	return true
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

	// The ROW arms, and they sit HERE rather than beside this one so they inherit every check above.
	// At a row's own entry Backspace DEMOTES — depth first, then kind — and only once the row has
	// neither left does the expansion below take the boundary and merge the two rows. Over a ROW
	// SELECTION the rows themselves leave, openers and all; deleting the span between the anchors
	// instead left the first row's opener standing as an empty row of that kind.
	if (event.key === KEYBOARD.BACKSPACE && demoteAtRowEntry(store, anchors)) {
		event.preventDefault()
		return
	}
	if (store.tokens.replaceRows(anchors, null)) {
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
		store.edit.setValue(replacement.text)
		return
	}

	// The ROW ARM, after the two checks above and answering only where the document has rows. It used to
	// be a second CAPTURE listener on this same container, which repeated the control-root half
	// of `isConsumerOrigin`, skipped whatever this one had already prevented, and — the reason
	// this order matters — never took the island half at all. Everything past it is shared: the
	// row tail was a copy of the one below.
	if (handleRowParagraph(store, container, event)) return

	const anchors = anchorsFromInputEvent(store, event)
	const replacement = replacementForInput(container, event)
	if (anchors === undefined || replacement === undefined) {
		dropUnexpressedInput(container, event)
		return
	}

	// The two ROW arms, which need both of the reads above. A paste or a cut over whole rows writes
	// over their LINES, which no pair of anchors can address; a clip that crosses rows opens a row
	// per line through the same plan Enter's split writes, in whichever language it arrived in.
	if (replaceRowSelection(store, event, anchors, replacement)) {
		event.preventDefault()
		return
	}
	if (writeRowsFromInput(store, anchors, replacement)) {
		event.preventDefault()
		return
	}

	// Only a DELETE expands; every other type edits exactly the span the event named.
	const target = event.inputType.startsWith('delete') ? anchorsForDelete(store, event.inputType, anchors) : anchors
	if (!target) {
		dropUnexpressedInput(container, event)
		return
	}

	event.preventDefault()
	store.edit.replace(target.anchor, target.head, replacement.text)
}

function handlePaste(store: KbCtx, container: HTMLElement, event: ClipboardEvent): void {
	if (!store.tokens.selection.isAllSelected()) return

	event.preventDefault()
	const markup = consumeMarkupPaste(container)
	const newContent = markup ?? event.clipboardData?.getData('text/plain') ?? ''
	store.edit.setValue(newContent)
}