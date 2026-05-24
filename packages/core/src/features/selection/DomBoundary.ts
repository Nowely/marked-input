// packages/core/src/features/selection/DomBoundary.ts
import type {
	BoundaryPositionResult,
	NodeLocationResult,
	RawSelectionResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import type {PathElements, RegisteredRole} from '../bridge'
import type {Token} from '../parsing'
import type {TokenModel} from '../parsing/TokenModel'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'

export interface DomBoundaryHost {
	container(): HTMLElement | null
	isIndexed(): boolean
	isComposing(): boolean
	locateNode(node: Node): NodeLocationResult
	roleFor(element: HTMLElement): RegisteredRole | undefined
	pathElementsFor(address: TokenAddress): PathElements | undefined
}

export class DomBoundary {
	constructor(
		private readonly host: DomBoundaryHost,
		private readonly tokens: TokenModel
	) {}

	fromBoundary(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): BoundaryPositionResult {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		if (this.host.isComposing()) return {ok: false, reason: 'composing'}

		const container = this.host.container()
		if (container && node === container) {
			return this.#fromContainerBoundary(offset, affinity)
		}

		const location = this.host.locateNode(node)
		if (!location.ok) return location.reason === 'control' ? {ok: false, reason: 'control'} : location

		const token = this.tokens.index().resolveAddress(location.value.address)
		if (!token) return {ok: false, reason: 'notIndexed'}

		if (node instanceof HTMLElement) {
			const role = this.host.roleFor(node)
			if (role?.role === 'childSequence') {
				const childCount = node.childNodes.length
				if (offset <= 0) return {ok: true, value: token.position.start}
				if (offset >= childCount) return {ok: true, value: token.position.end}
				return this.#fromTokenChildBoundary(node, offset, token, affinity)
			}
		}

		const textElement = location.value.textElement
		if (textElement?.contains(node)) {
			const local = textOffsetWithin(textElement, node, offset)
			if (local === undefined) return {ok: false, reason: 'invalidBoundary'}
			return {ok: true, value: token.position.start + local}
		}

		if (node === location.value.tokenElement) {
			const childCount = location.value.tokenElement.childNodes.length
			if (offset <= 0) return {ok: true, value: token.position.start}
			if (offset >= childCount) return {ok: true, value: token.position.end}
			return this.#fromTokenChildBoundary(location.value.tokenElement, offset, token, affinity)
		}

		if (token.type === 'mark' && location.value.tokenElement.contains(node)) {
			if (hasEditableAncestorBefore(node, location.value.tokenElement)) {
				return {ok: false, reason: 'invalidBoundary'}
			}
			return {
				ok: true,
				value: affinity === 'after' ? token.position.start : token.position.end,
			}
		}

		if (location.value.rowElement && node === location.value.rowElement) {
			return {ok: true, value: offset <= 0 ? token.position.start : token.position.end}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	readSelection(): RawSelectionResult {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return {ok: false, reason: 'invalidBoundary'}

		const range = selection.getRangeAt(0)
		const start = this.fromBoundary(range.startContainer, range.startOffset, 'after')
		const end = this.fromBoundary(range.endContainer, range.endOffset, 'before')

		if (!start.ok) {
			const reason = start.reason === 'composing' ? 'invalidBoundary' : start.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}
		if (!end.ok) {
			const reason = end.reason === 'composing' ? 'invalidBoundary' : end.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}

		const rangeValue =
			start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return {ok: true, value: direction ? {range: rangeValue, direction} : {range: rangeValue}}
	}

	#fromContainerBoundary(offset: number, affinity: 'before' | 'after'): BoundaryPositionResult {
		const tokens = this.tokens.current()
		if (tokens.length === 0) return {ok: true, value: 0}
		if (offset <= 0) return {ok: true, value: tokens[0].position.start}
		if (offset >= tokens.length) return {ok: true, value: tokens[tokens.length - 1].position.end}

		const before = tokens[offset - 1]
		const after = tokens[offset]
		return {ok: true, value: affinity === 'before' ? before.position.end : after.position.start}
	}

	#fromTokenChildBoundary(
		tokenElement: HTMLElement,
		offset: number,
		token: Token,
		affinity: 'before' | 'after'
	): BoundaryPositionResult {
		if (token.type === 'text') {
			const path: TokenPath = this.tokens.index().pathFor(token) ?? []
			const address = this.tokens.index().addressFor(path)
			const textElement = address ? this.host.pathElementsFor(address)?.textElement : undefined
			if (!textElement || textLength(textElement) === 0) return {ok: true, value: token.position.start}
		}

		const before = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset))
		if (before?.ok && after?.ok) {
			const beforeToken = this.tokens.index().resolveAddress(before.value.address)
			const afterToken = this.tokens.index().resolveAddress(after.value.address)
			if (beforeToken && afterToken) {
				return {
					ok: true,
					value: affinity === 'before' ? beforeToken.position.end : afterToken.position.start,
				}
			}
		}

		return {ok: true, value: affinity === 'before' ? token.position.start : token.position.end}
	}

	#locateRegisteredDescendant(node: Node | null): NodeLocationResult | undefined {
		if (!node) return undefined
		return this.host.locateNode(node)
	}
}