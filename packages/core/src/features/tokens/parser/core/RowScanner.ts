import type {GapType} from '../constants'
import {GAP_TYPE} from '../constants'
import type {RowConfig, RowToken} from '../types'
import type {MarkupDescriptor} from './MarkupDescriptor'

/**
 * The block skeleton, carved BEFORE any inline matching (ADR-0010). Two linear passes over the
 * value: at each row's own start it reads the row's lead and its kind from the literals there,
 * then {@link nest} folds the flat run into a tree. Everything between a row's body edges is left
 * for the inline pass to parse.
 *
 * The inversion is what removes the mutual dependence the row pass existed to resolve. Separators
 * and matches used to decide each other — a match hid the separators inside its extent, and a
 * separator bounded a match's open trailing gap — so the derivation had to run to a fixpoint. A
 * row's structure is now decided by its own first bytes alone, and an inline match can never
 * reach past the row it is inside.
 *
 * Emits `children: []`; `Parser.parseRows` fills them per row.
 */
export function scanRows(
	value: string,
	kinds: readonly MarkupDescriptor[],
	config: RowConfig,
	splits: ReadonlyMap<MarkupDescriptor, RowCarve> = new Map()
): RowToken[] {
	const {separator, indent} = config
	const flat: Scanned[] = []
	let at = 0

	for (;;) {
		// The row's own separator: the bound every NON-body gap must close before, and the body
		// bound of a kind that has no closing literal.
		const found = value.indexOf(separator, at)
		const rowEnd = found === -1 ? value.length : found

		// THE LEAD: the maximal run of whole indent units at the row's own start. Bounded by the
		// row's own separator, so an indent that happens to contain one cannot swallow a boundary
		// and leave the scan unable to advance.
		let bodyStart = at
		if (indent.length > 0) {
			while (bodyStart + indent.length <= rowEnd && value.startsWith(indent, bodyStart)) {
				bodyStart += indent.length
			}
		}

		const match = matchKind(value, bodyStart, rowEnd, kinds, separator)
		const slot = match?.slot ?? {start: bodyStart, end: rowEnd}
		const contentEnd = match?.end ?? rowEnd
		// A closed kind may have carried the body across separators, so the row's own end is read
		// at the match's end rather than at `rowEnd`.
		const terminated = value.startsWith(separator, contentEnd)
		const end = terminated ? contentEnd + separator.length : contentEnd

		flat.push({
			row: {
				type: 'row',
				content: value.slice(at, end),
				position: {start: at, end},
				descriptor: match?.descriptor,
				meta: match?.meta,
				lead: value.slice(at, bodyStart),
				slot: {content: value.slice(slot.start, slot.end), start: slot.start, end: slot.end},
				children: [],
				rows: [],
			},
			// The lead is a run of whole units, so the division is exact; with nesting off every
			// row is a root.
			depth: indent.length > 0 ? (bodyStart - at) / indent.length : 0,
			// A row whose own line is empty, and a row whose body is about to become its children,
			// are the same fact to the pass below: neither can hold a nested row.
			childless: contentEnd === at || (match !== undefined && splits.has(match.descriptor)),
		})

		// The piece after the final separator is a row even when empty (ADR-0009's trailing
		// convention): Enter at the document end always yields a visible row.
		if (!terminated) break
		at = end
	}

	const roots = nest(flat, value)
	carve(roots, value, splits)
	return roots
}

type Scanned = {row: RowToken; depth: number; childless: boolean}

/** A kind's declared carve: the delimiter, and the kind the rows it produces take. */
export type RowCarve = {at: string; as: MarkupDescriptor}

/**
 * How deep a row may sit, given the row before it — TWO rules, both measured rather than assumed.
 * A row descends AT MOST ONE LEVEL past the row before it, so an over-indented paste renders
 * shallower while its surplus bytes stay verbatim in `lead` and round-trip. And A CHILDLESS ROW
 * TAKES NO CHILDREN, which is two rows in one word: an EMPTY one — without it `'- a⏎⏎⇥- b'` makes
 * the blank paragraph the parent of the bullet, which under a one-newline separator is one
 * keystroke away — and a row whose kind CARVES its body, whose children are that body and can hold
 * nothing else. `undefined` is the document's first row, which is always a root.
 *
 * Exported because a re-indent answers to the same ceiling: `depthPlan` re-deriving it drifted
 * from the empty-row rule and let `setDepth` write a lead this pass then reads as something
 * shallower.
 */
export function depthCeiling(previous: {depth: number; childless: boolean} | undefined): number {
	if (previous === undefined) return 0
	return previous.childless ? previous.depth : previous.depth + 1
}

/**
 * The stack pass: a flat run of scanned rows becomes a tree, and nesting is indentation and
 * nothing else.
 */
function nest(flat: readonly Scanned[], value: string): RowToken[] {
	const roots: RowToken[] = []
	// The open ancestors, `stack[d]` being the row currently at depth `d`.
	const stack: RowToken[] = []
	let previous: {depth: number; childless: boolean} | undefined

	for (const scanned of flat) {
		// The CLAMPED depth is what the next row measures against — an over-indented row parents
		// from where it landed, not from where its lead asked to go.
		const depth = Math.min(scanned.depth, depthCeiling(previous))
		stack.length = depth
		const parent = stack.at(-1)
		if (parent) parent.rows.push(scanned.row)
		else roots.push(scanned.row)
		stack.push(scanned.row)
		previous = {depth, childless: scanned.childless}
	}

	// A parent's span covers its subtree, so rows keep TILING the value at every depth — which is
	// what leaves every walk that relies on ascending sibling positions untouched.
	for (const root of roots) extendOverSubtree(root, value)
	return roots
}

function extendOverSubtree(row: RowToken, value: string): number {
	let end = row.position.end
	for (const child of row.rows) end = extendOverSubtree(child, value)
	if (end !== row.position.end) {
		row.position.end = end
		row.content = value.slice(row.position.start, end)
	}
	return end
}

/**
 * THE CARVE: a kind that declares one takes its own BODY apart at a literal, and each piece
 * becomes an ordinary row. A cell is not a new node kind — it is a row whose structural bytes are
 * the delimiter it was carved at, held in its `lead` exactly as an indent run is, so the round trip
 * is concatenation and the projection needs no rule of its own.
 *
 * The pieces tile the body with no gap, so sibling positions still ascend and every walk that
 * relies on that is untouched. Carved rows are the row's whole content — the nest pass gave it no
 * children, and the inline pass parses each piece rather than the body — so a body holding N
 * delimiters is N+1 rows, INCLUDING the empty ones a leading, doubled or trailing delimiter
 * produces. A cell therefore cannot contain its own delimiter; that is the declared limitation, and
 * an escape scoped to a cell's body is the named follow-up.
 *
 * ONE LEVEL, deliberately: the rows a carve produces are not carved again, even when their own kind
 * declares a split. A kind naming itself as its cells' kind would otherwise never terminate, and
 * nothing wants a cell of a cell.
 */
function carve(rows: readonly RowToken[], value: string, splits: ReadonlyMap<MarkupDescriptor, RowCarve>): void {
	for (const row of rows) {
		const split = row.descriptor && splits.get(row.descriptor)
		if (!split) {
			carve(row.rows, value, splits)
			continue
		}
		const {start, end} = row.slot
		let at = start
		let lead = ''
		for (;;) {
			const found = value.indexOf(split.at, at)
			// The delimiter has to FIT inside the body, not merely start in it: one straddling the
			// row's closing literal would put a piece's lead past its own slot.
			const piece = found === -1 || found + split.at.length > end ? end : found
			row.rows.push({
				type: 'row',
				content: value.slice(at - lead.length, piece),
				position: {start: at - lead.length, end: piece},
				descriptor: split.as,
				meta: undefined,
				lead,
				slot: {content: value.slice(at, piece), start: at, end: piece},
				children: [],
				rows: [],
			})
			if (piece === end) break
			lead = split.at
			at = piece + split.at.length
		}
	}
}

type KindMatch = {descriptor: MarkupDescriptor; end: number; slot: {start: number; end: number}; meta?: string}

function matchKind(
	value: string,
	at: number,
	rowEnd: number,
	kinds: readonly MarkupDescriptor[],
	separator: string
): KindMatch | undefined {
	for (const descriptor of kinds) {
		const match = tryKind(value, at, rowEnd, descriptor, separator)
		if (match) return match
	}
	return undefined
}

/**
 * One kind against one row start. The walk is literal-only: the opener must sit exactly at the
 * row's start, and every following literal is found forward with `indexOf`.
 *
 * Two bounds, and both are load-bearing rather than decorative:
 *
 * - ONLY THE BODY GAP MAY CROSS A SEPARATOR. A metadata gap whose closing literal starts past the
 *   row's own separator is refused, so `'- [x hi⏎there] more'` stays two rows instead of becoming
 *   one todo whose meta swallowed the next row. The test is on where the closer STARTS: a fence's
 *   meta closes ON the separator, which must still be accepted.
 * - A CLOSED KIND MUST END AT A SEPARATOR OR AT END OF INPUT. Without it
 *   '```ts⏎q⏎``` tail⏎next' produces a row ending mid-line and a following row starting mid-line,
 *   which contradicts the one premise the whole scan rests on — that a row is decided at its own
 *   start.
 */
function tryKind(
	value: string,
	at: number,
	rowEnd: number,
	descriptor: MarkupDescriptor,
	separator: string
): KindMatch | undefined {
	const opener = descriptor.segments[0]
	if (typeof opener !== 'string' || !value.startsWith(opener, at)) return undefined

	let cursor = at + opener.length
	let body: {start: number; end: number} | undefined
	let meta: string | undefined

	for (const [gap, type] of descriptor.gapTypes.entries()) {
		const closer = descriptor.segments[gap + 1]
		const start = cursor
		let end: number

		if (typeof closer !== 'string') {
			// No closing literal: the kind is OPEN and its body runs to the row's own separator.
			end = rowEnd
			cursor = end
		} else {
			const closerStart = value.indexOf(closer, start)
			if (closerStart === -1) return undefined
			if (!isBody(type) && closerStart > rowEnd) return undefined
			end = closerStart
			cursor = closerStart + closer.length
		}

		if (isBody(type)) body = {start, end}
		else meta = value.slice(start, end)
	}

	if (!body) return undefined
	if (cursor !== value.length && !value.startsWith(separator, cursor)) return undefined
	return {descriptor, end: cursor, slot: body, meta}
}

function isBody(type: GapType): boolean {
	return type === GAP_TYPE.Slot || type === GAP_TYPE.Value
}