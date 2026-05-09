import {nodeTarget} from '../../shared/checkers'
import type {Range} from '../../shared/editorContracts'
import {computed, effect, listen, signal, watch} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {DomController} from '../dom/DomController'
import type {Lifecycle} from '../lifecycle/Lifecycle'

export class CaretModel {
	readonly range = signal<Range>(undefined, {equals: shallow})
	readonly position = computed({
		get: () => this.range()?.start,
		set: value => this.range(value !== undefined ? {start: value, end: value} : undefined),
	})

	// isUserSelecting flags the period between the user starting and finishing
	// a selection (mouse drag, keyboard Shift+Arrow, etc.). It is used to freeze
	// structural text surfaces (contenteditable=false) while selecting.
	readonly isUserSelecting = signal<boolean>(false)

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly dom: DomController
	) {
		lifecycle.onMounted(() => {
			this.#enableFocusTracking()
			this.#enableSelectionTracking()
			watch(dom.indexed, () => {
				dom.reconcile({isUserSelecting: this.isUserSelecting()})
				this.#applyRangeToDOM()
			})
			effect(() => {
				const isUserSelecting = this.isUserSelecting()
				dom.readOnly()
				dom.reconcile({isUserSelecting})
			})
		})
	}

	isFullSelection(): boolean {
		const sel = window.getSelection()
		const container = this.dom.container()
		if (!sel?.rangeCount || !container?.firstChild || !container.lastChild) return false
		const range = sel.getRangeAt(0)
		if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return false
		const selected = range.toString()
		return selected.length > 0 && selected === container.textContent
	}

	selectAll(): void {
		const container = this.dom.container()
		if (!container?.firstChild || !container.lastChild) return
		window.getSelection()?.setBaseAndExtent(container.firstChild, 0, container.lastChild, 1)
		const rawSel = this.dom.readRawSelection()
		if (rawSel.ok) this.range(rawSel.value.range)
	}

	#enableFocusTracking(): void {
		const container = this.dom.container()
		if (!container) return

		listen(container, 'focusin', e => {
			const target = e.target instanceof HTMLElement ? e.target : undefined
			if (!target) {
				this.range(undefined)
				return
			}
			const result = this.dom.locateNode(target)
			if (!result.ok) {
				if (result.reason === 'control') return
				this.range(undefined)
				return
			}
			const rawSel = this.dom.readRawSelection()
			if (rawSel.ok) this.range(rawSel.value.range)
		})

		listen(container, 'focusout', () => {
			queueMicrotask(() => {
				if (!container.contains(document.activeElement)) {
					this.range(undefined)
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
				this.range(undefined)
				return
			}
			const rawSel = this.dom.readRawSelection()
			if (rawSel.ok) this.range(rawSel.value.range)
			else this.range(undefined)
		})
	}

	#applyRangeToDOM(): void {
		if (this.isUserSelecting()) return
		const range = this.range()
		if (range === undefined) return

		if (range.start === range.end) {
			const result = this.dom.placeAt(range.start)
			if (!result.ok) {
				this.range(undefined)
				return
			}
			const applied = result.value.applied
			if (applied !== range.start) this.range({start: applied, end: applied})
			return
		}

		const result = this.dom.placeRange(range)
		if (!result.ok) {
			this.range(undefined)
			return
		}
		this.range(result.value.applied)
	}
}