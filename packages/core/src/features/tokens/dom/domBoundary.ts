import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {hasEditableAncestorBefore, textOffsetWithin} from './textOffsets'
import type {ElementBindings, TokenHandle} from './TokenHandle'

/** A bound token as the facade reads it: the live DOM bindings plus the handle itself. */
export type TokenView = ElementBindings & {
	readonly handle: TokenHandle
}

export type Lookup = {readonly kind: 'control'} | {readonly kind: 'token'; readonly node: TokenView}

/**
 * What the ANCHOR projection needs, and the whole of it: two DOM-side reads plus a
 * bridge from a bound handle's stable id to the LIVE node.
 *
 * NOTHING here answers with a `Token`. That is the point, and since S2.6 it is also
 * the only shape this module has: the numeric twin's context carried `tokens`,
 * `tokenOf`, `viewOf` and `nodes`, every one of them a door onto `position` — an
 * absolute coordinate no module above `tree/` may read (spec S2 D1). The anchor
 * projection wants identity, not coordinates, so it is correct during the adopt→bind
 * window where the numeric one was not (spec S2 D4).
 */
export type AnchorContext = {
	container: HTMLElement | undefined
	locate(node: Node): Lookup | undefined
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find). NOT latch-gated: ids outlive the bind window. */
	find(id: Id): TreeNode | undefined
}

/**
 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree — THE
 * DOM→model direction, and since S2.6 the only one.
 *
 * It began as the anchor projection of a numeric walk that ran branch-for-branch
 * beside it; that twin is gone, and with it the equivalence property that used to
 * gate this file. Every branch below now names its own case.
 */
export function anchorFromBoundary(
	ctx: AnchorContext,
	node: Node,
	offset: number,
	affinity: 'before' | 'after' = 'after'
): NodeAnchor | undefined {
	if (ctx.container && node === ctx.container) {
		return fromContainerAnchor(ctx.roots(), offset, affinity)
	}

	const lookup = ctx.locate(node)
	if (lookup?.kind !== 'token') return undefined

	// The IDENTITY bridge (spec S2 D2): `handle.id` is generation-independent, so
	// this reaches the LIVE node. It is the only thing a handle can answer since S2.7
	// deleted its bind-generation `Token` — which is the point, because reading a
	// second generation here would reintroduce the coordinate space this projection
	// exists to avoid.
	const owner = ctx.find(lookup.node.handle.id)
	if (!owner) return undefined

	// ABOVE the text-surface branch below: a token bound with both a `textElement` and a
	// `childSequenceHost` must resolve host boundaries here, or a host boundary on a
	// text-bearing token would be read as a text offset.
	if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
		return fromChildAnchor(ctx, node, offset, owner, affinity)
	}

	const textElement = lookup.node.textElement
	if (textElement?.contains(node)) {
		// A TYPE NARROW, not a runtime guard, and unreachable by construction: `bind`
		// sets `textElement` only for text tokens (bind.ts) and `adopt` never reuses a
		// node across a kind change (a mismatch builds a fresh node with a fresh id,
		// and ids are never reused), so `find` on this path can only answer that same
		// TextNode. Load-bearing anyway — `owner.text()` below does not compile without
		// it — and `undefined` is the non-throwing form per spec S2 §6.
		if (owner.kind !== 'text') return undefined
		const local = textOffsetWithin(textElement, node, offset)
		if (local === undefined) return undefined
		// spec S2 D4's second fail-closed condition: the offset is local to the node's
		// own text, so it is correct even mid-window UNLESS that text shrank.
		return local <= owner.text().length ? {node: owner, offset: local} : undefined
	}

	if (node === lookup.node.tokenElement) {
		return fromChildAnchor(ctx, lookup.node.tokenElement, offset, owner, affinity)
	}

	if (owner.kind === 'mark' && lookup.node.tokenElement.contains(node)) {
		if (hasEditableAncestorBefore(node, lookup.node.tokenElement)) {
			return undefined
		}
		return affinity === 'after' ? {before: owner} : {after: owner}
	}

	if (lookup.node.rowElement && node === lookup.node.rowElement) {
		return offset <= 0 ? {before: owner} : {after: owner}
	}

	return undefined
}

/** The `<=0` / `>=childCount` / interior split both element branches share. */
function fromChildAnchor(
	ctx: AnchorContext,
	element: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	const childCount = element.childNodes.length
	if (offset <= 0) return {before: owner}
	if (offset >= childCount) return {after: owner}
	return childBoundaryAnchor(ctx, element, offset, owner, affinity)
}

/** The interior of {@link fromChildAnchor}, including its inverted-affinity fallback. */
function childBoundaryAnchor(
	ctx: AnchorContext,
	tokenElement: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	// UNREACHABLE with a text owner, which is why there is no text arm. `bind` gives a
	// text token the SAME element as its `tokenElement` and its `textElement` (bind.ts),
	// and `contains` is reflexive, so the text-surface branch above answers first; and
	// `adopt` never reuses a node across a kind change, so an id bound as text resolves
	// to a `TextNode`. The remaining door — a text token with a registered
	// `childSequenceHost` — no adapter opens: both render `TokenChildren` only for a mark
	// with children.
	const beforeView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const afterView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (beforeView && afterView) {
		const beforeNode = ctx.find(beforeView.handle.id)
		const afterNode = ctx.find(afterView.handle.id)
		if (beforeNode && afterNode) {
			return affinity === 'before' ? {after: beforeNode} : {before: afterNode}
		}
	}

	// INVERTED: 'before' answers with the owner's START. It reads backwards, and it is
	// preserved from the numeric twin deleted at S2.6 — whose pinned probe table never
	// reached this line either. Its one gate is `domBoundary.spec`'s "falls back to the
	// owner INVERTED when a neighbour left the tree", on the `mountNested` fixture after
	// a structural edit that kills a child: a dead neighbour is the only way to reach
	// here, because `locate` walks up to the nearest bound ancestor and so resolves every
	// child of a bound element.
	return affinity === 'before' ? {before: owner} : {after: owner}
}

/** The container arm: the document edges by side, the interior by affinity. */
function fromContainerAnchor(roots: readonly TreeNode[], offset: number, affinity: 'before' | 'after'): NodeAnchor {
	if (roots.length === 0) return 'start'
	if (offset <= 0) return {before: roots[0]}
	if (offset >= roots.length) return {after: roots[roots.length - 1]}
	return affinity === 'before' ? {after: roots[offset - 1]} : {before: roots[offset]}
}

function lookupTokenDescendant(ctx: Pick<AnchorContext, 'locate'>, node: Node | null): TokenView | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}