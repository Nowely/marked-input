import type {TokenAddress} from '../../shared/editorContracts'
import type {Lookup, TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'
import type {TokenIndex} from './tokenIndex'

export type BoundaryContext = {
	container: HTMLElement | undefined
	tokens: readonly Token[]
	index: TokenIndex
	locate(node: Node): Lookup | undefined
	nodeFor(address: TokenAddress): TokenNode | undefined
	nodes(): IterableIterator<TokenNode>
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

	const token = ctx.index.resolveAddress(lookup.node.address)
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
		const path = ctx.index.pathFor(token) ?? []
		const address = ctx.index.addressFor(path)
		const textElement = address ? ctx.nodeFor(address)?.textElement : undefined
		if (!textElement || textLength(textElement) === 0) return token.position.start
	}

	const before = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const after = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (before && after) {
		const beforeToken = ctx.index.resolveAddress(before.address)
		const afterToken = ctx.index.resolveAddress(after.address)
		if (beforeToken && afterToken) {
			return affinity === 'before' ? beforeToken.position.end : afterToken.position.start
		}
	}

	return affinity === 'before' ? token.position.start : token.position.end
}

function lookupTokenDescendant(ctx: BoundaryContext, node: Node | null): TokenNode | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}

/** Text token containing `rawPosition`, else the next one after it. */
export function textTargetAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'index'>,
	rawPosition: number
): {node: TokenNode; start: number; end: number} | undefined {
	const candidates: Array<{node: TokenNode; start: number; end: number}> = []
	for (const node of ctx.nodes()) {
		if (!node.textElement) continue
		const resolved = ctx.index.resolveAddress(node.address)
		if (resolved?.type !== 'text') continue
		candidates.push({node, start: resolved.position.start, end: resolved.position.end})
	}
	candidates.sort((a, b) => a.start - b.start)
	const containing = candidates.find(c => rawPosition >= c.start && rawPosition <= c.end)
	if (containing) return containing
	return candidates.find(c => c.start >= rawPosition)
}

/**
 * Mark token whose start or end boundary sits exactly at `rawPosition`.
 * Consumed by TokenModel's placement commands (landing in the next task);
 * currently mirrored by SelectionController's private copy until that migration completes.
 */
export function markBoundaryAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'index'>,
	rawPosition: number
): {element: HTMLElement; position: {start: number; end: number}} | undefined {
	for (const node of ctx.nodes()) {
		const resolved = ctx.index.resolveAddress(node.address)
		if (resolved?.type !== 'mark') continue
		if (rawPosition !== resolved.position.start && rawPosition !== resolved.position.end) continue
		return {element: node.tokenElement, position: resolved.position}
	}
	return undefined
}