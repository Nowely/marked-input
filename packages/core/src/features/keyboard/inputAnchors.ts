import type {Store} from '../../store/Store'
import type {Anchors} from '../tokens'

type KbCtx = Pick<Store, 'selection' | 'tokens'>

/**
 * The edit target of a `beforeinput`, as anchors in the LIVE tree: the event's own
 * `getTargetRanges()` when it has one, else the current DOM selection.
 *
 * A `StaticRange` is document-ordered, so `anchor` is the low end and `head` the high one —
 * the same normalization {@link SelectionDriver.domAnchors} relies on, which is why the
 * numeric version's `start <= end` swap has no counterpart here.
 */
export function anchorsFromInputEvent(store: KbCtx, event: InputEvent): Anchors | undefined {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.selection.domAnchors()
	return anchorsFromTargetRange(store, ranges[0])
}

function anchorsFromTargetRange(store: KbCtx, range: StaticRange): Anchors | undefined {
	const anchor = store.tokens.anchorFor(range.startContainer, range.startOffset, 'after')
	if (!anchor) return undefined
	const head = store.tokens.anchorFor(range.endContainer, range.endOffset, 'before')
	if (!head) return undefined
	return {anchor, head}
}