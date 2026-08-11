import type {MarkNode, NodeAnchor, TextNode, TreeNode} from './types'

/** Right-affinity resolution: the last text node (document order) containing the offset. */
export function anchorAt(roots: readonly TreeNode[], offset: number): NodeAnchor {
	let text: {node: TextNode; offset: number} | undefined
	let mark: MarkNode | undefined
	const visit = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			// Sibling positions ascend, so the first node starting past the offset ends the
			// scan; earlier siblings still run, which is what keeps later-wins intact.
			if (node.position.start > offset) break
			if (offset > node.position.end) continue
			if (node.kind === 'text') {
				text = {node, offset: offset - node.position.start}
			} else {
				mark = node
				visit(node.children())
			}
		}
	}
	visit(roots)
	if (text) return text
	// A mark interior is not anchorable (spec §2.3), so a slotless mark answers with its boundary.
	if (mark) return {after: mark}
	return offset <= 0 ? 'start' : 'end'
}

/**
 * The inverse of {@link anchorAt}: an anchor's absolute offset in the TREE's projection.
 *
 * Tree space, deliberately — not `value.current()`, which is props-first in controlled
 * mode. The two disagree exactly while a parent's `props.value` is ahead of the last
 * arrival, and `selectionBefore` must be captured in the space `map` consumes (spec D7).
 *
 * `'end'` is the last root's end rather than a length, so an out-of-range intent
 * self-limits without arithmetic — that is what replaces the deleted selection clamp
 * (spec §4.6 item 5).
 */
export function offsetOfAnchor(roots: readonly TreeNode[], anchor: NodeAnchor): number {
	if (anchor === 'start') return 0
	if (anchor === 'end') return roots.length > 0 ? roots[roots.length - 1].position.end : 0
	if ('node' in anchor) return anchor.node.position.start + anchor.offset
	if ('before' in anchor) return anchor.before.position.start
	return anchor.after.position.end
}

/**
 * The mark whose own boundary sits exactly ON `anchor`: the one ENDING there for `-1`, the
 * one STARTING there for `+1`. NESTED-FIRST, so an inner mark wins over an enclosing one at
 * a shared boundary — the order `keyboard/input.ts`'s token walk had before it moved here.
 *
 * Offsets, deliberately: adjacency IS an equality between an anchor's resolved position and
 * a mark's stored boundary, and `tree/` is the one layer where that arithmetic is legal
 * (spec S2 D1). Its consumers — the Backspace/Delete mark swallow and `insertMark`'s "which
 * mark did that splice create" — name nodes on both sides.
 */
export function adjacentMark(roots: readonly TreeNode[], anchor: NodeAnchor, direction: -1 | 1): MarkNode | undefined {
	const offset = offsetOfAnchor(roots, anchor)
	const visit = (nodes: readonly TreeNode[]): MarkNode | undefined => {
		for (const node of nodes) {
			if (node.kind !== 'mark') continue
			const nested = visit(node.children())
			if (nested) return nested
			if (direction === -1 ? node.position.end === offset : node.position.start === offset) return node
		}
		return undefined
	}
	return visit(roots)
}

/**
 * The single-character step in document order, or `undefined` when there is nothing to step
 * onto. The keyboard's "delete one character" fallback, which was `{start - 1, start}` on
 * raw offsets until S2.5.
 *
 * FAILS CLOSED on an unanchorable neighbour, and that is the one deliberate behavior change:
 * a position inside a mark's MARKUP (the `{` of `#[v]{inner}`, a block row's trailing
 * `\n\n`) is not anchorable, so {@link anchorAt} answers with the mark's own boundary
 * instead. The old numeric step spliced that position anyway and re-parsed the mark into
 * plain text; answering `undefined` leaves the browser default, which at the edge of a
 * `contenteditable` surface does nothing. The round-trip check is what detects it —
 * {@link anchorAt} is right-affine and does not invert.
 */
export function stepAnchor(roots: readonly TreeNode[], anchor: NodeAnchor, direction: -1 | 1): NodeAnchor | undefined {
	const offset = offsetOfAnchor(roots, anchor) + direction
	if (offset < 0 || offset > offsetOfAnchor(roots, 'end')) return undefined
	const stepped = anchorAt(roots, offset)
	return offsetOfAnchor(roots, stepped) === offset ? stepped : undefined
}

/**
 * Identity of an anchor: the node OBJECT plus the local offset. This is what the stored
 * selection dedupes on — the DOM sync rebuilds anchors on every `selectionchange`, and
 * without value equality every sweep tick would re-place the caret.
 */
export function anchorEquals(a: NodeAnchor | undefined, b: NodeAnchor | undefined): boolean {
	if (a === b) return true // covers undefined and the two string edges
	if (a === undefined || b === undefined || typeof a === 'string' || typeof b === 'string') return false
	if ('node' in a) return 'node' in b && a.node === b.node && a.offset === b.offset
	if ('before' in a) return 'before' in b && a.before === b.before
	return 'after' in b && a.after === b.after
}