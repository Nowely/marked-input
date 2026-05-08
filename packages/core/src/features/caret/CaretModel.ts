import type {RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'
import type {DomController} from '../dom/DomController'

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

	#dom?: DomController

	/** Called by DomController in Phase 2 constructor; temporary bridge until full wiring. */
	_bindDom(dom: DomController): void {
		this.#dom = dom
	}

	isFullSelection(): boolean {
		const sel = window.getSelection()
		const container = this.#dom?.container()
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
		const container = this.#dom?.container()
		if (!container?.firstChild || !container.lastChild) return
		window.getSelection()?.setBaseAndExtent(container.firstChild, 0, container.lastChild, 1)
		this.selecting('all')
		const rawSel = this.#dom?.readRawSelection()
		if (rawSel?.ok) this.range(rawSel.value.range)
	}
}