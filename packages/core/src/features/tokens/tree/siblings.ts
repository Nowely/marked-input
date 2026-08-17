import {sliceNodes} from './tree'
import type {MarkNode, TreeNode} from './types'

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