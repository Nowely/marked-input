import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, TokenAddress} from '../../shared/editorContracts'
import {computed, listen, signal, watch} from '../../shared/signals'
import type {Signal} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomModel} from '../dom/DomModel'
import type {ParseController} from '../parsing/ParseController'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {focusIfNeeded, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caretDom'

export class CaretModel {
	readonly selection = signal<Range>(undefined, {equals: shallow})
	readonly position = computed({
		get: () => this.selection()?.start,
		set: value => this.selection(value !== undefined ? {start: value, end: value} : undefined),
	})

	/**
	 * True while the user drag-selects across token boundaries. Owned by
	 * `DomModel` because its only consequence is freezing
	 * `contenteditable="false"` on structural text surfaces. Re-exported here
	 * for API compatibility — readers and writers both go through the same
	 * underlying signal.
	 */
	readonly isUserSelecting: Signal<boolean>

	readonly isAllSelected = computed(() => {
		const s = this.selection()
		const v = this.value.current()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	#preferredAddress: TokenAddress | undefined
	#isPlacingCaret = false

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly dom: DomModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {
		this.isUserSelecting = dom.isUserSelecting

		lifecycle.onMounted(() => {
			this.#focusEmptyEditorOnClick()

			this.#trackSelection()
			watch(this.selection, () => this.#applyRangeToDOM())

			this.#trackUserSelecting()
			watch(dom.indexed, () => this.#applyRangeToDOM())
		})
	}

	focusFirst(): void {
		const firstAddress = this.parsing.index().addressFor([0])
		if (firstAddress && this.placeAtAddress(firstAddress, 'start')) return
		this.dom.container()?.focus()
	}

	selectAll(): void {
		this.selection({start: 0, end: this.value.current().length})
	}

	/**
	 * Place the caret at a known token address. Use this when the caller already
	 * has a {@link TokenAddress} and needs to disambiguate which token owns a
	 * shared boundary position (e.g. a text-token ending at N and a mark-token
	 * starting at N both "own" position N). Position-only callers should write
	 * to `selection` instead — the auto-apply effect handles the common case.
	 *
	 * Returns `true` when the address could be resolved and focused, `false`
	 * when the DOM is not yet indexed or the address is stale.
	 */
	placeAtAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		if (this.dom.index() === undefined) return false
		if (!this.dom.pathElementsFor(address)) return false
		const resolved = this.parsing.index().resolveAddress(address)
		if (!resolved.ok) return false

		const pos = boundary === 'end' ? resolved.value.position.end : resolved.value.position.start
		this.#preferredAddress = address
		// When pos equals the prior selection (shared text/mark boundary), the
		// signal's shallow-equals check suppresses the watch effect, leaving
		// #preferredAddress unconsumed. Apply it directly in that case.
		if (!this.selection({start: pos, end: pos})) this.#applyRangeToDOM()
		return true
	}

	/**
	 * When the value is a single empty text token (an empty editor), a click
	 * anywhere in the container should focus the first child — otherwise the
	 * browser leaves the editor unfocused because there's no text to click on.
	 */
	#focusEmptyEditorOnClick(): void {
		const container = this.dom.container()
		if (!container) return
		listen(container, 'click', () => {
			const tokens = this.parsing.tokens()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				firstHtmlChild(this.dom.container())?.focus()
			}
		})
	}

	#trackUserSelecting(): void {
		let pressedAt: Node | null = null

		listen(document, 'mousedown', e => {
			pressedAt = nodeTarget(e)
		})

		listen(document, 'mousemove', e => {
			if (pressedAt === null) return
			const container = this.dom.container()
			if (!container) return

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

	#trackSelection(): void {
		const container = this.dom.container()
		if (!container) return

		const sync = (): void => {
			const rawSel = this.dom.readRawSelection()
			if (rawSel.ok) this.selection(rawSel.value.range)
			else this.selection(undefined)
		}

		const syncIfInEditor = (node: Node): void => {
			const result = this.dom.locateNode(node)
			if (!result.ok) {
				if (result.reason === 'control') return
				this.selection(undefined)
				return
			}
			sync()
		}

		listen(container, 'focusin', e => {
			if (this.#isPlacingCaret) return
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.selection(undefined)
				return
			}
			syncIfInEditor(target)
		})

		listen(container, 'focusout', () => {
			// `focusout` fires before `document.activeElement` updates to the new
			// target; defer one microtask so we can tell whether focus moved
			// outside the editor.
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) {
					this.selection(undefined)
				}
			})
		})

		listen(document, 'selectionchange', () => {
			if (this.#isPlacingCaret) return
			const sel = window.getSelection()
			if (!sel?.focusNode) return
			syncIfInEditor(sel.focusNode)
		})
	}

	#applyRangeToDOM(): void {
		if (this.isUserSelecting()) return
		if (this.dom.index() === undefined) return
		const sel = this.selection()
		if (sel === undefined) return

		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(sel.start, maxPos),
			end: Math.min(sel.end, maxPos),
		}

		this.#isPlacingCaret = true
		const placed =
			clamped.start === clamped.end ? this.#placeCollapsed(clamped.start) : this.#placeExtended(clamped)
		this.#isPlacingCaret = false

		if (!placed) return
		if (clamped.start !== sel.start || clamped.end !== sel.end) this.selection(clamped)
	}

	/**
	 * Place a collapsed caret at `rawPosition`. Returns `false` when no DOM
	 * target was found in the current index — the caller should leave the
	 * selection signal alone so `watch(dom.indexed)` can retry after the
	 * next render.
	 */
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

	/**
	 * Place an extended selection range. Returns `false` when either endpoint
	 * has no DOM target in the current index.
	 */
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

		const elements = this.dom.pathElementsFor(address)
		if (!elements) return false
		const resolved = this.parsing.index().resolveAddress(address)
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
		const tokenIndex = this.parsing.index()

		for (const record of this.dom.pathElements()) {
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
		const containing = candidates.find(candidate => rawPosition >= candidate.start && rawPosition <= candidate.end)
		if (containing) return containing
		return candidates.find(candidate => candidate.start >= rawPosition)
	}

	#focusMarkBoundaryForRawPosition(rawPosition: number): boolean {
		const tokenIndex = this.parsing.index()

		for (const record of this.dom.pathElements()) {
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