import {batch, untracked} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import type {MarkToken, RowConfig, RowToken, TextToken, Token} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {anchorAt, offsetOfAnchor} from './anchors'
import {preorderRows} from './rows'
import type {TokenTree} from './tree'
import type {
	Anchors,
	MarkNode,
	NodeAnchor,
	Pairing,
	RowNode,
	TextNode,
	TransactionResult,
	TreeNode,
	Window,
} from './types'

/**
 * Parse a projection with the configured parser. The parser-less fallback mirrors
 * the pre-cutover `TokenModel#reparse`: with no markups configured there is no
 * Parser instance and the whole value is one text token.
 */
export function parseValue(parser: Parser | undefined, value: string): Token[] {
	return parser ? parser.parse(value) : [createTextToken(value)]
}

/**
 * Block layout's parse: rows exist with or without markups — a paragraph-only
 * block editor is legal (issue 08), so a missing parser falls back to a bare
 * one that finds no marks and still splits rows.
 */
const bareParser = new Parser([])
export function parseRowsValue(parser: Parser | undefined, value: string, config: RowConfig): RowToken[] {
	return (parser ?? bareParser).parseRows(value, config)
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
	parsed: readonly (Token | RowToken)[],
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

		/**
		 * ONE SIBLING LIST, at any depth: the nodes entirely before the window, the nodes entirely
		 * after it, and index pairing for what is left between them.
		 *
		 * The two bounds are load-bearing rather than an economy. Content that repeats with the
		 * edited span's own period keeps comparing equal past the edit, so equality alone walks
		 * THROUGH the changed nodes and pushes the removals onto untouched ones instead — deleting
		 * the middle of `'@[a](m)'` ×3 removed the third mark, and the mirrored walk deleting
		 * `{1,8}` killed the first instead of the second (both in `adopt.spec.ts`).
		 *
		 * It runs at EVERY depth, which is what the root list used to have to itself. A slot's or a
		 * row's children were paired by index alone, so an insertion in the middle of one re-labelled
		 * every sibling after it: typing a cell delimiter into column 2 of a five-column row handed
		 * columns 3–5 the node objects of the columns before them, and everything a consumer keys by
		 * node identity moved with them.
		 */
		function adoptSiblings(candidates: readonly TreeNode[], tokens: readonly (Token | RowToken)[]): TreeNode[] {
			// A verified permutation REPLACES the walks rather than composing with them: every
			// hinted pair is already proven byte-equal under its own shift, so a positional bound
			// has nothing left to claim.
			if (rowPairs) return pairByIndex(candidates, tokens)

			let head = 0
			while (
				head < candidates.length &&
				head < tokens.length &&
				candidates[head].position.end <= window.start &&
				snapshotNodeEquals(candidates[head], tokens[head], 0)
			) {
				head++
			}

			let candidateTail = candidates.length - 1
			let tokenTail = tokens.length - 1
			const tail: TreeNode[] = []
			while (
				candidateTail >= head &&
				tokenTail >= head &&
				candidates[candidateTail].position.start >= window.end &&
				snapshotNodeEquals(candidates[candidateTail], tokens[tokenTail], delta)
			) {
				if (delta !== 0) shiftPositions(candidates[candidateTail], delta)
				tail.unshift(candidates[candidateTail])
				candidateTail--
				tokenTail--
			}

			return [
				...candidates.slice(0, head),
				...pairByIndex(candidates.slice(head, candidateTail + 1), tokens.slice(head, tokenTail + 1)),
				...tail,
			]
		}

		/**
		 * Same-index pairing over one sibling list (spec §4.2 step 3), which is what the window
		 * bounds above leave undecided: a merged or unrelated token landing at the same index
		 * inherits the id, and §7.1 permits that because it gates identity only OUTSIDE the window.
		 *
		 * Pairing on the descriptor is not decoration: `descriptor` is readonly, so adopting across
		 * descriptors would leave a node whose markup disagrees with the parse and `snapshot` would
		 * re-annotate with the old one, breaking output equivalence.
		 */
		function pairByIndex(candidates: readonly TreeNode[], tokens: readonly (Token | RowToken)[]): TreeNode[] {
			const result: TreeNode[] = []
			for (let index = 0; index < tokens.length; index++) {
				const token = tokens[index]
				// The KEYED lookup, beside the positional walk: a verified pairing names which
				// previous row each parsed row continues, at any depth and in any order, so it
				// overrides the index for a row token and leaves every other token to the walk.
				const candidate =
					(token.type === 'row' ? rowPairs?.get(token) : undefined) ??
					(index < candidates.length ? candidates[index] : undefined)
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
				} else if (candidate?.kind === 'row' && token.type === 'row') {
					// KIND match only, and deliberately NOT on the row's own kind: a row HAS a
					// descriptor rather than being one, so any row candidate adopts any row
					// token. That is what keeps the row object — and the block state keyed on
					// it — alive across a retype (ADR-0007).
					adoptRow(candidate, token)
					result.push(candidate)
				} else {
					result.push(tree.buildNode(token))
				}
			}
			return result
		}

		/** Plain field writes (spec D3): a move leaves no signal trace and reaches no feed. */
		function adoptPosition(node: TreeNode, token: Token | RowToken): void {
			node.position.start = token.position.start
			node.position.end = token.position.end
		}

		function adoptRow(node: RowNode, token: RowToken): void {
			adoptPosition(node, token)
			node.descriptor(token.descriptor)
			node.meta(token.meta)
			// A SIGNAL write: the projection emits the lead, so a re-indent that keeps every
			// child object in place has nothing else to notify `value` with.
			node.lead(token.lead)
			const children = node.children()
			const next = adoptSiblings(children, rowTokenChildren(token))
			if (!sameNodes(next, children)) node.children(next)
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

		const rowPairs = window.pairing && resolvePairing(prev, parsed, window.pairing)

		let out: readonly TreeNode[] = prev
		batch(() => {
			out = adoptSiblings(prev, parsed)
			if (!sameNodes(out, prev)) tree.roots(out)
		})

		const moved = rowPairs !== undefined
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
function snapshotNodeEquals(node: TreeNode, token: Token | RowToken, delta: number): boolean {
	if (node.position.start + delta !== token.position.start) return false
	if (node.position.end + delta !== token.position.end) return false
	if (node.kind === 'text') return token.type === 'text' && node.text() === token.content
	if (node.kind === 'row') {
		if (token.type !== 'row') return false
		// The row's own kind, so a same-length retype can never be accepted by the prefix or
		// suffix walk and keep the old markup in the projection. Same for the LEAD: re-indenting
		// a row leaves its content untouched, so nothing else here would notice.
		if (node.descriptor() !== token.descriptor) return false
		if (node.meta() !== token.meta) return false
		if (node.lead() !== token.lead) return false
		const rowChildren = node.children()
		const tokenChildren = rowTokenChildren(token)
		if (rowChildren.length !== tokenChildren.length) return false
		return rowChildren.every((child, index) => snapshotNodeEquals(child, tokenChildren[index], delta))
	}
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

/** A row token's children as the tree holds them: INLINE first, then the child rows. */
function rowTokenChildren(token: RowToken): (Token | RowToken)[] {
	return [...token.children, ...token.rows]
}

/** Recursive position shift for retained suffix nodes (plain field writes). */
function shiftPositions(node: TreeNode, delta: number): void {
	node.position.start += delta
	node.position.end += delta
	if (node.kind === 'text') return
	if (node.kind === 'mark' && node.slotRange) {
		node.slotRange.start += delta
		node.slotRange.end += delta
	}
	for (const child of node.children()) shiftPositions(child, delta)
}

/**
 * A {@link Pairing} resolved against the parse, as the row token → row node map adoption looks
 * every row up in — or `undefined`, in which case adoption runs its ordinary walks and the hint
 * changes nothing. FAIL CLOSED by construction: the caller can only ever confirm a permutation
 * the string already permits, never invent a change it does not have.
 *
 * PRE-ORDER ROWS on both sides, not roots. A row's subtree is contiguous in document order, so
 * pre-order is the one enumeration a move, a re-parent and a re-indent all speak; a root index
 * stops naming a row the moment rows nest.
 *
 * Three gates, and the BIJECTION one is not implied by the others. Counter-example, on the very
 * shape this channel exists for: two byte-identical rows `A@[0,7]`, `B@[7,14]` with
 * `pairing = [0, 0]`. Both pairs pass the equality check — pair 0 at delta 0, pair 1 at delta
 * +7, same content — so a range-only gate accepts it. Adoption would then adopt the SAME node
 * object into both row slots: `B` leaves the tree silently while `A`'s id appears twice, so
 * every consumer keyed by node identity is corrupted.
 *
 * Equality is checked under EACH PAIR'S OWN delta rather than one window delta: in a
 * permutation the rows move by different amounts, and that is the whole difference from the
 * suffix walk.
 */
function resolvePairing(
	prev: readonly TreeNode[],
	parsed: readonly (Token | RowToken)[],
	pairing: Pairing
): Map<RowToken, RowNode> | undefined {
	const rows = preorderRows(prev).map(({row}) => row)
	const tokens = preorderRowTokens(parsed)
	if (pairing.length !== rows.length || pairing.length !== tokens.length) return undefined

	const claimed = new Set<number>()
	const pairs = new Map<RowToken, RowNode>()
	for (const [index, previous] of pairing.entries()) {
		if (!Number.isInteger(previous) || previous < 0 || previous >= rows.length) return undefined
		if (claimed.has(previous)) return undefined
		claimed.add(previous)

		const node = rows[previous]
		const token = tokens[index]
		if (!pairEquals(node, token)) return undefined
		pairs.set(token, node)
	}
	return pairs
}

/** The parse's rows in the same pre-order the tree's {@link preorderRows} walks. */
function preorderRowTokens(tokens: readonly (Token | RowToken)[]): RowToken[] {
	const out: RowToken[] = []
	for (const token of tokens) {
		if (token.type !== 'row') continue
		out.push(token)
		out.push(...preorderRowTokens(token.rows))
	}
	return out
}

/**
 * The pairing gate's equality — {@link snapshotNodeEquals} under the pair's own delta, except
 * for a ROW pair, which is compared on its kind, its meta and its INLINE children under the
 * pair's own CONTENT delta.
 *
 * The row arm is load-bearing rather than lenient, and for TWO reasons now. A permutation moves
 * which row sits document-final, and only that row carries no separator, so the rows entering
 * and leaving that position change SPAN LENGTH while their content is untouched. And a
 * re-indent changes a row's own start delta by zero while its children's is the indent's
 * length, so a position-delta comparison fails every pair and identity degrades to index
 * pairing — the exact ADR-0007 failure mode, measured. Comparing the children under the delta
 * between the two BODIES is the reading that survives a row's structural bytes changing size.
 */
function pairEquals(node: TreeNode, token: Token | RowToken): boolean {
	if (node.kind === 'row' && token.type === 'row') {
		if (node.descriptor() !== token.descriptor) return false
		if (node.meta() !== token.meta) return false
		// The INLINE children only, never `children()`: dragging a paired child row into this
		// comparison would make a pair's verdict depend on rows the pairing itself claims.
		const delta = token.slot.start - node.slotRange().start
		const children = node.inline()
		if (children.length !== token.children.length) return false
		return children.every((child, index) => snapshotNodeEquals(child, token.children[index], delta))
	}
	return snapshotNodeEquals(node, token, token.position.start - node.position.start)
}