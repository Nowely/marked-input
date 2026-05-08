import {nodeTarget} from '../../shared/checkers'
import type {RawRange} from '../../shared/editorContracts'
import {computed, effect, listen, signal, watch} from '../../shared/signals'
import type {DomController} from '../dom/DomController'
import type {Lifecycle} from '../lifecycle/Lifecycle'

export class CaretModel {
	readonly range = signal<{readonly start: number; readonly end: number} | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	readonly isCollapsed = computed(() => {
		const r = this.range()
		return !!r && r.start === r.end
	})

	readonly position = computed<number | undefined>(() => (this.isCollapsed() ? this.range()?.start : undefined))

	readonly selection = computed<RawRange | undefined>(() => (this.isCollapsed() ? undefined : this.range()))

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly dom: DomController
	) {
		lifecycle.onMounted(() => {
			this.#enableFocusTracking()
			this.#enableSelectionTracking()
			watch(dom.indexed, () => {
				dom.reconcile({selecting: this.selecting() === 'drag'})
				this.#applyRangeToDOM()
			})
			effect(() => {
				const isDrag = this.selecting() === 'drag'
				dom.readOnly()
				dom.reconcile({selecting: isDrag})
			})
			effect(() => () => {
				if (this.selecting() === 'drag') this.selecting(undefined)
			})
		})
	}

	setAt(pos: number): void {
		this.range({start: pos, end: pos})
	}

	select(r: RawRange): void {
		this.range(r)
	}

	collapse(side: 'start' | 'end'): void {
		const r = this.range()
		if (!r) return
		const at = r[side]
		this.range({start: at, end: at})
	}

	isFullSelection(): boolean {
		const sel = window.getSelection()
		const container = this.dom.container()
		if (!sel?.rangeCount || !container?.firstChild || !container.lastChild) return false
		try {
			const range = sel.getRangeAt(0)
			return (
				container.contains(range.startContainer) &&
				container.contains(range.endContainer) &&
				range.toString().length > 0
			)
		} catch {
			return false
		}
	}

	selectAll(): void {
		const container = this.dom.container()
		if (!container?.firstChild || !container.lastChild) return
		window.getSelection()?.setBaseAndExtent(container.firstChild, 0, container.lastChild, 1)
		this.selecting('all')
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
				this.selecting('drag')
			}
		})

		listen(document, 'mouseup', () => {
			isPressed = false
			pressedNode = null
			if (this.selecting() === 'drag') {
				const sel = window.getSelection()
				if (!sel || sel.isCollapsed) this.selecting(undefined)
			}
		})

		listen(document, 'selectionchange', () => {
			const sel = window.getSelection()
			if (this.selecting() === 'drag' && (!sel || sel.isCollapsed)) {
				this.selecting(undefined)
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
		if (this.selecting() === 'drag') return
		const range = this.range()
		if (range === undefined) return

		if (range.start === range.end) {
			const result = this.dom.placeAt(range.start)
			if (!result.ok) {
				this.range(undefined)
				return
			}
			if (result.value.applied !== range.start) this.setAt(result.value.applied)
			return
		}

		const result = this.dom.placeRange(range)
		if (!result.ok) {
			this.range(undefined)
			return
		}
		if (result.value.applied.start !== range.start || result.value.applied.end !== range.end) {
			this.select(result.value.applied)
		}
	}
}