import type {Token} from '../parser/types'
import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'
import type {ElementBindings, TokenHandle} from './TokenHandle'

/** A bound token as the facade reads it: the live DOM bindings plus the handle itself. */
export type TokenView = ElementBindings & {
	readonly handle: TokenHandle
}

export type Lookup = {readonly kind: 'control'} | {readonly kind: 'token'; readonly node: TokenView}

export type BoundaryContext = {
	container: HTMLElement | undefined
	tokens: readonly Token[]
	/**
	 * Reads the handle's live token, or `undefined` if its handle is no longer
	 * live. Rejects during the structural reconcile → bind window (the node layer
	 * is one generation stale) and for killed handles.
	 */
	tokenOf(view: TokenView): Token | undefined
	/** Id-bridged view of a current-tree token's bound node, if any. */
	viewOf(token: Token): TokenView | undefined
	locate(node: Node): Lookup | undefined
	nodes(): IterableIterator<TokenView>
}

/**
 * What the ANCHOR projection needs: the DOM half of {@link BoundaryContext},
 * plus a bridge from a bound handle's stable id to the LIVE node.
 *
 * A `Pick`, not an intersection, so the exclusion is a compile error and not a
 * convention. All three excluded members answer with `Token`s, and a `Token`
 * carries `position` — an absolute coordinate no module above `tree/` may read
 * (spec S2 D1). `tokenOf`/`viewOf` are excluded twice over: both are gated to
 * the BIND GENERATION (spec S1 D9), which describes what the DOM is showing
 * rather than what the tree holds. `tokens` is NOT — it is `current()`, fresh at
 * the top of every apply — so coordinates alone are what rule it out. The anchor
 * projection never forms an absolute coordinate, so it wants identity, not
 * coordinates (spec S2 D1/D4).
 */
export type AnchorContext = Pick<BoundaryContext, 'container' | 'locate'> & {
	/** The live root nodes (TokenModel.nodes()). */
	roots(): readonly TreeNode[]
	/** Stable id → live node (TokenModel.find). NOT latch-gated: ids outlive the bind window. */
	find(id: Id): TreeNode | undefined
	/** The bound view for a live node's id, if any. */
	viewOfId(id: Id): TokenView | undefined
}

/**
 * Map a DOM boundary (node, offset) to a node anchor in the LIVE tree.
 *
 * PARTIAL: container, child-sequence, text-surface and token-shell boundaries
 * are live; mark-presentation and row boundaries land in Task 5 and answer
 * `undefined` until then.
 *
 * The anchor projection of the same walk that {@link rawPositionFromBoundary}
 * projects numerically. No absolute coordinate is formed anywhere on this path,
 * which is why it is correct during the adopt→bind window where the numeric one
 * is not (spec S2 D4).
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
	// this reaches the LIVE node. Reading the handle's token here would reach the bind
	// generation and reintroduce the coordinate space this projection exists to avoid.
	const owner = ctx.find(lookup.node.handle.id)
	if (!owner) return undefined

	// ABOVE the text branch, as in the numeric walk: a token bound with both a
	// `textElement` and a `childSequenceHost` must resolve host boundaries here or
	// the two projections diverge.
	if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
		return fromChildAnchor(ctx, node, offset, owner, affinity)
	}

	const textElement = lookup.node.textElement
	if (textElement?.contains(node)) {
		// bind sets `textElement` only for text tokens (bind.ts), so the narrow cannot
		// fail in practice; `undefined` is the non-throwing answer per spec S2 §6.
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

/** Mirrors {@link fromTokenChildBoundary}, including its inverted-affinity fallback. */
function childBoundaryAnchor(
	ctx: AnchorContext,
	tokenElement: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: 'before' | 'after'
): NodeAnchor | undefined {
	if (owner.kind === 'text') {
		const textElement = ctx.viewOfId(owner.id)?.textElement
		if (!textElement || textLength(textElement) === 0) return {before: owner}
	}

	const beforeView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const afterView = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (beforeView && afterView) {
		const beforeNode = ctx.find(beforeView.handle.id)
		const afterNode = ctx.find(afterView.handle.id)
		if (beforeNode && afterNode) {
			return affinity === 'before' ? {after: beforeNode} : {before: afterNode}
		}
	}

	// INVERTED, and preserved verbatim from `fromTokenChildBoundary`'s last line:
	// 'before' answers with the owner's START. It reads backwards; it is the
	// behavior the pinned table gates.
	return affinity === 'before' ? {before: owner} : {after: owner}
}

/** Mirrors {@link fromContainerBoundary}: same branches, anchors instead of positions. */
function fromContainerAnchor(roots: readonly TreeNode[], offset: number, affinity: 'before' | 'after'): NodeAnchor {
	if (roots.length === 0) return 'start'
	if (offset <= 0) return {before: roots[0]}
	if (offset >= roots.length) return {after: roots[roots.length - 1]}
	return affinity === 'before' ? {after: roots[offset - 1]} : {before: roots[offset]}
}

/** Map a DOM boundary (node, offset) to an absolute document position. */
export function rawPositionFromBoundary(
	ctx: BoundaryContext,
	node: Node,
	offset: number,
	affinity: 'before' | 'after' = 'after'
): number | undefined {
	if (ctx.container && node === ctx.container) {
		return fromContainerBoundary(ctx.tokens, offset, affinity)
	}

	const lookup = ctx.locate(node)
	if (lookup?.kind !== 'token') return undefined

	const token = ctx.tokenOf(lookup.node)
	if (!token) return undefined

	if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
		const childCount = node.childNodes.length
		if (offset <= 0) return token.position.start
		if (offset >= childCount) return token.position.end
		return fromTokenChildBoundary(ctx, node, offset, token, affinity)
	}

	const textElement = lookup.node.textElement
	if (textElement?.contains(node)) {
		const local = textOffsetWithin(textElement, node, offset)
		if (local === undefined) return undefined
		return token.position.start + local
	}

	if (node === lookup.node.tokenElement) {
		const childCount = lookup.node.tokenElement.childNodes.length
		if (offset <= 0) return token.position.start
		if (offset >= childCount) return token.position.end
		return fromTokenChildBoundary(ctx, lookup.node.tokenElement, offset, token, affinity)
	}

	if (token.type === 'mark' && lookup.node.tokenElement.contains(node)) {
		if (hasEditableAncestorBefore(node, lookup.node.tokenElement)) {
			return undefined
		}
		return affinity === 'after' ? token.position.start : token.position.end
	}

	if (lookup.node.rowElement && node === lookup.node.rowElement) {
		return offset <= 0 ? token.position.start : token.position.end
	}

	return undefined
}

function fromContainerBoundary(
	tokens: readonly Token[],
	offset: number,
	affinity: 'before' | 'after'
): number | undefined {
	if (tokens.length === 0) return 0
	if (offset <= 0) return tokens[0].position.start
	if (offset >= tokens.length) return tokens[tokens.length - 1].position.end

	const before = tokens[offset - 1]
	const after = tokens[offset]
	return affinity === 'before' ? before.position.end : after.position.start
}

function fromTokenChildBoundary(
	ctx: BoundaryContext,
	tokenElement: HTMLElement,
	offset: number,
	token: Token,
	affinity: 'before' | 'after'
): number | undefined {
	if (token.type === 'text') {
		const textElement = ctx.viewOf(token)?.textElement
		if (!textElement || textLength(textElement) === 0) return token.position.start
	}

	const before = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const after = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (before && after) {
		const beforeToken = ctx.tokenOf(before)
		const afterToken = ctx.tokenOf(after)
		if (beforeToken && afterToken) {
			return affinity === 'before' ? beforeToken.position.end : afterToken.position.start
		}
	}

	return affinity === 'before' ? token.position.start : token.position.end
}

function lookupTokenDescendant(ctx: Pick<BoundaryContext, 'locate'>, node: Node | null): TokenView | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}

/** Text token containing `rawPosition`, else the next one after it. */
export function textTargetAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'tokenOf'>,
	rawPosition: number
): {node: TokenView; start: number; end: number} | undefined {
	const candidates: Array<{node: TokenView; start: number; end: number}> = []
	for (const node of ctx.nodes()) {
		if (!node.textElement) continue
		const resolved = ctx.tokenOf(node)
		if (resolved?.type !== 'text') continue
		candidates.push({node, start: resolved.position.start, end: resolved.position.end})
	}
	candidates.sort((a, b) => a.start - b.start)
	const containing = candidates.find(c => rawPosition >= c.start && rawPosition <= c.end)
	if (containing) return containing
	return candidates.find(c => c.start >= rawPosition)
}

/** Mark token whose start or end boundary sits exactly at `rawPosition`. */
export function markBoundaryAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'tokenOf'>,
	rawPosition: number
): {element: HTMLElement; position: {start: number; end: number}} | undefined {
	for (const node of ctx.nodes()) {
		const resolved = ctx.tokenOf(node)
		if (resolved?.type !== 'mark') continue
		if (rawPosition !== resolved.position.start && rawPosition !== resolved.position.end) continue
		return {element: node.tokenElement, position: resolved.position}
	}
	return undefined
}