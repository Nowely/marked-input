import type {Token} from '../parser/types'
import type {Pairing, TreeNode} from './types'

/**
 * Shift-tolerant equality over (node, parsed token) — the retention test adoption
 * pairs candidates with.
 *
 * The token's text mirrors are deliberately NOT compared — mark `content` and
 * `slot.content` are pure functions of descriptor + value + meta + children, all of
 * which are compared, so they are implied (and the node stores neither). Everything
 * else, `slot.start/end` included, is compared: they are live positions a retention
 * must already agree with, or the retained mark keeps stale ones forever.
 */
export function snapshotNodeEquals(node: TreeNode, token: Token, delta: number): boolean {
	if (node.position.start + delta !== token.position.start) return false
	if (node.position.end + delta !== token.position.end) return false
	if (node.kind === 'text') return token.type === 'text' && node.text() === token.content
	if (token.type !== 'mark') return false
	if (node.descriptor !== token.descriptor) return false
	if (node.value() !== token.value || node.meta() !== token.meta) return false
	// Descriptor equality already pins slot presence (the parser fills `slot` exactly
	// when the markup has a slot gap), so one branch covers both shapes.
	if (node.slotRange && token.slot) {
		if (node.slotRange.start + delta !== token.slot.start) return false
		if (node.slotRange.end + delta !== token.slot.end) return false
	}
	const children = node.children()
	if (children.length !== token.children.length) return false
	return children.every((child, index) => snapshotNodeEquals(child, token.children[index], delta))
}

/** Recursive position shift for retained suffix nodes (plain field writes). */
export function shiftPositions(node: TreeNode, delta: number): void {
	node.position.start += delta
	node.position.end += delta
	if (node.kind === 'mark') {
		if (node.slotRange) {
			node.slotRange.start += delta
			node.slotRange.end += delta
		}
		for (const child of node.children()) shiftPositions(child, delta)
	}
}

/**
 * A {@link Pairing} resolved against the parse, or `undefined` — in which case adoption runs
 * its ordinary walks and the hint changes nothing. FAIL CLOSED by construction: the caller can
 * only ever confirm a permutation the string already permits, never invent a change it does
 * not have.
 *
 * Three gates, and the BIJECTION one is not implied by the others. Counter-example, on the very
 * shape this channel exists for: two byte-identical rows `A@[0,7]`, `B@[7,14]` with
 * `pairing = [0, 0]`. Both pairs pass the equality check — pair 0 at delta 0, pair 1 at delta
 * +7, same content — so a range-only gate accepts it. Adoption would then adopt the SAME node
 * object into both root slots: `B` leaves the tree silently while `A`'s id appears twice, so
 * every consumer keyed by node identity is corrupted.
 *
 * Equality is checked under EACH PAIR'S OWN delta rather than one window delta: in a
 * permutation the rows move by different amounts, and that is the whole difference from the
 * suffix walk.
 */
export function resolvePairing(
	prev: readonly TreeNode[],
	parsed: readonly Token[],
	pairing: Pairing
): readonly TreeNode[] | undefined {
	if (pairing.length !== prev.length || pairing.length !== parsed.length) return undefined

	const claimed = new Set<number>()
	const order: TreeNode[] = []
	for (const [index, previous] of pairing.entries()) {
		if (!Number.isInteger(previous) || previous < 0 || previous >= prev.length) return undefined
		if (claimed.has(previous)) return undefined
		claimed.add(previous)

		const node = prev[previous]
		const token = parsed[index]
		if (!snapshotNodeEquals(node, token, token.position.start - node.position.start)) return undefined
		order.push(node)
	}
	return order
}