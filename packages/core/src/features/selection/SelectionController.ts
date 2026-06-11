// packages/core/src/features/selection/SelectionController.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, RawSelection, TokenAddress} from '../../shared/editorContracts'
import {computed, listen, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {reconcileTextSurfaces, type Token, type TokenNode} from '../tokens'
import {focusIfNeeded, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from '../tokens/caret'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from '../tokens/textOffsets'
import type {TokenIndex} from '../tokens/tokenIndex'
import type {TokenModel} from '../tokens/TokenModel'

export class SelectionController {
	readonly range: Signal<Range | undefined> = signal<Range>({equals: shallow})
	readonly position = computed({
		get: () => this.range()?.start,
		set: value => this.range(value !== undefined ? {start: value, end: value} : undefined),
	})

	readonly isAllSelected: Computed<boolean> = computed(() => {
		const s = this.range()
		const v = this.value.current()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	readonly isUserSelecting: Signal<boolean> = signal({initial: false})

	#isPlacingCaret = false
	#preferredAddress: TokenAddress | undefined

	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel,
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {
		host.onMounted(container => {
			this.#focusEmptyEditorOnClick(container)
			this.#trackSelection(container)
			this.#trackUserSelecting(container)

			watch(this.tokens.indexed, () => {
				this.#reconcileSurfaces()
				this.#applyRange()
			})
			watch(this.props.readOnly, () => this.#reconcileSurfaces())
			watch(this.isUserSelecting, () => this.#reconcileSurfaces())

			watch(this.range, () => this.#applyRange())
		})
	}

	#reconcileSurfaces(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		reconcileTextSurfaces(this.tokens.nodes(), this.tokens.index(), {editable, readOnly})
	}

	selectAll(): void {
		this.range({start: 0, end: this.value.current().length})
	}

	focusFirst(): void {
		const firstAddress = this.tokens.index().addressFor([0])
		if (firstAddress && this.placeAtAddress(firstAddress, 'start')) return
		this.host.container()?.focus()
	}

	readRaw(): RawSelection | undefined {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined

		const range = selection.getRangeAt(0)
		const start = this.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')
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

	rawPositionFromBoundary(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		const container = this.host.container()
		if (container && node === container) {
			return fromContainerBoundary(this.tokens.current(), offset, affinity)
		}

		const lookup = this.tokens.locate(node)
		if (lookup?.kind !== 'token') return undefined

		const tokenIndex = this.tokens.index()
		const token = tokenIndex.resolveAddress(lookup.node.address)
		if (!token) return undefined

		if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
			const childCount = node.childNodes.length
			if (offset <= 0) return token.position.start
			if (offset >= childCount) return token.position.end
			return fromTokenChildBoundary(this.tokens, tokenIndex, node, offset, token, affinity)
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
			return fromTokenChildBoundary(this.tokens, tokenIndex, lookup.node.tokenElement, offset, token, affinity)
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

	readSelectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}

	placeAtAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		const resolved = this.#resolveAddress(address, boundary)
		if (!resolved) return false
		if (!this.range(resolved)) this.#applyRange()
		return true
	}

	#applyRange(): void {
		if (this.isUserSelecting()) return
		const range = this.range()
		if (range === undefined) return

		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}

		this.#isPlacingCaret = true
		let placed: boolean
		try {
			placed = clamped.start === clamped.end ? this.#placeCollapsed(clamped.start) : this.#placeExtended(clamped)
		} finally {
			this.#isPlacingCaret = false
		}
		if (!placed) return

		if (clamped.start !== range.start || clamped.end !== range.end) {
			this.range(clamped)
		}
	}

	#resolveAddress(address: TokenAddress, boundary: 'start' | 'end'): Range | undefined {
		if (!this.tokens.nodeFor(address)) return undefined
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved) return undefined
		const pos = boundary === 'end' ? resolved.position.end : resolved.position.start
		this.#preferredAddress = address
		return {start: pos, end: pos}
	}

	#applyPreferredAddress(rawPosition: number): boolean {
		const address = this.#preferredAddress
		this.#preferredAddress = undefined
		if (!address) return false
		const node = this.tokens.nodeFor(address)
		if (!node) return false
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved) return false
		if (resolved.type === 'mark') {
			placeAtMarkBoundary(node.tokenElement, rawPosition, resolved.position)
			return true
		}
		const target = node.textElement ?? node.tokenElement
		focusIfNeeded(target)
		if (node.textElement) {
			placeAtTextOffset(node.textElement, rawPosition - resolved.position.start)
		}
		return true
	}

	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredAddress(rawPosition)) return true

		const tokenIndex = this.tokens.index()
		const textTarget = findTextTargetAt(this.tokens, tokenIndex, rawPosition)
		if (textTarget) {
			focusIfNeeded(textTarget.element)
			placeAtTextOffset(textTarget.element, rawPosition - textTarget.start)
			return true
		}

		const markTarget = findMarkBoundaryAt(this.tokens, tokenIndex, rawPosition)
		if (markTarget) {
			placeAtMarkBoundary(markTarget.element, rawPosition, markTarget.position)
			return true
		}

		return false
	}

	#placeExtended(range: Range): boolean {
		const tokenIndex = this.tokens.index()
		const startTarget = findTextTargetAt(this.tokens, tokenIndex, range.start)
		const endTarget = findTextTargetAt(this.tokens, tokenIndex, range.end)
		if (!startTarget || !endTarget) return false
		placeRangeAcrossSurfaces(
			{element: startTarget.element, offset: range.start - startTarget.start},
			{element: endTarget.element, offset: range.end - endTarget.start}
		)
		return true
	}

	#focusEmptyEditorOnClick(container: HTMLElement): void {
		listen(container, 'click', () => {
			const tokens = this.tokens.current()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				firstHtmlChild(container)?.focus()
			}
		})
	}

	#trackUserSelecting(container: HTMLElement): void {
		let pressedAt: Node | null = null

		listen(document, 'mousedown', e => {
			pressedAt = nodeTarget(e)
		})

		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const startedOutsideEditor = !container.contains(pressedAt)
			const sweepingAcrossNodes = pressedAt !== e.target
			const selectionIntersectsEditor = window.getSelection()?.containsNode(container, true) ?? false
			if ((startedOutsideEditor || sweepingAcrossNodes) && selectionIntersectsEditor) {
				this.isUserSelecting(true)
			}
		})

		const clearIfCollapsed = (): void => {
			if (!this.isUserSelecting()) return
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) this.isUserSelecting(false)
		}

		listen(document, 'mouseup', () => {
			pressedAt = null
			clearIfCollapsed()
		})

		listen(document, 'selectionchange', clearIfCollapsed)
	}

	#trackSelection(container: HTMLElement): void {
		const sync = (): void => {
			this.range(this.readRaw()?.range)
		}

		const syncIfInEditor = (node: Node): void => {
			const lookup = this.tokens.locate(node)
			if (lookup?.kind === 'token') {
				sync()
				return
			}
			if (lookup?.kind === 'control') return
			this.range(undefined)
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.range(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) this.range(undefined)
			})
		})

		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const sel = window.getSelection()
			if (!sel?.focusNode) return
			syncIfInEditor(sel.focusNode)
		})
	}
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
	dom: TokenModel,
	tokenIndex: TokenIndex,
	tokenElement: HTMLElement,
	offset: number,
	token: Token,
	affinity: 'before' | 'after'
): number | undefined {
	if (token.type === 'text') {
		const path = tokenIndex.pathFor(token) ?? []
		const address = tokenIndex.addressFor(path)
		const textElement = address ? dom.nodeFor(address)?.textElement : undefined
		if (!textElement || textLength(textElement) === 0) return token.position.start
	}

	const before = lookupTokenDescendant(dom, tokenElement.childNodes.item(offset - 1))
	const after = lookupTokenDescendant(dom, tokenElement.childNodes.item(offset))
	if (before && after) {
		const beforeToken = tokenIndex.resolveAddress(before.address)
		const afterToken = tokenIndex.resolveAddress(after.address)
		if (beforeToken && afterToken) {
			return affinity === 'before' ? beforeToken.position.end : afterToken.position.start
		}
	}

	return affinity === 'before' ? token.position.start : token.position.end
}

function lookupTokenDescendant(dom: TokenModel, node: Node | null): TokenNode | undefined {
	if (!node) return undefined
	const lookup = dom.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}

function findTextTargetAt(
	dom: TokenModel,
	tokenIndex: TokenIndex,
	rawPosition: number
): {element: HTMLElement; start: number; end: number} | undefined {
	const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
	for (const node of dom.nodes()) {
		if (!node.textElement) continue
		const resolved = tokenIndex.resolveAddress(node.address)
		if (resolved?.type !== 'text') continue
		candidates.push({
			element: node.textElement,
			start: resolved.position.start,
			end: resolved.position.end,
		})
	}
	candidates.sort((a, b) => a.start - b.start)
	const containing = candidates.find(c => rawPosition >= c.start && rawPosition <= c.end)
	if (containing) return containing
	return candidates.find(c => c.start >= rawPosition)
}

function findMarkBoundaryAt(
	dom: TokenModel,
	tokenIndex: TokenIndex,
	rawPosition: number
): {element: HTMLElement; position: {start: number; end: number}} | undefined {
	for (const node of dom.nodes()) {
		const resolved = tokenIndex.resolveAddress(node.address)
		if (resolved?.type !== 'mark') continue
		if (rawPosition !== resolved.position.start && rawPosition !== resolved.position.end) continue
		return {element: node.tokenElement, position: resolved.position}
	}
	return undefined
}

function placeAtMarkBoundary(element: HTMLElement, rawPosition: number, position: {start: number; end: number}): void {
	focusIfNeeded(element)
	placeAtChildBoundary(element, rawPosition === position.end ? 'end' : 'start')
}