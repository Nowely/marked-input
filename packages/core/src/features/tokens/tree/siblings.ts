import {sliceNodes} from './tree'
import type {MarkNode, NodeAnchor, Pairing, TreeNode, Window} from './types'

/**
 * A mark whose markup is a slot followed by exactly one literal segment — the shape a block
 * row takes, and the only shape with a removable boundary. Its trailing literal is what holds
 * it apart from the next row; drop that and the two slots run together into one.
 */
function isSlotLeading(node: TreeNode): node is MarkNode {
	return node.kind === 'mark' && node.descriptor.hasSlot && node.descriptor.segments.length === 1
}

/**
 * Removing the boundary between two adjacent siblings, expressed as a REPLACEMENT OF THE
 * FIRST: what survives is `node` up to the end of its slot, and `next` keeps its own markup —
 * which is why the merged row is `next`'s markup wrapping both slots.
 *
 * `undefined` when the pair has no boundary to remove. Three ways that happens, all
 * fail-closed: either side is not slot-leading, the two carry different markups, or they are
 * not actually adjacent. The last cannot arise from a parse — roots TILE the document — and
 * is checked rather than assumed so a caller cannot splice across a gap it never looked at.
 *
 * The pair test used to be a separate `canMergeRows` predicate whose text/text arm was dead:
 * it required two adjacent TEXT roots with a NON-EMPTY gap between them, which a parse cannot
 * produce. Probed rather than argued — a `throw` in that arm ran the whole suite (73 files,
 * 1472 tests, both browser projects) and was reached only by a spec that built the non-tiling
 * pair by hand.
 */
export function mergePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	next: TreeNode
): {kept: string; at: number} | undefined {
	if (!isSlotLeading(node) || !isSlotLeading(next)) return undefined
	if (node.descriptor !== next.descriptor) return undefined
	if (node.position.end !== next.position.start) return undefined

	// `slotRange` is absent only for a slotless markup, which `isSlotLeading` already excluded;
	// the fallback keeps the read total rather than asserting.
	const slotEnd = (node.slotRange ?? node.position).end
	const kept = sliceNodes(roots, {before: node}, {after: node}).slice(0, slotEnd - node.position.start)
	// The caret goes where the two halves join, which is the slot's own end in the PRE-splice
	// coordinates — the caller resolves it against the post-splice tree.
	return {kept, at: slotEnd}
}
/**
 * Moving a root to another root index, as ONE splice over the affected span plus the
 * {@link Pairing} that says which row went where. Rows outside `[min(from,to), max(from,to)]`
 * are not touched, so the splice is as narrow as a rotation can be.
 *
 * `undefined` — fail closed — when the node is not a root (`indexOf` is the liveness check and
 * the index in one read, so there is no second `reachable`), when `to` is out of range or equal
 * to `from`, or when the affected rows do not TILE. The last cannot come from a parse and is
 * checked rather than assumed, because the splice re-emits the span from the rows alone: any
 * text between them would be silently dropped.
 *
 * The pairing spans the WHOLE root list, not just the moved span — `resolvePairing` needs a
 * total bijection over the roots, and the untouched rows are the identity part of it.
 */
export function movePlan(
	roots: readonly TreeNode[],
	node: TreeNode,
	to: number
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
	const text = span.map(row => sliceNodes(roots, {before: row}, {after: row})).join('')
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
/**
 * Where the caret ENTERS a row: inside its slot when it has one, else at the row's start.
 *
 * ONE rule, replacing three that disagreed (backlog issue 04): drag-add landed at the row
 * start, Enter on a mark row after the inserted content, and select-all + Enter at offset 0 —
 * which on a slot-leading markup happens to be the slot and on `'# __slot__\n\n'` is the row
 * start, two rows' worth of literal away from where the user is about to type.
 *
 * The slot's first text child, not the slot RANGE: a slot always parses with at least one text
 * child, and an anchor names a node rather than a coordinate.
 */
export function rowEntryAnchor(row: TreeNode): NodeAnchor {
	if (row.kind === 'mark' && row.descriptor.hasSlot) {
		// `.at`, not `[]`: `noUncheckedIndexedAccess` is off, so an index read types as
		// non-nullable and the empty-children guard would be linted away as impossible.
		const first = row.children().at(0)
		if (first?.kind === 'text') return {node: first, offset: 0}
	}
	return {before: row}
}