// packages/core/src/features/selection/SelectionController.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {BoundaryPositionResult, Range, RawSelectionResult, TokenAddress} from '../../shared/editorContracts'
import {computed, listen, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomTokenBridge} from '../bridge'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {focusIfNeeded, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caretDom'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'

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

	readonly isUserSelecting: Signal<boolean> = signal<boolean>({initial: false})

	#isPlacingCaret = false
	readonly #boundary: DomBoundary
	#preferredAddress: TokenAddress | undefined

	constructor(
		private readonly host: Host,
		private readonly bridge: DomTokenBridge,
		private readonly tokens: TokenModel,
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {
		const boundaryHost: DomBoundaryHost = {
			container: () => this.host.container(),
			isIndexed: () => this.bridge.isIndexed(),
			isComposing: () => this.bridge.isComposing(),
			locateNode: node => this.bridge.locateNode(node),
			roleFor: element => this.bridge.roleFor(element),
			pathElementsFor: address => this.bridge.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, this.tokens)

		host.onMounted(container => {
			this.#focusEmptyEditorOnClick(container)
			this.#trackSelection(container)
			this.#trackUserSelecting(container)

			watch(this.range, () => this.#applyRange())
			watch(bridge.indexed, () => this.#applyRange())
			watch(this.isUserSelecting, () => bridge.setSelecting(this.isUserSelecting()))
		})
	}

	selectAll(): void {
		this.range({start: 0, end: this.value.current().length})
	}

	focusFirst(): void {
		const firstAddress = this.tokens.index().addressFor([0])
		if (firstAddress && this.placeAtAddress(firstAddress, 'start')) return
		this.host.container()?.focus()
	}

	readRaw(): RawSelectionResult {
		return this.#boundary.readSelection()
	}

	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		return this.#boundary.fromBoundary(node, offset, affinity)
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
		if (!this.bridge.isIndexed()) return
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
		if (!this.bridge.isIndexed()) return undefined
		if (!this.bridge.pathElementsFor(address)) return undefined
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
		const elements = this.bridge.pathElementsFor(address)
		if (!elements) return false
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved) return false
		if (resolved.type === 'mark') {
			this.#placeAtMarkBoundary(elements.tokenElement, rawPosition, resolved.position)
			return true
		}
		const target = elements.textElement ?? elements.tokenElement
		focusIfNeeded(target)
		if (elements.textElement) {
			placeAtTextOffset(elements.textElement, rawPosition - resolved.position.start)
		}
		return true
	}

	#findTextTargetForRawPosition(rawPosition: number): {element: HTMLElement; start: number; end: number} | undefined {
		const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
		const tokenIndex = this.tokens.index()
		for (const record of this.bridge.pathElements()) {
			if (!record.textElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (resolved?.type !== 'text') continue
			candidates.push({
				element: record.textElement,
				start: resolved.position.start,
				end: resolved.position.end,
			})
		}
		candidates.sort((a, b) => a.start - b.start)
		const containing = candidates.find(c => rawPosition >= c.start && rawPosition <= c.end)
		if (containing) return containing
		return candidates.find(c => c.start >= rawPosition)
	}

	#focusMarkBoundaryForRawPosition(rawPosition: number): boolean {
		const tokenIndex = this.tokens.index()
		for (const record of this.bridge.pathElements()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (resolved?.type !== 'mark') continue
			if (rawPosition !== resolved.position.start && rawPosition !== resolved.position.end) continue
			this.#placeAtMarkBoundary(record.tokenElement, rawPosition, resolved.position)
			return true
		}
		return false
	}

	#placeAtMarkBoundary(element: HTMLElement, rawPosition: number, position: {start: number; end: number}): void {
		focusIfNeeded(element)
		placeAtChildBoundary(element, rawPosition === position.end ? 'end' : 'start')
	}

	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredAddress(rawPosition)) return true
		const target = this.#findTextTargetForRawPosition(rawPosition)
		if (target) {
			focusIfNeeded(target.element)
			placeAtTextOffset(target.element, rawPosition - target.start)
			return true
		}
		return this.#focusMarkBoundaryForRawPosition(rawPosition)
	}

	#placeExtended(range: Range): boolean {
		const startTarget = this.#findTextTargetForRawPosition(range.start)
		const endTarget = this.#findTextTargetForRawPosition(range.end)
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
			const rawSel = this.#boundary.readSelection()
			this.range(rawSel.ok ? rawSel.value.range : undefined)
		}

		const syncIfInEditor = (node: Node): void => {
			const result = this.bridge.locateNode(node)
			if (!result.ok) {
				if (result.reason === 'control') return
				this.range(undefined)
				return
			}
			sync()
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