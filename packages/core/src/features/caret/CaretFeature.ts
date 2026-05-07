import type {CaretLocation, CaretRecovery} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'

export class CaretFeature {
	readonly recovery = signal<CaretRecovery | undefined>(undefined)
	readonly location = signal<CaretLocation | undefined>(undefined)
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)
}