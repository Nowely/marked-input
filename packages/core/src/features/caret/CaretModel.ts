import type {CaretLocation, RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {ParseController} from '../parsing/ParseController'
import {deriveLocation} from './deriveLocation'

export class CaretModel {
	readonly range = signal<RawRange | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	readonly location: Computed<CaretLocation | undefined>
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

	#parsing: ParseController | undefined

	constructor() {
		this.location = computed(() => {
			const p = this.#parsing
			if (!p) return undefined
			return deriveLocation(this.range(), p.tokens(), p.index())
		})
	}

	wire(parsing: ParseController): void {
		this.#parsing = parsing
	}
}