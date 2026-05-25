// packages/core/src/features/selection/DomBoundary.ts
import type {RawSelection, TokenAddress, TokenPath} from '../../shared/editorContracts'
import type {Lookup, TokenNode} from '../dom'
import type {Token} from '../parsing'
import type {TokenModel} from '../parsing/TokenModel'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'

export interface DomBoundaryHost {
	container(): HTMLElement | null
	isIndexed(): boolean
	isComposing(): boolean
	locate(node: Node): Lookup | undefined
	nodeFor(address: TokenAddress): TokenNode | undefined
}

export class DomBoundary {
	constructor(
		private readonly host: DomBoundaryHost,
		private readonly tokens: TokenModel
	) {}

	fromBoundary(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		if (!this.host.isIndexed()) return undefined
		if (this.host.isComposing()) return undefined

		const container = this.host.container()
		if (container && node === container) {
			return this.#fromContainerBoundary(offset, affinity)
		}

		const lookup = this.host.locate(node)
		if (lookup?.kind !== 'token') return undefined

		const token = this.tokens.index().resolveAddress(lookup.node.address)
		if (!token) return undefined

		if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
			const childCount = node.childNodes.length
			if (offset <= 0) return token.position.start
			if (offset >= childCount) return token.position.end
			return this.#fromTokenChildBoundary(node, offset, token, affinity)
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
			return this.#fromTokenChildBoundary(lookup.node.tokenElement, offset, token, affinity)
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

	readSelection(): RawSelection | undefined {
		if (!this.host.isIndexed()) return undefined
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined

		const range = selection.getRangeAt(0)
		const start = this.fromBoundary(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.fromBoundary(range.endContainer, range.endOffset, 'before')
		if (end === undefined) return undefined

		const rangeValue = start <= end ? {start, end} : {start: end, end: start}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return direction ? {range: rangeValue, direction} : {range: rangeValue}
	}

	#fromContainerBoundary(offset: number, affinity: 'before' | 'after'): number | undefined {
		const tokens = this.tokens.current()
		if (tokens.length === 0) return 0
		if (offset <= 0) return tokens[0].position.start
		if (offset >= tokens.length) return tokens[tokens.length - 1].position.end

		const before = tokens[offset - 1]
		const after = tokens[offset]
		return affinity === 'before' ? before.position.end : after.position.start
	}

	#fromTokenChildBoundary(
		tokenElement: HTMLElement,
		offset: number,
		token: Token,
		affinity: 'before' | 'after'
	): number | undefined {
		if (token.type === 'text') {
			const path: TokenPath = this.tokens.index().pathFor(token) ?? []
			const address = this.tokens.index().addressFor(path)
			const textElement = address ? this.host.nodeFor(address)?.textElement : undefined
			if (!textElement || textLength(textElement) === 0) return token.position.start
		}

		const before = this.#lookupDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#lookupDescendant(tokenElement.childNodes.item(offset))
		if (before && after) {
			const beforeToken = this.tokens.index().resolveAddress(before.address)
			const afterToken = this.tokens.index().resolveAddress(after.address)
			if (beforeToken && afterToken) {
				return affinity === 'before' ? beforeToken.position.end : afterToken.position.start
			}
		}

		return affinity === 'before' ? token.position.start : token.position.end
	}

	#lookupDescendant(node: Node | null): TokenNode | undefined {
		if (!node) return undefined
		const lookup = this.host.locate(node)
		return lookup?.kind === 'token' ? lookup.node : undefined
	}
}