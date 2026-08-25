import {rowContent, sliceNodes} from './tree'
import type {Pairing, TreeNode, Window} from './types'

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
	// exactly one separator.
	const contentEnd = node.position.end - separator.length
	// The caret goes where the two halves join, which is the first row's content end in the
	// PRE-splice coordinates — the caller resolves it against the post-splice tree.
	return {kept: rowContent(node), at: contentEnd}
}

/**
 * The removal window of a ROOT row when its own span is not the whole story: the
 * document-final row owns no separator, so the boundary that leaves with it is the
 * PREVIOUS row's — deleting only the row's span would convert it into the trailing
 * empty row and leave that separator dangling, so the row count could never shrink
 * (issue 08 review finding). `undefined` everywhere else: any earlier row's span
 * already includes its separator, and non-rows keep the plain structural splice.
 */
export function removePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	const index = roots.indexOf(node)
	if (index !== roots.length - 1) return undefined
	if (index <= 0) return undefined
	const previous = roots[index - 1]
	if (previous.kind !== 'row') return undefined
	return {start: previous.position.end - separator.length, end: node.position.end}
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
		spanNode.kind === 'row' ? rowContent(spanNode) : sliceNodes(roots, {before: spanNode}, {after: spanNode})
	)
	// The replaced span reaches to `roots[high].position.end`, which carries that row's own
	// separator unless the span ends the document.
	const spanEndsDocument = high === roots.length - 1
	const text = parts.join(glue) + (spanEndsDocument ? '' : glue)

	const pairing: Pairing = [
		...roots.slice(0, low).map((_, index) => index),
		...rotate(roots.slice(low, high + 1).map((_, index) => low + index)),
		...roots.slice(high + 1).map((_, index) => high + 1 + index),
	]

	const window: Window = {
		start: roots[low].position.start,
		end: roots[high].position.end,
		insertedLength: text.length,
		pairing,
	}
	return {window, text}
}