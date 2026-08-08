import {batch, untracked} from '../../../shared/signals'
import type {MarkToken, TextToken, Token} from '../parser/types'
import {collectIds, shiftPositions, snapshotNodeEquals} from './adoptUtils'
import type {TokenTree} from './tree'
import type {Id, MarkNode, NodeAnchor, TextNode, TransactionResult, TreeChange, TreeNode, Window} from './types'

/**
 * Fold a fresh parse of the spliced projection back into the persistent nodes
 * (spec §4.2): nodes the parse agrees with keep their object, and therefore
 * their id.
 *
 * Comparison reads node signals, and `batch` does NOT clear the active
 * subscriber — so the whole body runs `untracked`, otherwise an adopt called
 * from inside an effect or computed subscribes that caller to every node it
 * touches. `map` needs its own wrapper: its reads happen at call time, which
 * may be a different (and reactive) caller.
 */
export function adopt(tree: TokenTree, window: Window, parsed: readonly Token[]): TransactionResult {
	return untracked(() => {
		const prev = tree.roots()
		const delta = window.insertedLength - (window.end - window.start)

		const added: TreeChange[] = []
		const removed: Id[] = []
		const updated: TreeNode[] = []
		const shifted: TreeNode[] = []
		const out: TreeNode[] = []

		/**
		 * Same-index pairing over one sibling list (spec §4.2 step 3). Pairing on the
		 * descriptor is not decoration: `descriptor` is readonly, so adopting across
		 * descriptors would leave a node whose markup disagrees with the parse and
		 * `snapshot` would re-annotate with the old one, breaking output equivalence.
		 *
		 * `baseIndex` is the list's first index within its parent, so `added` paths stay
		 * absolute while the middle region only ever passes a sub-range of the roots.
		 * `covered` says an ancestor already entered `shifted` (see `adoptPosition`).
		 */
		function adoptSiblings(
			candidates: readonly TreeNode[],
			tokens: readonly Token[],
			parentPath: readonly number[],
			baseIndex: number,
			covered: boolean
		): TreeNode[] {
			const result: TreeNode[] = []
			for (let index = 0; index < tokens.length; index++) {
				const token = tokens[index]
				const candidate = index < candidates.length ? candidates[index] : undefined
				if (candidate?.kind === 'text' && token.type === 'text') {
					adoptText(candidate, token, covered)
					result.push(candidate)
				} else if (
					candidate?.kind === 'mark' &&
					token.type === 'mark' &&
					candidate.descriptor === token.descriptor
				) {
					adoptMark(candidate, token, [...parentPath, baseIndex + index], covered)
					result.push(candidate)
				} else {
					if (candidate) collectIds(candidate, removed)
					const node = tree.buildNode(token)
					added.push({node, path: [...parentPath, baseIndex + index]})
					result.push(node)
				}
			}
			for (let index = tokens.length; index < candidates.length; index++) collectIds(candidates[index], removed)
			return result
		}

		/**
		 * Positions are plain field writes, so a move leaves no signal trace and `shifted`
		 * is the only feed that can carry it (spec D9). Granularity is subtree roots: a
		 * listed node covers its descendants, so the returned flag suppresses their own
		 * entries.
		 */
		function adoptPosition(node: TreeNode, token: Token, covered: boolean): boolean {
			const moved = node.position.start !== token.position.start || node.position.end !== token.position.end
			node.position.start = token.position.start
			node.position.end = token.position.end
			if (moved && !covered) shifted.push(node)
			return covered || moved
		}

		function adoptText(node: TextNode, token: TextToken, covered: boolean): void {
			adoptPosition(node, token, covered)
			if (node.text(token.content)) updated.push(node)
		}

		/**
		 * Spec §4.2 separates "slot descend" from "refused descend", but only in what the
		 * mark itself reports: a descend leaves the mark out of `updated`, a refusal puts
		 * it in because its rendered props changed. Both then adopt the children — that
		 * recursion is what keeps in-slot component identity alive across a mark-level
		 * value/meta change. Driving the `updated` entry off the value/meta comparison
		 * implements exactly that split, so no separate descend predicate exists here.
		 */
		function adoptMark(node: MarkNode, token: MarkToken, nodePath: readonly number[], covered: boolean): void {
			const childrenCovered = adoptPosition(node, token, covered)
			// The pairing gate compared descriptors, so slot presence already agrees; this
			// write is what keeps the live slot positions in step with the parse.
			node.slot = token.slot ? {start: token.slot.start, end: token.slot.end} : undefined

			const valueChanged = node.value(token.value)
			const metaChanged = node.meta(token.meta)
			if (valueChanged || metaChanged) updated.push(node)

			const children = node.children()
			const next = adoptSiblings(children, token.children, nodePath, 0, childrenCovered)
			if (!sameNodes(next, children)) node.children(next)
		}

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

			// 2. Suffix: equal under +delta AND entirely after the window. Mirrored bound and
			// mirrored consequence: on repeated content the walk otherwise runs THROUGH the
			// edit, pairing prev[tail] with a token it did not come from, so the removal lands
			// on the wrong repeat (deleting {1,8} of '@[a](m)' x3 kills the first mark instead
			// of the second — see adopt.spec.ts). Same-index pairing below cannot undo that:
			// what the suffix walk claims is out of the middle's reach.
			let prevTail = prev.length - 1
			let nextTail = parsed.length - 1
			const suffix: TreeNode[] = []
			while (
				prevTail >= p &&
				nextTail >= p &&
				prev[prevTail].position.start >= window.end &&
				snapshotNodeEquals(prev[prevTail], parsed[nextTail], delta)
			) {
				if (delta !== 0) {
					shiftPositions(prev[prevTail], delta)
					shifted.push(prev[prevTail])
				}
				suffix.unshift(prev[prevTail])
				prevTail--
				nextTail--
			}

			// 3. Middle: same-index pairing, recursing into slots. At THIS level pairing is
			// best-effort continuity — a merged or unrelated token landing at the same index
			// inherits the id — and §7.1 permits that because it gates identity only OUTSIDE
			// the window, which is exactly what the two walks already claimed.
			//
			// The slot recursion carries no such bound: §4.2's gap-derived slot-local window
			// is deliberately NOT implemented in this phase, so in-slot pairing is unbounded
			// index pairing. Measured cost — '#[@[a](m) @[a](m) tail]' with the FIRST inner
			// mark deleted (window {2,9}) retains that mark and reports the SECOND one
			// removed, dragging ' tail' at [17,22] — an id entirely past window.end — into
			// `removed` with it (pinned in adopt.spec.ts). Diffing this file against §4.2
			// must read that as a scoped omission, not an oversight.
			out.push(...adoptSiblings(prev.slice(p, prevTail + 1), parsed.slice(p, nextTail + 1), [], p, false))

			out.push(...suffix)
			if (!sameNodes(out, prev)) tree.roots(out)
		})

		const structural = added.length > 0 || removed.length > 0
		const render = structural || updated.some(node => node.kind === 'mark')

		const map = (offset: number): NodeAnchor => untracked(() => resolveMappedAnchor(out, offset, window, delta))

		// `selectionBefore` stays undefined until the dispatcher can hand the pre-adoption
		// range down; the channel is recorded on `TransactionResult.selectionBefore`.
		return {structural, render, added, removed, updated, shifted, selectionBefore: undefined, map}
	})
}

/**
 * Adoption rebuilds every sibling list, and signals compare by reference — writing an
 * element-wise identical list would wake every subscriber of an untouched list (`roots`
 * included) on each keystroke.
 */
function sameNodes(a: readonly TreeNode[], b: readonly TreeNode[]): boolean {
	return a.length === b.length && a.every((node, index) => node === b[index])
}

/**
 * Pre-adoption offset → post-adoption anchor (spec D7). Branch order gives an
 * insertion point (`start === end`) left affinity: the offset stays put.
 */
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