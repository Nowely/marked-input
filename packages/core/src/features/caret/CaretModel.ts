import {firstHtmlChild, nodeTarget} from '../../shared/checkers'
import type {Range, TokenAddress} from '../../shared/editorContracts'
import {computed, effect, listen, signal, untracked, watch} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomModel} from '../dom/DomModel'
import {nextTextNode} from '../dom/textOffsets'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'

export class CaretModel {
	readonly selection = signal<Range>(undefined, {equals: shallow})
	readonly position = computed({
		get: () => this.selection()?.start,
		set: value => this.selection(value !== undefined ? {start: value, end: value} : undefined),
	})

	/**
	 * Whether the user is actively selecting text (mouse drag, keyboard
	 * Shift+Arrow, etc.). Drives {@link DomModel.reconcile} to freeze
	 * structural text surfaces (contenteditable=false) while selecting.
	 */
	readonly isUserSelecting = signal<boolean>(false)

	readonly isAllSelected = computed(() => {
		const s = this.selection()
		const v = this.value.current()
		return s?.start === 0 && s.end === v.length && v.length > 0
	})

	#suppressAutoApply = false

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly dom: DomModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel,
		private readonly props: PropsModel
	) {
		lifecycle.onMounted(() => {
			const container = dom.container()
			if (container) {
				listen(container, 'click', () => {
					const tokens = this.parsing.tokens()
					if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
						firstHtmlChild(dom.container())?.focus()
					}
				})
			}
			this.#enableFocusTracking()
			this.#enableSelectionTracking()
			watch(dom.indexed, () => {
				dom.reconcile({isUserSelecting: this.isUserSelecting()})
				this.#applyRangeToDOM()
			})
			effect(() => {
				const isUserSelecting = this.isUserSelecting()
				this.props.readOnly()
				dom.reconcile({isUserSelecting})
			})
			effect(() => {
				this.selection()
				untracked(() => this.#applyRangeToDOM())
			})
		})
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
	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		if (this.dom.index() === undefined) return false
		const elements = this.dom.pathElementsFor(address)
		if (!elements) return false
		const resolved = this.parsing.index().resolveAddress(address)
		if (!resolved.ok) return false

		const pos = boundary === 'end' ? resolved.value.position.end : resolved.value.position.start

		this.#suppressAutoApply = true
		try {
			if (resolved.value.type === 'mark') {
				if (document.activeElement !== elements.tokenElement) elements.tokenElement.focus()
				this.#placeCollapsedBoundary(
					elements.tokenElement,
					boundary === 'end' ? elements.tokenElement.childNodes.length : 0
				)
			} else {
				const target = elements.textElement ?? elements.tokenElement
				if (document.activeElement !== target) target.focus()
				if (elements.textElement) {
					this.#placeCaretInTextSurface(elements.textElement, pos - resolved.value.position.start)
				}
			}
			this.selection({start: pos, end: pos})
		} finally {
			this.#suppressAutoApply = false
		}
		return true
	}

	#enableFocusTracking(): void {
		const container = this.dom.container()
		if (!container) return

		listen(container, 'focusin', e => {
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.selection(undefined)
				return
			}
			const result = this.dom.locateNode(target)
			if (!result.ok) {
				if (result.reason === 'control') return
				this.selection(undefined)
				return
			}
			const rawSel = this.dom.readRawSelection()
			if (rawSel.ok) this.selection(rawSel.value.range)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) {
					this.selection(undefined)
				}
			})
		})
	}

	#enableSelectionTracking(): void {
		// Track whether a mouse button is currently pressed and which node it
		// started on. The pressed-node identity lets us tell "drag stayed on
		// the original element" (no selection yet) from "drag is sweeping
		// across nodes" (real selection in progress).
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

		listen(document, 'mouseup', () => {
			pressedAt = null
			if (!this.isUserSelecting()) return
			const sel = window.getSelection()
			if (!sel || sel.isCollapsed) this.isUserSelecting(false)
		})

		listen(document, 'selectionchange', () => {
			const sel = window.getSelection()
			if (this.isUserSelecting() && (!sel || sel.isCollapsed)) {
				this.isUserSelecting(false)
			}
			if (!sel?.focusNode) return
			const result = this.dom.locateNode(sel.focusNode)
			if (!result.ok) {
				if (result.reason === 'control') return
				this.selection(undefined)
				return
			}
			const rawSel = this.dom.readRawSelection()
			if (rawSel.ok) this.selection(rawSel.value.range)
			else this.selection(undefined)
		})
	}

	#applyRangeToDOM(): void {
		if (this.#suppressAutoApply) return
		if (this.isUserSelecting()) return
		if (this.dom.index() === undefined) return
		const sel = this.selection()
		if (sel === undefined) return

		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(sel.start, maxPos),
			end: Math.min(sel.end, maxPos),
		}

		if (clamped.start === clamped.end) {
			const target = this.#findTextTargetForRawPosition(clamped.start)
			if (target) {
				if (document.activeElement !== target.element) target.element.focus()
				this.#placeCaretInTextSurface(target.element, clamped.start - target.start)
			} else if (!this.#focusMarkBoundaryForRawPosition(clamped.start)) {
				// Placement target not found in the current DOM index. Likely the
				// DOM hasn't caught up with a fresh parser generation; leave the
				// selection signal alone and let `watch(dom.indexed)` retry on
				// the next render.
				return
			}
			if (clamped.start !== sel.start || clamped.end !== sel.end) this.selection(clamped)
			return
		}

		const startTarget = this.#findTextTargetForRawPosition(clamped.start)
		const endTarget = this.#findTextTargetForRawPosition(clamped.end)
		const browserSelection = window.getSelection()
		if (!startTarget || !endTarget || !browserSelection) return

		const startBoundary = this.#boundaryInTextSurface(startTarget.element, clamped.start - startTarget.start)
		const endBoundary = this.#boundaryInTextSurface(endTarget.element, clamped.end - endTarget.start)
		if (!startBoundary || !endBoundary) return

		const range = document.createRange()
		range.setStart(startBoundary.node, startBoundary.offset)
		range.setEnd(endBoundary.node, endBoundary.offset)
		browserSelection.removeAllRanges()
		browserSelection.addRange(range)

		if (clamped.start !== sel.start || clamped.end !== sel.end) this.selection(clamped)
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

			const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
			if (document.activeElement !== record.tokenElement) record.tokenElement.focus()
			this.#placeCollapsedBoundary(
				record.tokenElement,
				boundary === 'end' ? record.tokenElement.childNodes.length : 0
			)
			return true
		}

		return false
	}

	#placeCaretInTextSurface(surface: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const boundary = this.#boundaryInTextSurface(surface, offset)
		if (!boundary) return
		const range = document.createRange()
		range.setStart(boundary.node, boundary.offset)
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#placeCollapsedBoundary(element: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const range = document.createRange()
		range.setStart(element, Math.min(Math.max(offset, 0), element.childNodes.length))
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#boundaryInTextSurface(surface: HTMLElement, offset: number): {node: Text; offset: number} | undefined {
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		let node = nextTextNode(walker)
		while (node) {
			if (remaining <= node.length) return {node, offset: remaining}
			remaining -= node.length
			node = nextTextNode(walker)
		}

		const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
		if (!text.parentNode) surface.append(text)
		return {node: text, offset: text.length}
	}
}