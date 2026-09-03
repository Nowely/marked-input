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

/**
 * What a row option declares to the PARSER, per option index — `false` or absent for a mark
 * option, `true` for a plain row kind, and a {@link RowSplit} for a kind that carves its own body.
 * Everything else a `RowSpec` holds is behaviour the tree and the keymap read; none of it reaches
 * the parse.
 */
export type RowDeclaration = boolean | RowSplit

/**
 * A kind that carves its OWN body into child rows at a literal — a table row into cells. `as` is
 * the OPTION INDEX the carved rows take as their kind, which is the same identity `resolveSlot`
 * resolves a component by, and it may name an option with no markup at all (below).
 */
export type RowSplit = {at: string; as: number}

/** The split a declaration carries, or `undefined` for a kind that carves nothing. */
export function rowSplitOf(declaration: RowDeclaration | undefined): RowSplit | undefined {
	return typeof declaration === 'object' ? declaration : undefined
}

/**
 * THE KIND A SPLIT GIVES THE ROWS IT CARVES, for an option that declares `row` and no `markup`.
 *
 * Its markup is the bare `__slot__` placeholder, which annotates to its body and nothing else —
 * exactly what a carved row needs, since its structural bytes are its LEAD (the delimiter it was
 * carved at) and it has no opener of its own. The compiler cannot produce it: a markup that
 * annotates to identity must BEGIN with a placeholder, and `validateMarkup` bans that for both
 * recognizers — the inline alternation has nothing to delimit such a gap on the left, and line-start
 * recognition would be undecidable. This kind meets neither recognizer, which is what makes the
 * exception sound rather than a hole: a descriptor with no first segment is refused by the row scan
 * (`tryKind`) and is never entered into the alternation at all.
 */
export function splitCellKind(index: number): MarkupDescriptor {
	return {
		markup: PLACEHOLDER.Slot,
		index,
		segments: [],
		gapTypes: [GAP_TYPE.Slot],
		hasSlot: true,
		hasTwoValues: false,
		trailingGap: GAP_TYPE.Slot,
		segmentGlobalIndices: [],
	}
}

/** The literal a row kind is recognised by: the markup's first segment. */
export function rowOpener(markup: Markup): string {
	const first = createMarkupDescriptor(markup, 0).segments[0]
	// A markup may not BEGIN with a placeholder (`markupError`), so the first segment of a
	// well-formed row markup is always a literal; `rowMarkupError` runs first at every call site.
	return typeof first === 'string' ? first : ''
}

/**
 * The literal the row's BODY ends at, or `undefined` when the body runs to the row's own separator.
 *
 * It is the one thing that decides whether a kind can reach past its own row: `tryKind` bounds
 * every metadata gap by the separator and lets the body gap alone cross it, so a body with a closing
 * literal is a body that may take the rows below.
 */
export function rowCloser(markup: Markup): string | undefined {
	const {segments, gapTypes} = createMarkupDescriptor(markup, 0)
	// `rowMarkupError` runs first at every call site, so there is exactly one body gap.
	const body = gapTypes.findIndex(isBody)
	const closer = body === -1 ? undefined : segments[body + 1]
	return typeof closer === 'string' ? closer : undefined
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
export function isBody(type: GapType): boolean {
	return type === GAP_TYPE.Slot || type === GAP_TYPE.Value
}

/**
 * Scan order: LONGEST OPENER FIRST. `'- [__meta__] __slot__'` and `'- __slot__'` both open at
 * `'- '`, and only the longer opener distinguishes a todo from a bullet.
 *
 * The index tie-break settles nothing a document can see: two DISTINCT openers of equal length
 * never both match at one position, and two IDENTICAL ones cannot coexist — `usableOptions` drops
 * the later option and reports it. Kept so the order does not rest on `toSorted`'s stability over
 * a list `MarkupRegistry` happens to push in index order; deleting it was measured green.
 *
 * A shared PREFIX is a different matter, and this order is what makes it safe: the longer opener
 * is tried first, so the shorter kind never claims a row the longer one names. That holds only
 * while the longer kind ends at its own row — one whose body closes at a literal rows below
 * reaches past every kind sharing its prefix, and `usableOptions` drops it before this order can
 * be relied on (`shadowedRowKinds`).
 */
export function orderRowKinds(kinds: readonly MarkupDescriptor[]): MarkupDescriptor[] {
	return kinds.toSorted((a, b) => openerLength(b) - openerLength(a) || a.index - b.index)
}

function openerLength(descriptor: MarkupDescriptor): number {
	const first = descriptor.segments[0]
	return typeof first === 'string' ? first.length : 0
}