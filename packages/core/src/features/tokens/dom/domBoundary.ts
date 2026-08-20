import type {Id, NodeAnchor, TreeNode} from '../tree/types'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'
import type {ElementBindings, TokenHandle} from './TokenHandle'

/**
 * Which way a boundary leans when it names no node of its own.
 *
 * `'before'` and `'after'` are the RANGED reader's pair: they make the two ENDS of a span
 * lean INWARD, so a drag that starts inside a mark swallows the whole mark and one that ends
 * inside it swallows it too — Chromium's own atomic behavior for a mark.
 *
 * `'nearest'` is the COLLAPSED reader's, and only it (`SelectionDriver.domAnchors`). A caret
 * has no inside, so a boundary within a mark answers with the NEAR edge instead of a fixed
 * one. A boundary BETWEEN two tokens has no half to be in, and there it reads LEFT-affine
 * like `'before'` — see {@link fromContainerAnchor} for why that spelling and not the other.
 */
export type BoundaryAffinity = 'before' | 'after' | 'nearest'

/** The token arm carries the handle plus its own live DOM bindings — no flattened copy. */
export type Lookup =
	| {readonly kind: 'control'}
	| {readonly kind: 'token'; readonly handle: TokenHandle; readonly bindings: ElementBindings}

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
	/** Stable id → live node (TokenModel.find): ids outlive the bind window. */
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
	affinity: BoundaryAffinity = 'after'
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
	const owner = ctx.find(lookup.handle.id)
	if (!owner) return undefined

	// ABOVE the text-surface branch below: a token bound with both a `textElement` and a
	// `childSequenceHost` must resolve host boundaries here, or a host boundary on a
	// text-bearing token would be read as a text offset.
	if (node instanceof HTMLElement && node === lookup.bindings.childSequenceHost) {
		return fromHostAnchor(ctx, node, offset, owner, affinity)
	}

	const textElement = lookup.bindings.textElement
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

	if (node === lookup.bindings.tokenElement) {
		return fromChildAnchor(ctx, lookup.bindings.tokenElement, offset, owner, affinity)
	}

	if (owner.kind === 'mark' && lookup.bindings.tokenElement.contains(node)) {
		if (hasEditableAncestorBefore(node, lookup.bindings.tokenElement)) {
			return undefined
		}
		if (affinity === 'nearest') return nearestMarkEdge(lookup.bindings.tokenElement, node, offset, owner)
		return affinity === 'after' ? {before: owner} : {after: owner}
	}

	if (lookup.bindings.rowElement && node === lookup.bindings.rowElement) {
		// AGAINST THE TOKEN'S OWN INDEX, not 0: a row also holds chrome the tree does not
		// own (the React/Vue `Block` renderers put a drop indicator and a drag handle
		// BEFORE the token), so the boundary that precedes the token is its child index,
		// not the row's start.
		const tokenIndex = Array.prototype.indexOf.call(node.childNodes, lookup.bindings.tokenElement)
		return offset <= tokenIndex ? {before: owner} : {after: owner}
	}

	return undefined
}

/**
 * The mark edge a COLLAPSED caret fell nearest to — the ONE place an affinity reads the
 * offset, and only under `'nearest'`.
 *
 * Chromium answers a click inside a mark with a caret at the clicked CHARACTER, and the model
 * owns no position inside a mark's presentation, so the boundary has to name one of the
 * mark's two edges. Naming a fixed one discards what the browser already measured: MEASURED
 * in a browser at 20/50/65/75/85% of a mark's width, all five landed `{before}`, and clicking
 * the right half then pressing Backspace ate the character BEFORE the mark.
 *
 * A TIE goes to `before` — the first half is `local * 2 <= length`, so the exact midpoint and
 * a mark with no measurable text both answer with the mark's start, which is where a mark's
 * own boundary begins.
 *
 * `textOffsetWithin` declines what it cannot measure: an ELEMENT boundary on a presentation
 * node that is not the mark's own element (its own element is the branch above). `before` is
 * that case's answer too — it is what every collapsed read gave before this rule existed.
 */
function nearestMarkEdge(element: HTMLElement, node: Node, offset: number, owner: TreeNode): NodeAnchor {
	const local = textOffsetWithin(element, node, offset)
	if (local === undefined) return {before: owner}
	return local * 2 > textLength(element) ? {after: owner} : {before: owner}
}

/** The `<=0` / `>=childCount` / interior split of a token's own SHELL element. */
function fromChildAnchor(
	ctx: AnchorContext,
	element: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: BoundaryAffinity
): NodeAnchor | undefined {
	const childCount = element.childNodes.length
	if (offset <= 0) return {before: owner}
	if (offset >= childCount) return {after: owner}
	return childBoundaryAnchor(ctx, element, offset, owner, affinity)
}

/**
 * The SLOT HOST's boundaries, which are NOT the shell's: a host holds the owner's CHILDREN,
 * so its edges are the slot's INTERIOR — the first child's start and the last child's end.
 * The owner's own boundary sits outside its markup, one `@[` away, and answering with it let
 * an edit at the edge of a slot escape the mark: MEASURED on `@[a @[b] c]` (slot [2,10]),
 * `insertText 'X'` at host offset 0 produced `X@[a @[b] c]` and at the last edge
 * `@[a @[b] c]X`, where the slot is the only place a caret there can mean.
 *
 * The owner-boundary fallback survives for the door no parse opens: every slot the parser
 * builds holds at least one text token (`@[]` parses to one empty child at the slot start),
 * so a childless owner here is either a text token with a registered host — no adapter
 * renders one — or a host whose children `bind` could not align, and with no child to name,
 * the owner's boundary is the only honest answer left.
 */
function fromHostAnchor(
	ctx: AnchorContext,
	host: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: BoundaryAffinity
): NodeAnchor | undefined {
	const childCount = host.childNodes.length
	if (offset > 0 && offset < childCount) return childBoundaryAnchor(ctx, host, offset, owner, affinity)
	const children = owner.kind === 'mark' ? owner.children() : []
	// `.at`, not an index read: `noUncheckedIndexedAccess` is off, so the empty case would
	// type as a `TreeNode` and the fallback below would be linted away as impossible.
	const edge = offset <= 0 ? children.at(0) : children.at(-1)
	if (!edge) return offset <= 0 ? {before: owner} : {after: owner}
	return offset <= 0 ? {before: edge} : {after: edge}
}

/** The interior of {@link fromChildAnchor}, including its inverted-affinity fallback. */
function childBoundaryAnchor(
	ctx: AnchorContext,
	tokenElement: HTMLElement,
	offset: number,
	owner: TreeNode,
	affinity: BoundaryAffinity
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

	// A neighbour that resolves to no TOKEN. The reachable door is a registered CONTROL:
	// `computeControlRoots` marks a control and every ancestor of it up to the container, and
	// `DomModel.#locate` answers `{kind: 'control'}` for one and stops walking — so a sibling
	// that merely CONTAINS a control resolves to nothing here, with every node alive and every
	// element bound. Gated by `domBoundary.spec`'s "falls back to the owner when a neighbour is a
	// registered CONTROL", which also pins the control-free twin taking the paired branch.
	//
	// The older claim that a dead neighbour was the only way here was wrong twice over: it is not
	// the only way, and it is no longer a way at all — every commit binds and the kill sweep is
	// tree-driven, so "element bound, node gone" is not a state a commit can leave behind.
	//
	// INWARD, the same spelling as the mark-presentation arm above and as the container arm: a
	// range END asks with 'before' and gets the owner's far side, a START asks with 'after' and
	// gets its near one, so a selection touching this boundary SWALLOWS the mark rather than
	// stopping short of it. It read backwards until 2026-08-19 — inherited verbatim from the
	// numeric projection deleted at S2.6, whose own probe table never reached this line either —
	// and truncated a selection to the far side of the whole mark at both ends.
	return affinity === 'after' ? {before: owner} : {after: owner}
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
 *
 * `'nearest'` reads LEFT-AFFINE here, with `'before'` rather than with `'after'`. A boundary
 * BETWEEN two tokens has no near edge — `{after: previous}` and `{before: next}` name the
 * same document position, and the only question is which side spells it. The left spelling is
 * the one that makes the collapsed loop a ONE-WRITE FIXPOINT: `placeCaret({after: mark})`
 * lands exactly here, so the right spelling sent the caret on to the next token's own surface
 * and the sync re-placed it twice more. MEASURED — those extra writes clobber Chromium's drag
 * base, and a drag starting inside a mark then selected NOTHING.
 */
function fromContainerAnchor(
	ctx: AnchorContext,
	container: HTMLElement,
	offset: number,
	affinity: BoundaryAffinity
): NodeAnchor {
	const after = tokenAt(ctx, container, offset, 1)
	const before = tokenAt(ctx, container, offset - 1, -1)
	if (before && after) return affinity === 'after' ? {before: after} : {after: before}
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
		const node = ctx.find(lookup.handle.id)
		if (node) return node
	}
	return undefined
}

function lookupTokenDescendant(
	ctx: Pick<AnchorContext, 'locate'>,
	node: Node | null
): Extract<Lookup, {kind: 'token'}> | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup : undefined
}