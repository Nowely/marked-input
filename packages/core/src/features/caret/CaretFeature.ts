import type {CaretLocation, CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'

// CaretRecovery import: bridge, removed in Task 11
export class CaretFeature {
	readonly range = signal<RawRange | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	readonly recovery = signal<CaretRecovery | undefined>(undefined) // bridge; removed in Task 11
	readonly location = signal<CaretLocation | undefined>(undefined) // replaced with Computed in Task 3
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)
}