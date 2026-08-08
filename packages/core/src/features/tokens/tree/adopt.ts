import {batch} from '../../../shared/signals'
import type {Token} from '../parser/types'
import {collectIds, shiftPositions, snapshotNodeEquals} from './adoptUtils'
import type {TokenTree} from './tree'
import type {Id, MarkNode, NodeAnchor, TextNode, TransactionResult, TreeChange, TreeNode, Window} from './types'

/**
 * Fold a fresh parse of the spliced projection back into the persistent nodes
 * (spec §4.2): nodes the parse agrees with keep their object, and therefore
 * their id.
 */
export function adopt(tree: TokenTree, window: Window, parsed: Token[]): TransactionResult {
	const prev = tree.roots()
	const delta = window.insertedLength - (window.end - window.start)

	const added: TreeChange[] = []
	const removed: Id[] = []
	const updated: TreeNode[] = []
	const shifted: TreeNode[] = []
	const out: TreeNode[] = []

	batch(() => {
		// 1. Prefix: byte/position-equal AND entirely before the window. The window
		// bound is load-bearing: content that repeats with the deleted span's own period
		// keeps matching past the edit, so equality alone walks THROUGH the deleted nodes
		// and pushes the removals onto nodes outside the window instead (deleting the
		// middle of '@[a](m)' x3 removes the third mark — AC-3.1; see adopt.spec.ts).
		let p = 0
		while (
			p < prev.length &&
			p < parsed.length &&
			prev[p].position.end <= window.start &&
			snapshotNodeEquals(prev[p], parsed[p], 0)
		) {
			out.push(prev[p])
			p++
		}

		// 2. Suffix: equal under +delta AND entirely after the window. Mirrored bound,
		// weaker consequence: this walk only lowers `prevTail`, so dropping it cannot
		// remove an extra node — it would instead let a node deleted INSIDE the window
		// be re-adopted for identical retyped content.
		let prevTail = prev.length - 1
		let nextTail = parsed.length - 1
		const suffix: TreeNode[] = []
		while (
			prevTail >= p &&
			nextTail >= p &&
			prev[prevTail].position.start >= window.end &&
			snapshotNodeEquals(prev[prevTail], parsed[nextTail], delta)
		) {
			shiftPositions(prev[prevTail], delta)
			if (delta !== 0) shifted.push(prev[prevTail])
			suffix.unshift(prev[prevTail])
			prevTail--
			nextTail--
		}

		// 3. Middle: rebuild. Same-index pairing lands here in S1.3 Task 6; output
		// equivalence holds either way, identity inside the window does not.
		for (let index = p; index <= nextTail; index++) {
			const node = tree.buildNode(parsed[index])
			added.push({node, path: [index]})
			out.push(node)
		}
		for (let index = p; index <= prevTail; index++) collectIds(prev[index], removed)

		out.push(...suffix)
		tree.roots(out)
	})

	const structural = added.length > 0 || removed.length > 0
	const render = structural || updated.some(node => node.kind === 'mark')

	const map = (offset: number): NodeAnchor => resolveMappedAnchor(out, offset, window, delta)

	return {structural, render, added, removed, updated, shifted, selectionBefore: undefined, map}
}

/** Pre-adoption offset → post-adoption anchor (spec D7). */
function resolveMappedAnchor(roots: readonly TreeNode[], offset: number, window: Window, delta: number): NodeAnchor {
	const mapped =
		offset <= window.start ? offset : offset >= window.end ? offset + delta : window.start + window.insertedLength
	return anchorAt(roots, mapped)
}

/** Right-affinity resolution: the last text node (document order) containing the offset. */
export function anchorAt(roots: readonly TreeNode[], offset: number): NodeAnchor {
	let text: {node: TextNode; offset: number} | undefined
	let mark: MarkNode | undefined
	const visit = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			if (node.position.start > offset || offset > node.position.end) continue
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