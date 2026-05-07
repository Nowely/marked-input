import type {CaretLocation, RawRange} from '../../shared/editorContracts'
import {computed, signal} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import type {ParsingFeature} from '../parsing/ParseFeature'
import {deriveLocation} from './deriveLocation'

export class CaretFeature {
	readonly range = signal<RawRange | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	readonly location: Computed<CaretLocation | undefined>
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	#parsing: ParsingFeature | undefined

	constructor() {
		this.location = computed(() => {
			const p = this.#parsing
			if (!p) return undefined
			return deriveLocation(this.range(), p.tokens(), p.index())
		})
	}

	wire(parsing: ParsingFeature): void {
		this.#parsing = parsing
	}
}