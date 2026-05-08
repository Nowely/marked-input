import type {RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'

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

	startDragSelect(): void {
		if (this.selecting() !== 'drag') this.selecting('drag')
	}
	clearDragSelect(): void {
		if (this.selecting() === 'drag') this.selecting(undefined)
	}
	startAllSelect(): void {
		this.selecting('all')
	}
	clearAllSelect(): void {
		if (this.selecting() === 'all') this.selecting(undefined)
	}
	endSelecting(): void {
		this.selecting(undefined)
	}
}