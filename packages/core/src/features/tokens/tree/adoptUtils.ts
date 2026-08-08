import type {Token} from '../parser/types'
import type {Id, TreeNode} from './types'

/**
 * Mirror of tokenIdentity's tokensEqualShifted over (node, parsed token).
 *
 * No `slot.content` comparison: that mirror is derived state the projection and
 * snapshot both ignore (children are the sole slot source), so a stale mirror
 * would refuse retentions the live tree supports — a wrong decision invisible to
 * the output-equivalence property. Recursive children equality already implies
 * slot text equality.
 */
export function snapshotNodeEquals(node: TreeNode, token: Token, delta: number): boolean {
	if (node.position.start + delta !== token.position.start) return false
	if (node.position.end + delta !== token.position.end) return false
	if (node.kind === 'text') return token.type === 'text' && node.text() === token.content
	if (token.type !== 'mark') return false
	if (node.descriptor !== token.descriptor) return false
	if (node.value() !== token.value || node.meta() !== token.meta) return false
	const children = node.children()
	if (children.length !== token.children.length) return false
	return children.every((child, index) => snapshotNodeEquals(child, token.children[index], delta))
}

/** Recursive position shift for retained suffix nodes (plain field writes). */
export function shiftPositions(node: TreeNode, delta: number): void {
	node.position.start += delta
	node.position.end += delta
	if (node.kind === 'mark') {
		if (node.slot) {
			node.slot.start += delta
			node.slot.end += delta
		}
		for (const child of node.children()) shiftPositions(child, delta)
	}
}

/** Subtree ids for the removed feed. */
export function collectIds(node: TreeNode, bucket: Id[]): void {
	bucket.push(node.id)
	if (node.kind === 'mark') for (const child of node.children()) collectIds(child, bucket)
}