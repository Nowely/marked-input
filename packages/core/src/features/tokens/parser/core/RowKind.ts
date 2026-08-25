import type {GapType} from '../constants'
import {GAP_TYPE, PLACEHOLDER} from '../constants'
import type {Markup} from '../types'
import type {MarkupDescriptor} from './MarkupDescriptor'
import {createMarkupDescriptor, markupError} from './MarkupDescriptor'

/**
 * A row KIND is a compiled markup, recognised by a different recognizer: the row scanner reads
 * it as a run of literals at a row's own start, where the inline matcher reads a mark's segments
 * anywhere. One compiler serves both — {@link createMarkupDescriptor} — so a row kind and a mark
 * share the markup language, the placeholder vocabulary and the option index that resolves a
 * component.
 *
 * The scan needs more of the markup than the alternation does: it walks `segments` as literals in
 * order, so a kind whose compilation left a gap without a literal on its left, or an inner gap
 * without one on its right, cannot be recognised at all. The rules below are what makes the walk
 * total rather than defensive.
 */

/** The literal a row kind is recognised by: the markup's first segment. */
export function rowOpener(markup: Markup): string {
	const first = createMarkupDescriptor(markup, 0).segments[0]
	// A markup may not BEGIN with a placeholder (`markupError`), so the first segment of a
	// well-formed row markup is always a literal; `rowMarkupError` runs first at every call site.
	return typeof first === 'string' ? first : ''
}

/**
 * The row markup's rule violation, or `undefined` when it is well-formed — the row analogue of
 * `markupError`, for the same non-throwing caller. It reports the mark rules first, because a row
 * markup is a markup: the leading-placeholder ban is what makes line-start recognition decidable
 * at all.
 */
export function rowMarkupError(markup: Markup): string | undefined {
	const invalid = markupError(markup)
	if (invalid) return invalid

	const descriptor = createMarkupDescriptor(markup, 0)
	const bodyGaps = descriptor.gapTypes.filter(isBody)

	// ONE body gap, and its kind decides whether the body is inline-parsed (`__slot__`) or raw
	// (`__value__`). Two bodies would leave the scan with no rule for which one a row's text is,
	// and none at all would leave a row kind with nowhere to put the row's own content.
	if (bodyGaps.length !== 1) {
		return (
			`Invalid row markup: "${markup}". A row kind needs exactly one "${PLACEHOLDER.Slot}" or ` +
			`"${PLACEHOLDER.Value}" for its body, got ${bodyGaps.length}`
		)
	}

	// The two-value form compiles its literals into DYNAMIC segments, which the row walk cannot
	// read: it matches literals with `indexOf`, never a pattern. Ruled out by the body count
	// above, and stated so the walk's `typeof segment === 'string'` refusal has a named reason.
	if (descriptor.hasTwoValues) {
		return `Invalid row markup: "${markup}". A row opener is a literal scan, so it takes no second "${PLACEHOLDER.Value}"`
	}

	// Every gap needs a literal in front of it, and every gap but the last needs one behind it —
	// otherwise two placeholders touch and no scan can say where one ends.
	if (descriptor.segments.length < descriptor.gapTypes.length) {
		return `Invalid row markup: "${markup}". Two placeholders touch, so a literal scan cannot tell them apart`
	}

	return undefined
}

/** A gap that holds the row's own content, as opposed to its metadata. */
function isBody(type: GapType): boolean {
	return type === GAP_TYPE.Slot || type === GAP_TYPE.Value
}

/**
 * Scan order: LONGEST OPENER FIRST, then option index. `'- [__meta__] __slot__'` and
 * `'- __slot__'` both open at `'- '`, and only the longer opener distinguishes a todo from a
 * bullet; ties fall back to the index so the order a consumer wrote is what breaks them.
 */
export function orderRowKinds(kinds: readonly MarkupDescriptor[]): MarkupDescriptor[] {
	return kinds.toSorted((a, b) => openerLength(b) - openerLength(a) || a.index - b.index)
}

function openerLength(descriptor: MarkupDescriptor): number {
	const first = descriptor.segments[0]
	return typeof first === 'string' ? first.length : 0
}