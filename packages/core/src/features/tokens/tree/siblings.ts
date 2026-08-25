import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import {depthCeiling} from '../parser/core/RowScanner'
import type {RowConfig} from '../parser/types'
import {offsetOfAnchor, rowBoundary} from './anchors'
import {preorderRows} from './rows'
import {rowContent, rowMarkup, sliceNodes} from './tree'
import type {NodeAnchor, Pairing, RowNode, RowPatch, TreeNode, Window} from './types'

/**
 * Removing the boundary between two rows, as the window that holds them apart — see
 * {@link rowBoundary} for what is in it. Deleting it is the whole merge; reparse decides what the
 * joined text becomes (issue 08's markdown-like policy). No kind gate on the merged CONTENT: any
 * adjacent rows merge, and the survivor keeps the FIRST row's kind because the second row's
 * opener is part of the boundary.
 *
 * ADJACENT IN PRE-ORDER, not in the root list, and the difference is the whole of nesting: a
 * parent's boundary is with its FIRST CHILD, whose span starts inside the parent's own. Reading
 * the spans as `node.position.end === next.position.start` refused every parent/child pair, which
 * is every Backspace at the start of an indented row.
 *
 * `undefined` when the pair has no boundary to remove, fail-closed: either side is not a row
 * (only rows are separated), there is no configured separator, or the two are not actually
 * adjacent. The last is checked rather than assumed so a caller cannot splice across a gap it
 * never looked at, and the pre-order lookup is the liveness check with it.
 */
export function mergePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	next: TreeNode,
	separator: string | undefined
): {start: number; end: number} | undefined {
	if (node.kind !== 'row' || next.kind !== 'row') return undefined
	if (separator === undefined) return undefined
	const rows = preorderRows(roots)
	const at = rows.findIndex(entry => entry.row === node)
	if (at < 0 || rows[at + 1]?.row !== next) return undefined
	return rowBoundary(node, next, separator)
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

/**
 * Retyping one row, as the splice that rewrites ITS OWN LINE BODY and nothing else.
 *
 * The window stops at the row's own bytes on both sides, and both bounds are load-bearing under
 * nesting. It starts past the LEAD, so a re-typed row keeps the indent that says where it sits.
 * It ends at the row's own content end — `position` would take the whole SUBTREE, which is how a
 * retype comes to delete a row's children, and the row's own line is exactly the bytes the
 * projection emits for it.
 *
 * NO {@link Pairing}: a pairing is refused when a pair's kinds disagree (`pairEquals`), which is
 * precisely what a retype changes. The row survives on adoption's own index pairing instead — a
 * row candidate adopts any row token, kind-blind, which is the mechanism ADR-0007 keeps for this.
 *
 * `undefined` — fail closed — for a non-row, a dead node (the pre-order lookup is that check) and
 * a no-op, which is what a row control re-selecting the value it already has looks like.
 */
export function turnIntoPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	descriptor: MarkupDescriptor | undefined,
	patch: RowPatch | undefined
): {window: Window; text: string} | undefined {
	if (node.kind !== 'row') return undefined
	if (!preorderRows(roots).some(entry => entry.row === node)) return undefined

	const meta = patch?.meta === null ? undefined : (patch?.meta ?? node.meta())
	const text = rowMarkup(descriptor, meta, patch?.text ?? node.slot())
	const current = rowMarkup(node.descriptor(), node.meta(), node.slot())
	if (text === current) return undefined

	const start = node.position.start + node.lead().length
	return {window: {start, end: start + current.length, insertedLength: text.length}, text}
}

/**
 * Splitting one row at an anchor in its own body, as ONE splice plus the PRE-ORDER index of the
 * row it produces.
 *
 * The window covers the row's LINE BODY AND ITS WHOLE SUBTREE, and re-emits the descendants
 * unchanged in the middle, because the tail row lands AFTER them. That placement is forced by the
 * encoding rather than preferred: a row written directly under this one at this one's lead adopts
 * every child it has, since nesting is indentation and nothing else. Re-emitting the subtree also
 * costs nothing in identity — the descendants sit at the same indices in the row's child list, so
 * adoption's index pairing carries every one of them.
 *
 * The tail's kind is the row's own when the kind `continues`, else a plain row; the caller reads
 * that field, because `tree/` knows a descriptor and not the option that declared it.
 *
 * `undefined` — fail closed — for a non-row, a dead node, an editor with no separator to split at,
 * and an anchor outside the row's own body.
 */
export function splitPlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	at: NodeAnchor,
	separator: string | undefined,
	continues: boolean
): {window: Window; text: string; tail: number} | undefined {
	if (node.kind !== 'row' || separator === undefined) return undefined
	const rows = preorderRows(roots)
	const index = rows.findIndex(entry => entry.row === node)
	if (index < 0) return undefined

	const slot = node.slotRange()
	const offset = offsetOfAnchor(roots, at)
	if (offset < slot.start || offset > slot.end) return undefined

	const body = node.slot()
	const cut = offset - slot.start
	const children = node.rows()
	const descendants =
		children.length === 0 ? undefined : children.map(child => rowContent(child, separator)).join(separator)

	const text =
		rowMarkup(node.descriptor(), node.meta(), body.slice(0, cut)) +
		(descendants === undefined ? '' : separator + descendants) +
		separator +
		node.lead() +
		rowMarkup(continues ? node.descriptor() : undefined, continues ? node.meta() : undefined, body.slice(cut))

	const start = node.position.start + node.lead().length
	// The subtree's last line carries a separator unless it ends the document, and the window
	// stops before it — the join puts one back between the tail and whatever follows.
	const end = node.position.end - (endsDocument(roots, node) ? 0 : separator.length)
	return {window: {start, end, insertedLength: text.length}, text, tail: index + preorderRows([node]).length}
}

/** The scan's own emptiness, read off the node: a row whose whole LINE is empty. */
function isEmptyRow(row: RowNode): boolean {
	return row.lead() === '' && row.descriptor() === undefined && row.slot() === ''
}