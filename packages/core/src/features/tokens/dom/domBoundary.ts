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
		return fromContainerAnchor(ctx, ctx.container, offset, affinity)
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
		// AGAINST THE TOKEN'S OWN INDEX, not 0: a row also holds chrome the tree does not
		// own (the React/Vue `Block` renderers put a drop indicator and a drag handle
		// BEFORE the token), so the boundary that precedes the token is its child index,
		// not the row's start.
		const tokenIndex = Array.prototype.indexOf.call(node.childNodes, lookup.node.tokenElement)
		return offset <= tokenIndex ? {before: owner} : {after: owner}
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

/**
 * The container arm: RAW DOM coordinates in, bound-token coordinates out. The
 * container's children are not the roots — controls sit among them, and so do the
 * framework's own placeholders (a Vue fragment anchors on an EMPTY TEXT NODE, `v-if` on
 * a comment) — so the boundary resolves through its nearest TOKEN neighbours instead of
 * indexing into `roots`. Both edges fall out of the same two scans: no neighbour on one
 * side is what makes a boundary an edge.
 *
 * Neither side answering means there is no bound token in the container at all — an
 * empty document, or a frame whose alignment `bind` bailed on — and `'start'` is the
 * guess for both. The root-index predecessor answered `'start'` only for the first.
 */
function fromContainerAnchor(
	ctx: AnchorContext,
	container: HTMLElement,
	offset: number,
	affinity: 'before' | 'after'
): NodeAnchor {
	const after = tokenAt(ctx, container, offset, 1)
	const before = tokenAt(ctx, container, offset - 1, -1)
	if (before && after) return affinity === 'before' ? {after: before} : {before: after}
	if (after) return {before: after}
	if (before) return {after: before}
	return 'start'
}

/**
 * The nearest container child at or beyond `index` in `step`'s direction whose element
 * is a bound token, as that token's LIVE node. A DEAD neighbour — still bound, its node
 * gone from the tree — is skipped like any other non-token child rather than ending the
 * scan: the nearest LIVE token is the answer, and stopping short would fail a boundary
 * closed for the whole adopt→bind window after a deletion.
 */
function tokenAt(ctx: AnchorContext, container: HTMLElement, index: number, step: 1 | -1): TreeNode | undefined {
	const children = container.childNodes
	for (let i = index; i >= 0 && i < children.length; i += step) {
		const child = children.item(i)
		if (!(child instanceof HTMLElement)) continue
		const lookup = ctx.locate(child)
		if (lookup?.kind !== 'token') continue
		const node = ctx.find(lookup.node.handle.id)
		if (node) return node
	}
	return undefined
}

function lookupTokenDescendant(ctx: Pick<AnchorContext, 'locate'>, node: Node | null): TokenView | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}