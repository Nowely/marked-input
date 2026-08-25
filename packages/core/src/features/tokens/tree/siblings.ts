import {depthCeiling} from '../parser/core/RowScanner'
import type {RowConfig} from '../parser/types'
import {preorderRows} from './rows'
import {rowContent, sliceNodes} from './tree'
import type {Pairing, RowNode, TreeNode, Window} from './types'

/**
 * Removing the boundary between two adjacent ROWS, expressed as a REPLACEMENT OF THE FIRST:
 * the boundary is the separator between them, and deleting it is the whole merge — reparse
 * decides what the joined text becomes (issue 08's markdown-like policy: a paragraph merging
 * into a heading is absorbed by its trailing slot). No kind gate on the merged CONTENT: any
 * adjacent rows merge.
 *
 * `undefined` when the pair has no boundary to remove, fail-closed: either side is not a row
 * (only rows are separated), there is no configured separator, or the two are not actually
 * adjacent. The last cannot arise from a parse — roots TILE the document — and is checked
 * rather than assumed so a caller cannot splice across a gap it never looked at.
 */
export function mergePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	next: TreeNode,
	separator: string | undefined
): {kept: string; at: number} | undefined {
	if (node.kind !== 'row' || next.kind !== 'row') return undefined
	if (separator === undefined) return undefined
	if (node.position.end !== next.position.start) return undefined
	// Adjacency already proves the first row is not the document-final one, so its span carries
	// exactly one separator — the one after its LAST descendant, since a row's span covers its
	// subtree and the boundary between the pair sits at the end of it.
	const contentEnd = node.position.end - separator.length
	// The caret goes where the two halves join, which is the first row's content end in the
	// PRE-splice coordinates — the caller resolves it against the post-splice tree.
	return {kept: rowContent(node, separator), at: contentEnd}
}

/**
 * The removal window of the DOCUMENT-FINAL row, whose own span is not the whole story: it owns
 * no separator, so deleting only its span would convert it into the trailing empty row and leave
 * the boundary before it dangling — the row count could never shrink (issue 08 review finding).
 * `undefined` everywhere else: any earlier row's span already includes its own separator, and
 * non-rows keep the plain structural splice.
 *
 * The final row is the last in PRE-ORDER and not the last ROOT, and under nesting those are
 * different rows — the last root is an ancestor of the last row whenever the document ends
 * indented. It is always a LEAF, because a row's children follow it. `findIndex` over the live
 * walk is that test and the liveness check in one read, as `roots.indexOf` was.
 */
export function removePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	const rows = preorderRows(roots)
	if (rows.at(-1)?.row !== node) return undefined
	// Nothing precedes the document's first row, so there is no boundary to take with it.
	if (rows.length < 2) return undefined
	// The boundary that leaves is the separator BEFORE the row rather than a previous SIBLING's
	// trailing one: the pre-order join puts one between every adjacent pair at every depth, so
	// the row a nested final row is preceded by may be its own parent.
	return {start: node.position.start - separator.length, end: node.position.end}
}

/**
 * Does this row's SUBTREE end the document — the rows whose projection carries no trailing
 * separator, since the pre-order join puts one between adjacent rows and none after the last.
 * True for the last row AND for every ancestor of it, which is why it is not "the last root":
 * under nesting a whole chain of rows ends the document at once.
 *
 * Asked of the pre-order WALK and not of the spans, because the trailing empty row is
 * zero-width: the row before it ends at the document's end too, and a span test calls it final.
 */
export function endsDocument(roots: readonly TreeNode[], node: TreeNode): boolean {
	if (node.kind !== 'row') return false
	const last = preorderRows(roots).at(-1)?.row
	return last !== undefined && preorderRows([node]).at(-1)?.row === last
}

/**
 * Moving a root to another root index, as ONE splice over the affected span plus the
 * {@link Pairing} that says which sibling went where. Roots outside
 * `[min(from,to), max(from,to)]` are not touched, so the splice is as narrow as a rotation can
 * be.
 *
 * `undefined` — fail closed — when the node is not a root (`indexOf` is the liveness check and
 * the index in one read, so there is no second `reachable`), when `to` is out of range or equal
 * to `from`, when the affected roots do not TILE, or when rows are moved with no separator to
 * rejoin them by. The tiling check cannot come from a parse and is checked rather than assumed,
 * because the splice re-emits the span from those roots alone: any text between them would be
 * silently dropped.
 *
 * THE ROW NORMALIZATION IS GONE, with the stored terminator it compensated for. Rows re-emit
 * their own content and the join puts the separators back, so "the row landing document-final
 * carries none" falls out of where the span ends instead of out of a per-row fixup and its
 * fail-closed door.
 *
 * The pairing spans the WHOLE root list, not just the moved span — `resolvePairing` needs a
 * total bijection over the roots, and the untouched ones are the identity part of it.
 */
export function movePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	to: number,
	separator: string | undefined
): {window: Window; text: string} | undefined {
	const from = roots.indexOf(node)
	if (from < 0) return undefined
	if (!Number.isInteger(to) || to < 0 || to >= roots.length || to === from) return undefined

	const low = Math.min(from, to)
	const high = Math.max(from, to)
	for (let index = low; index < high; index++) {
		if (roots[index].position.end !== roots[index + 1].position.start) return undefined
	}

	const rotate = <T>(items: readonly T[]): T[] => {
		const next = [...items]
		next.splice(to - low, 0, ...next.splice(from - low, 1))
		return next
	}

	const span = rotate(roots.slice(low, high + 1))
	const movesRows = span.some(spanNode => spanNode.kind === 'row')
	if (movesRows && separator === undefined) return undefined
	const glue = movesRows ? (separator ?? '') : ''

	const parts = span.map(spanNode =>
		spanNode.kind === 'row'
			? rowContent(spanNode, separator)
			: sliceNodes(roots, {before: spanNode}, {after: spanNode})
	)
	// The replaced span reaches to `roots[high].position.end`, which carries that row's own
	// separator unless the span ends the document.
	const spanEndsDocument = high === roots.length - 1
	const text = parts.join(glue) + (spanEndsDocument ? '' : glue)

	// The pairing is over PRE-ORDER ROWS, so each root contributes the whole run of indices its
	// subtree occupies and a move carries every nested row's identity with its parent. It spans
	// the WHOLE document, not just the moved span — `resolvePairing` needs a total bijection, and
	// the untouched rows are the identity part of it. A document with no rows carries no claim at
	// all: the domain is rows, and there is nothing for it to name.
	const runs = rowIndexRuns(roots)
	const rootOrder = [
		...roots.slice(0, low).map((_, index) => index),
		...rotate(roots.slice(low, high + 1).map((_, index) => low + index)),
		...roots.slice(high + 1).map((_, index) => high + 1 + index),
	]
	const pairing: Pairing = rootOrder.flatMap(index => runs[index])

	const window: Window = {
		start: roots[low].position.start,
		end: roots[high].position.end,
		insertedLength: text.length,
		pairing: pairing.length > 0 ? pairing : undefined,
	}
	return {window, text}
}

/** Per root, the run of pre-order row indices its subtree occupies; empty for a non-row root. */
function rowIndexRuns(roots: readonly TreeNode[]): number[][] {
	let next = 0
	return roots.map(root => {
		if (root.kind !== 'row') return []
		return preorderRows([root]).map(() => next++)
	})
}

/**
 * Re-indenting one row, as the splice that REWRITES ITS WHOLE LEAD plus the {@link Pairing} that
 * keeps every row's identity across it.
 *
 * The pairing is the identity permutation and is still load-bearing: a Tab is an ordinary splice,
 * so without a hint adoption's prefix walk stops at the edit and the indented row's node — and
 * its text child — are rebuilt with fresh ids, taking the consumer's per-row state with them.
 * Pre-order is what makes the identity claim expressible at all, because the re-indent changes
 * which rows are nested where while leaving the document order alone.
 *
 * `undefined` — fail closed — for a non-row, a negative or non-integer depth, a no-op, an editor
 * with nesting off, and a depth past {@link depthCeiling}. That last is the SCAN's own clamp,
 * asked of the scan rather than re-derived: asking for more would emit a lead the parse reads as
 * something shallower, and the row would gain an indent without gaining a parent.
 *
 * It rewrites the whole lead rather than splicing it, which NORMALIZES a surplus indent run a
 * paste preserved — observable, and the alternative is two disagreeing readings of "depth".
 */
export function depthPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	depth: number,
	config: RowConfig | undefined
): {window: Window; text: string} | undefined {
	if (node.kind !== 'row' || config === undefined || config.indent === '') return undefined
	if (!Number.isInteger(depth) || depth < 0) return undefined

	const rows = preorderRows(roots)
	const at = rows.findIndex(entry => entry.row === node)
	if (at < 0) return undefined
	const before = at === 0 ? undefined : rows[at - 1]
	if (depth > depthCeiling(before && {depth: before.depth, empty: isEmptyRow(before.row)})) return undefined

	const lead = config.indent.repeat(depth)
	if (lead === node.lead()) return undefined

	return {
		window: {
			start: node.position.start,
			end: node.position.start + node.lead().length,
			insertedLength: lead.length,
			pairing: rows.map((_, index) => index),
		},
		text: lead,
	}
}

/** The scan's own emptiness, read off the node: a row whose whole LINE is empty. */
function isEmptyRow(row: RowNode): boolean {
	return row.lead() === '' && row.descriptor() === undefined && row.slot() === ''
}