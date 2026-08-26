import {inExplicitEditableIsland, nodeTarget} from '../../shared/checkers'
import type {Store} from '../../store/Store'
import {consumeMarkupPaste} from '../clipboard'
import type {Anchors} from '../tokens'
import {anchorEquals} from '../tokens'

type KbCtx = Pick<Store, 'tokens'>

/**
 * The edit target of a `beforeinput`, as anchors in the LIVE tree.
 *
 * A RANGED target range wins: it carries an extent the caret does not — the span a word
 * delete, a replacement or a drop is about — and the model has no way to re-derive it.
 *
 * A COLLAPSED one does NOT, and that is measured rather than stylistic: Chromium
 * canonicalizes a collapsed target range to the EARLIEST visually equivalent position, which
 * erases the side-of-boundary distinction the model's own caret keeps. At the leading edge of
 * a TRANSPARENT mark — a slot mark is bare by policy (`bind.ts`), so the position
 * before its first slot child and the position after the preceding text are the same pixel —
 * the caret reads `text('a'):0` INSIDE the slot while the event's target range reads
 * `text('…Slot doc: '):12` OUTSIDE the mark. Measured in the react demo app with real keys:
 * typing there spliced before the mark's markup (`X#[a…]`) while the caret sat inside it.
 * Nothing separates those two positions except which one the model placed, so the model's
 * caret is the answer.
 *
 * `domAnchors()` re-reads the LIVE selection, so it is the same authority the no-target-range
 * arm has always used; when it declines — a boundary this layer cannot resolve, or no window
 * selection at all — the target range still answers.
 *
 * IT NO LONGER HAS TO ANSWER COLLAPSED, and the condition that said so was a defect rather than a
 * safety rail. It read "unproduced in Chromium, where the live selection IS the caret the event
 * describes"; a ROW SELECTION over a frozen row falsifies that. The selection runs across the row's
 * own ELEMENT, which is not an editable extent, so Chromium reports a COLLAPSED target range at
 * the nearest position it can name — inside the row ABOVE. Measured on the showcase's bookmark: the
 * row painted as selected and the typed character appended to the quote above it. The selection the
 * user can see is the model's, so it answers here too.
 *
 * A `StaticRange` is document-ordered, so `anchor` is the low end and `head` the high one —
 * the same normalization {@link SelectionDriver.domAnchors} relies on, which is why the
 * numeric version's `start <= end` swap has no counterpart here.
 */
export function anchorsFromInputEvent(store: KbCtx, event: InputEvent): Anchors | undefined {
	const range = event.getTargetRanges().at(0)
	const live = store.tokens.domAnchors()
	if (!range) return live
	if (!range.collapsed) return anchorsFromTargetRange(store, range)
	return live ?? anchorsFromTargetRange(store, range)
}

/**
 * FAIL CLOSED: the container is the ONE editing host, so any default this guard leaves
 * standing edits DOM the model owns — there is no second editable element to absorb it.
 * Every `beforeinput` the guard cannot express as an edit is therefore dropped.
 *
 * Two things pass through:
 * - a non-cancelable event, `insertCompositionText` above all: composition is unhandled
 *   by design and cannot be cancelled anyway. NO PIN CAN GATE that early return —
 *   `preventDefault` on an uncancelable event is a no-op, so `defaultPrevented` reads
 *   `false` either way. It exists to keep Chromium from logging "Ignored attempt to
 *   cancel a beforeinput event with cancelable=false" on every composition keystroke;
 * - an edit landing inside a consumer's own editable island, per
 *   {@link inExplicitEditableIsland}.
 */
export function dropUnexpressedInput(container: HTMLElement, event: InputEvent): void {
	if (!event.cancelable) return
	if (inExplicitEditableIsland(editOrigin(event) ?? container, container)) return
	event.preventDefault()
}

/**
 * What an input event puts into the document, and WHOSE language it is written in.
 *
 * `markup` is true only for this editor's own clipboard entry, which is the value's own
 * projection — leads, openers and separators already in it. Anything else is foreign text, whose
 * line breaks mean lines and not structure, and the row world opens those as rows
 * (`rowKeys.ts`'s `writeRowsFromInput`). Splicing a projection through the same rule would write
 * a second opener in front of every line it already carries.
 */
export type Replacement = {readonly text: string; readonly markup: boolean}

const foreign = (text: string): Replacement => ({text, markup: false})

/**
 * The ONE inputType→replacement table, and since the guards folded into one there is one
 * caller too — `input.ts`'s `beforeinput` — where a per-guard copy used to be the drift
 * hazard this shared table answered. `undefined` means the type has no expression as a value
 * edit; the caller answers that with {@link dropUnexpressedInput}. The row path's single divergence,
 * insertParagraph, is decided BEFORE this table in `rowKeys.ts`'s `handleRowParagraph`, so
 * the mapping itself stays layout-free.
 */
export function replacementForInput(container: HTMLElement, event: InputEvent): Replacement | undefined {
	if (event.inputType.startsWith('delete')) return foreign('')
	if (event.inputType === 'insertFromPaste' || event.inputType === 'insertReplacementText') {
		const markup = consumeMarkupPaste(container)
		if (markup !== undefined) return {text: markup, markup: true}
		return foreign(event.dataTransfer?.getData('text/plain') ?? event.data ?? '')
	}
	if (event.inputType === 'insertText') return foreign(event.data ?? '')
	// Enter is a newline in the VALUE, not a DOM line break: the guard owns the edit, so
	// the browser never gets to build a <div>/<br> inside the host.
	if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') return foreign('\n')
	if (event.inputType === 'insertFromDrop') return foreign(event.dataTransfer?.getData('text/plain') ?? '')
	return undefined
}

/**
 * DOM the consumer owns, in either sense: a registered control root (editor UI that handles
 * its own input) or an editable island. The model must not edit on such an event NOR
 * cancel it — most sharply in the all-selected branch, which would otherwise replace the
 * WHOLE value with whatever was typed into a control's `<input>`.
 */
export function isConsumerOrigin(store: KbCtx, container: HTMLElement, event: InputEvent): boolean {
	const target = nodeTarget(event)
	if (target && store.tokens.handleAt(target) === 'control') return true
	return inExplicitEditableIsland(editOrigin(event) ?? container, container)
}

/**
 * The same verdict for a KEY event, which carries no target range: its only origin is where
 * the key was pressed. Its own export because that difference is the whole of it — a
 * `beforeinput` asks about where the edit would LAND, a keydown about where the user IS.
 *
 * The keydown tier had only half of this test (controls, and only on the select-all branch),
 * and the missing half cost the same as it would here: the branches it guards key on the
 * STORED selection, so a Ctrl+A inside a consumer's island took the model's select-all and
 * the next keystroke replaced the whole value.
 */
export function isConsumerKeyOrigin(store: KbCtx, container: HTMLElement, event: KeyboardEvent): boolean {
	const target = nodeTarget(event)
	if (!target) return false
	return store.tokens.handleAt(target) === 'control' || inExplicitEditableIsland(target, container)
}

/**
 * Does the key's origin keep an undo stack the PLATFORM owns — a text entry field, or an editable
 * island? Those are the only origins where `Mod+Z` means something other than the editor's own
 * history, and they are the whole of the exception `input.ts` runs the undo arm ahead of the
 * consumer gate for.
 *
 * A control that is NOT one of them cannot answer the key at all, and the ones a row component
 * paints — a checkbox, a `<select>`, a toggle button — edit the DOCUMENT, so the user is left
 * holding an edit that only this stack can take back. Measured: ticking a to-do left focus on the
 * `<input type=checkbox>` (the browser's own default), and the `Mod+Z` after it was swallowed
 * whole; the entry was on the stack and replayed the moment focus returned to a text row.
 *
 * `selectionStart` is the PLATFORM's own test for "this input holds text" — a number for text,
 * search, url, tel, password and email, and `null` for a checkbox, a radio, a colour or a date.
 * Enumerating the type strings here would be a second copy of that table.
 */
export function ownsPlatformUndo(container: HTMLElement, event: KeyboardEvent): boolean {
	const target = nodeTarget(event)
	if (!target) return false
	if (inExplicitEditableIsland(target, container)) return true
	const element = target instanceof Element ? target : target.parentElement
	if (element instanceof HTMLTextAreaElement) return true
	return element instanceof HTMLInputElement && element.selectionStart !== null
}

/**
 * A collapsed delete EXPANDS: onto the adjacent MARK when the caret sits exactly on one of
 * its boundaries — that is the mark swallow — onto the adjacent ROW SEPARATOR when it sits on
 * a row boundary, else by one character in the delete's direction.
 *
 * Every arm resolves against the LIVE tree, so typing right before a mark and then deleting
 * still swallows it. Gated by `input.spec`'s two "mark swallow" cases — MEASURED: inverting
 * `direction` turns BOTH red, and either one alone would only pin "some mark got deleted".
 * The browser suites (`Base/keyboard.{react,vue}.spec`) cover it end to end.
 *
 * The separator arm is what makes a delete at a row boundary a MERGE, in one mechanism with
 * every other delete — where the row path used to resolve a row from the selection and call
 * `RowNode.mergeWith`. The two expansions cannot both answer: a row's children end with a text
 * token, so no mark boundary ever coincides with a separator's. See {@link boundarySpan} for
 * the direction rules, which are the row path's own and are not symmetric.
 */
export function anchorsForDelete(store: KbCtx, inputType: string, anchors: Anchors): Anchors | undefined {
	if (!anchorEquals(anchors.anchor, anchors.head)) return anchors

	const direction = inputType.endsWith('Backward') ? -1 : 1
	const mark = store.tokens.adjacentMark(anchors.anchor, direction)
	if (mark) return {anchor: {before: mark}, head: {after: mark}}

	const boundary = store.tokens.boundarySpan(anchors.anchor, direction)
	if (boundary) return boundary

	const stepped = store.tokens.step(anchors.anchor, direction)
	if (!stepped) return undefined
	return direction === -1 ? {anchor: stepped, head: anchors.head} : {anchor: anchors.anchor, head: stepped}
}

/** Where the edit would land: the event's own target range, else the event target. */
function editOrigin(event: InputEvent): Node | undefined {
	const ranges = event.getTargetRanges()
	if (ranges.length > 0) return ranges[0].startContainer
	return event.target instanceof Node ? event.target : undefined
}

function anchorsFromTargetRange(store: KbCtx, range: StaticRange): Anchors | undefined {
	const anchor = store.tokens.anchorFor(range.startContainer, range.startOffset, 'after')
	if (!anchor) return undefined
	// ONE READ for a collapsed target range, for {@link SelectionDriver.domAnchors}'s reason:
	// the opposite affinities exist to make the ENDS of a span lean inward, so read twice
	// against a SINGLE boundary they answer two NAMES for one position — `{before: the next
	// token}` and `{after: the previous one}`. Every collapsed test downstream is
	// `anchorEquals`, so that pair reads as a RANGE: `anchorsForDelete` skips the mark swallow
	// and replaces the zero-length span between the two names, which deletes NOTHING after
	// the guard has already cancelled the browser's own delete.
	//
	// Reachable since a caret between two atomics became a CONTAINER boundary, whose two sides
	// are different nodes — Chromium's own delete target ranges are container-anchored there.
	if (range.collapsed) return {anchor, head: anchor}
	const head = store.tokens.anchorFor(range.endContainer, range.endOffset, 'before')
	if (!head) return undefined
	return {anchor, head}
}