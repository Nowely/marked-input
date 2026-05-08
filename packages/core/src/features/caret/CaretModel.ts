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

	readonly isSelecting = signal<boolean>(false)

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly dom: DomController
	) {
		lifecycle.onMounted(() => {
			this.#enableFocusTracking()
			this.#enableSelectionTracking()
			watch(dom.indexed, () => {
				dom.reconcile({isSelecting: this.isSelecting()})
				this.#applyRangeToDOM()
			})
			effect(() => {
				const isSelecting = this.isSelecting()
				dom.readOnly()
				dom.reconcile({isSelecting})
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
		let pressedNode: Node | null = null
		let isPressed = false

		listen(document, 'mousedown', e => {
			pressedNode = nodeTarget(e)
			isPressed = true
		})

		listen(document, 'mousemove', e => {
			const container = this.dom.container()
			if (!container) return
			const isNotInnerSome = !container.contains(pressedNode) || pressedNode !== e.target
			const isInside = window.getSelection()?.containsNode(container, true)
			if (isPressed && isNotInnerSome && isInside) {
				this.isSelecting(true)
			}
		})

		listen(document, 'mouseup', () => {
			isPressed = false
			pressedNode = null
			if (this.isSelecting()) {
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) this.isSelecting(false)
			}
		})

		listen(document, 'selectionchange', () => {
			const sel = window.getSelection()
			if (this.isSelecting() && (!sel || sel.isCollapsed)) {
				this.isSelecting(false)
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
		if (this.isSelecting()) return
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