import {signal} from '../../shared/signals'

export class CaretModel {
	readonly range = signal<{readonly start: number; readonly end: number} | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

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