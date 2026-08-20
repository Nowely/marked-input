import {batch, untracked} from '../../../shared/signals'
import type {Parser} from '../parser/Parser'
import type {MarkToken, TextToken, Token} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {resolvePairing, shiftPositions, snapshotNodeEquals} from './adoptUtils'
import {anchorAt, offsetOfAnchor} from './anchors'
import type {TokenTree} from './tree'
import type {Anchors, MarkNode, NodeAnchor, TextNode, TransactionResult, TreeNode, Window} from './types'

/**
 * Parse a projection with the configured parser. The parser-less fallback mirrors
 * the pre-cutover `TokenModel#reparse`: with no markups configured there is no
 * Parser instance and the whole value is one text token.
 */
export function parseValue(parser: Parser | undefined, value: string): Token[] {
	return parser ? parser.parse(value) : [createTextToken(value)]
}

/**
 * Fold a fresh parse of the spliced projection back into the persistent nodes
 * (spec §4.2): nodes the parse agrees with keep their object, and therefore
 * their id.
 *
 * Comparison reads node signals, and `batch` does NOT clear the active
 * subscriber — so the whole body runs `untracked`, otherwise an adopt called
 * from inside an effect or computed subscribes that caller to every node it
 * touches.
 */
export function adopt(
	tree: TokenTree,
	window: Window,
	parsed: readonly Token[],
	selectionBefore?: Anchors
): TransactionResult {
	return untracked(() => {
		const prev = tree.roots()
		const delta = window.insertedLength - (window.end - window.start)

		// PRE-MUTATION, and that is the whole of this decision: the batch below rewrites
		// node `position` fields in place, so an offset formed after it describes the new
		// coordinate space and `map` would shift it a SECOND time. Gated by adopt.spec.ts's
		// "forms the offsets BEFORE adoption rewrites the positions they read".
		const beforeOffsets = selectionBefore && {
			anchor: offsetOfAnchor(prev, selectionBefore.anchor),
			head: offsetOfAnchor(prev, selectionBefore.head),
		}

		const out: TreeNode[] = []

		/**
		 * Same-index pairing over one sibling list (spec §4.2 step 3). Pairing on the
		 * descriptor is not decoration: `descriptor` is readonly, so adopting across
		 * descriptors would leave a node whose markup disagrees with the parse and
		 * `snapshot` would re-annotate with the old one, breaking output equivalence.
		 */
		function adoptSiblings(candidates: readonly TreeNode[], tokens: readonly Token[]): TreeNode[] {
			const result: TreeNode[] = []
			for (let index = 0; index < tokens.length; index++) {
				const token = tokens[index]
				const candidate = index < candidates.length ? candidates[index] : undefined
				if (candidate?.kind === 'text' && token.type === 'text') {
					adoptText(candidate, token)
					result.push(candidate)
				} else if (
					candidate?.kind === 'mark' &&
					token.type === 'mark' &&
					candidate.descriptor === token.descriptor
				) {
					adoptMark(candidate, token)
					result.push(candidate)
				} else {
					result.push(tree.buildNode(token))
				}
			}
			return result
		}

		/** Plain field writes (spec D3): a move leaves no signal trace and reaches no feed. */
		function adoptPosition(node: TreeNode, token: Token): void {
			node.position.start = token.position.start
			node.position.end = token.position.end
		}

		function adoptText(node: TextNode, token: TextToken): void {
			adoptPosition(node, token)
			node.text(token.content)
		}

		/**
		 * Spec §4.2 separates "slot descend" from "refused descend", but both adopt the
		 * children — that recursion is what keeps in-slot component identity alive across
		 * a mark-level value/meta change — so no descend predicate exists here.
		 */
		function adoptMark(node: MarkNode, token: MarkToken): void {
			adoptPosition(node, token)
			// The pairing gate compared descriptors, so slot presence already agrees; this
			// write is what keeps the live slot positions in step with the parse.
			node.slotRange = token.slot ? {start: token.slot.start, end: token.slot.end} : undefined

			node.value(token.value)
			node.meta(token.meta)

			const children = node.children()
			const next = adoptSiblings(children, token.children)
			if (!sameNodes(next, children)) node.children(next)
		}

		// A verified permutation REPLACES the three walks rather than composing with them, and
		// that is forced rather than chosen: all three pair by INDEX — prefix `prev[p]↔parsed[p]`,
		// suffix decrementing both tails together, middle slicing both arrays from the same `p` —
		// which is exactly why today's reorder outcome does not depend on the window at all. Once
		// every hinted pair is proven byte-equal under its own shift, the walks have nothing left
		// to claim.
		const order = window.pairing && resolvePairing(prev, parsed, window.pairing)

		batch(() => {
			if (order) {
				// `adoptSiblings` over the PERMUTED candidates: it writes each node's new position
				// from its token, recurses into slots, and — because a verified pair is equal in
				// content — writes no signal.
				out.push(...adoptSiblings(order, parsed))
				if (!sameNodes(out, prev)) tree.roots(out)
				return
			}
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
				if (delta !== 0) shiftPositions(prev[prevTail], delta)
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
			// mark deleted (window {2,9}) retains that mark and drops the SECOND one
			// instead, taking ' tail' at [17,22] — a node entirely past window.end — out of
			// the tree with it (pinned in adopt.spec.ts). Diffing this file against §4.2
			// must read that as a scoped omission, not an oversight.
			out.push(...adoptSiblings(prev.slice(p, prevTail + 1), parsed.slice(p, nextTail + 1)))

			out.push(...suffix)
			if (!sameNodes(out, prev)) tree.roots(out)
		})

		const moved = order !== undefined
		const map = (offset: number): NodeAnchor => resolveMappedAnchor(out, offset, window, delta)

		// A verified move carries the selection through UNCHANGED, and coordinate-free: every
		// anchor is node-relative, no node's content changed and none left the tree, so each
		// pre-edit anchor still names the same character. `map` cannot answer this — it is
		// window-arithmetic, and inside a permutation's hull it collapses every offset onto the
		// hull end.
		const selectionAfter = moved
			? selectionBefore
			: beforeOffsets && {
					anchor: map(beforeOffsets.anchor),
					head: map(beforeOffsets.head),
				}

		return {selectionAfter}
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
 * Pre-adoption offset → post-adoption anchor (spec D7). RIGHT affinity: an offset AT the
 * window start moves to the end of the inserted text, so typing `X` at offset 5 of
 * `abcde` maps a pre-edit caret 5 to 6 and an overtyped selection collapses onto the
 * replacement (AC-3.3/3.4). Left affinity — what S1.3 shipped, when `map` had no consumer
 * — is what a selection anchor sitting at a foreign insertion point would want; nothing
 * in this codebase is that consumer, so there is ONE map and no affinity parameter
 * (plan decision D-a).
 *
 * A pure insertion (`start === end`) takes the second branch, not the third; both compute
 * `window.start + window.insertedLength`, so the branches agree.
 */
function resolveMappedAnchor(roots: readonly TreeNode[], offset: number, window: Window, delta: number): NodeAnchor {
	const mapped =
		offset < window.start ? offset : offset >= window.end ? offset + delta : window.start + window.insertedLength
	return anchorAt(roots, mapped)
}