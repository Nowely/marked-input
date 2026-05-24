// packages/core/src/features/selection/DomSelectionBridge.ts
import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {BoundaryPositionResult, Range, RawSelectionResult, TokenAddress} from '../../shared/editorContracts'
import {listen} from '../../shared/signals/index.js'
import type {Signal} from '../../shared/signals/index.js'
import type {DomTokenBridge} from '../bridge'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import type {ValueModel} from '../state/ValueModel'
import {focusIfNeeded, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caretDom'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'

export interface SelectionBridgeAttachDeps {
	onRangeRead(range: Range | undefined): void
	isUserSelecting: Signal<boolean>
	isPlacingCaret(): boolean
}

export class DomSelectionBridge {
	readonly #boundary: DomBoundary
	#preferredAddress: TokenAddress | undefined

	constructor(
		private readonly bridge: DomTokenBridge,
		private readonly tokens: TokenModel,
		private readonly value: ValueModel,
		private readonly host: Host
	) {
		const boundaryHost: DomBoundaryHost = {
			container: () => this.host.container(),
			isIndexed: () => bridge.isIndexed(),
			isComposing: () => bridge.isComposing(),
			locateNode: node => bridge.locateNode(node),
			roleFor: element => bridge.roleFor(element),
			pathElementsFor: address => bridge.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, tokens)
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

	/**
	 * Resolve `address` to a raw position and arm the preferred-address hint.
	 * Returns the resolved Range when the address is placeable; the caller is
	 * responsible for writing it to its range signal. Returns undefined when
	 * the DOM is not yet indexed or the address is stale.
	 */
	resolveAddress(address: TokenAddress, boundary: 'start' | 'end'): Range | undefined {
		if (!this.bridge.isIndexed()) return undefined
		if (!this.bridge.pathElementsFor(address)) return undefined
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved.ok) return undefined
		const pos = boundary === 'end' ? resolved.value.position.end : resolved.value.position.start
		this.#preferredAddress = address
		return {start: pos, end: pos}
	}

	attach(container: HTMLElement, deps: SelectionBridgeAttachDeps): void {
		this.#focusEmptyEditorOnClick(container)
		this.#trackSelection(container, deps)
		this.#trackUserSelecting(container, deps.isUserSelecting)
	}

	applyRange(range: Range | undefined, deps: SelectionBridgeAttachDeps): boolean {
		if (deps.isUserSelecting()) return false
		if (!this.bridge.isIndexed()) return false
		if (range === undefined) return false

		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}

		const placed =
			clamped.start === clamped.end ? this.#placeCollapsed(clamped.start) : this.#placeExtended(clamped)
		if (!placed) return false

		// Caller decides whether to write the clamped value back to the range
		// signal; we report the clamped value so it can compare.
		if (clamped.start !== range.start || clamped.end !== range.end) {
			deps.onRangeRead(clamped)
		}
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

	#trackUserSelecting(container: HTMLElement, isUserSelecting: Signal<boolean>): void {
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
				isUserSelecting(true)
			}
		})

		const clearIfCollapsed = (): void => {
			if (!isUserSelecting()) return
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) isUserSelecting(false)
		}

		listen(document, 'mouseup', () => {
			pressedAt = null
			clearIfCollapsed()
		})

		listen(document, 'selectionchange', clearIfCollapsed)
	}

	#trackSelection(container: HTMLElement, deps: SelectionBridgeAttachDeps): void {
		const sync = (): void => {
			const rawSel = this.readRaw()
			deps.onRangeRead(rawSel.ok ? rawSel.value.range : undefined)
		}

		const syncIfInEditor = (node: Node): void => {
			const result = this.bridge.locateNode(node)
			if (!result.ok) {
				if (result.reason === 'control') return
				deps.onRangeRead(undefined)
				return
			}
			sync()
		}

		listen(container, 'focusin', e => {
			if (deps.isPlacingCaret()) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				deps.onRangeRead(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) deps.onRangeRead(undefined)
			})
		})

		listen(document, 'selectionchange', () => {
			if (deps.isPlacingCaret()) return
			const sel = window.getSelection()
			if (!sel?.focusNode) return
			syncIfInEditor(sel.focusNode)
		})
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

	#applyPreferredAddress(rawPosition: number): boolean {
		const address = this.#preferredAddress
		this.#preferredAddress = undefined
		if (!address) return false

		const elements = this.bridge.pathElementsFor(address)
		if (!elements) return false
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved.ok) return false

		if (resolved.value.type === 'mark') {
			this.#placeAtMarkBoundary(elements.tokenElement, rawPosition, resolved.value.position)
			return true
		}

		const target = elements.textElement ?? elements.tokenElement
		focusIfNeeded(target)
		if (elements.textElement) {
			placeAtTextOffset(elements.textElement, rawPosition - resolved.value.position.start)
		}
		return true
	}

	#findTextTargetForRawPosition(rawPosition: number): {element: HTMLElement; start: number; end: number} | undefined {
		const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
		const tokenIndex = this.tokens.index()

		for (const record of this.bridge.pathElements()) {
			if (!record.textElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'text') continue
			candidates.push({
				element: record.textElement,
				start: resolved.value.position.start,
				end: resolved.value.position.end,
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
			if (!resolved.ok || resolved.value.type !== 'mark') continue
			if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

			this.#placeAtMarkBoundary(record.tokenElement, rawPosition, resolved.value.position)
			return true
		}
		return false
	}

	#placeAtMarkBoundary(element: HTMLElement, rawPosition: number, position: {start: number; end: number}): void {
		focusIfNeeded(element)
		placeAtChildBoundary(element, rawPosition === position.end ? 'end' : 'start')
	}
}