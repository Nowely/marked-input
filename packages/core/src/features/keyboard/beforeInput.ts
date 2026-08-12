import {nodeTarget} from '../../shared/checkers'
import type {Store} from '../../store/Store'
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
 * a TRANSPARENT mark — a slot mark is bare by policy (`editableState.ts`), so the position
 * before its first slot child and the position after the preceding text are the same pixel —
 * the caret reads `text('a'):0` INSIDE the slot while the event's target range reads
 * `text('…Slot doc: '):12` OUTSIDE the mark. Measured in the react demo app with real keys:
 * typing there spliced before the mark's markup (`X#[a…]`) while the caret sat inside it.
 * Nothing separates those two positions except which one the model placed, so the model's
 * caret is the answer.
 *
 * `domAnchors()` re-reads the LIVE selection, so it is the same authority the no-target-range
 * arm has always used; when it declines — a boundary this layer cannot resolve, or no window
 * selection at all — the target range still answers. It must also ANSWER COLLAPSED to stand in
 * for a collapsed event: a ranged reading of a caret event would replace text the browser
 * never named. Unproduced in Chromium, where the live selection IS the caret the event
 * describes, and cheap enough to close by construction rather than by argument.
 *
 * A `StaticRange` is document-ordered, so `anchor` is the low end and `head` the high one —
 * the same normalization {@link SelectionDriver.domAnchors} relies on, which is why the
 * numeric version's `start <= end` swap has no counterpart here.
 */
export function anchorsFromInputEvent(store: KbCtx, event: InputEvent): Anchors | undefined {
	const range = event.getTargetRanges().at(0)
	if (!range) return store.tokens.domAnchors()
	if (!range.collapsed) return anchorsFromTargetRange(store, range)
	const live = store.tokens.domAnchors()
	return live && anchorEquals(live.anchor, live.head) ? live : anchorsFromTargetRange(store, range)
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
 * DOM the consumer owns, in either sense: a registered control root (chrome that handles
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
 * The `contentEditable` PROPERTY, never `isContentEditable` — the distinction is the whole
 * test, and it is what `domBoundary`'s twin walk cannot be reused for. That one stops at a
 * MARK, which is `ce=false`, so inherited editability under it can only come from an
 * island. This one stops at the CONTAINER, and every model-owned element below it either
 * inherits `true` from the host (bare text surfaces, slot marks and their slot hosts) or
 * declares `false` (value-only mark roots and mark chrome). So an INHERITED reading calls
 * every ordinary edit an island and fails the guard OPEN, while the property answers
 * `'inherit'` for exactly the bare ones. MEASURED — `input.spec`'s 'fails an unhandled
 * type closed even when it originates BELOW the container' is red under the inherited
 * test and green under this one.
 *
 * The property over the raw attribute because Chromium normalizes the spellings: an
 * island written `contenteditable=""` or `contenteditable="TRUE"` answers `'true'` here
 * (both pinned), where a string compare on `getAttribute` would miss it and cancel the
 * consumer's input.
 */
function inExplicitEditableIsland(origin: Node, container: HTMLElement): boolean {
	let current = origin instanceof Element ? origin : origin.parentElement
	while (current && current !== container) {
		if (current instanceof HTMLElement) {
			if (current.contentEditable === 'true' || current.contentEditable === 'plaintext-only') return true
		}
		current = current.parentElement
	}
	return false
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