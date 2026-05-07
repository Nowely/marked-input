import type {CaretLocation, CaretRecovery, RawRange} from '../../shared/editorContracts'
import {effect, signal, untracked} from '../../shared/signals'
import type {Signal} from '../../shared/signals'
import type {ParsingFeature} from '../parsing/ParseFeature'
import {deriveLocation} from './deriveLocation'

// CaretRecovery import: bridge, removed in Task 11
export class CaretFeature {
	readonly range = signal<RawRange | undefined>(undefined, {
		equals: (a, b) => a === b || (a !== undefined && a.start === b?.start && a.end === b.end),
	})

	// During the bridge phase (Tasks 3–10) `location` is a writable signal that
	// is also kept in sync with `range + tokens` via an effect. Imperative
	// callers that still write `location(...)` (focus.ts, selection.ts, DomFeature)
	// stay correct. In Task 11 this becomes a true read-only Computed and all
	// write sites are deleted.
	readonly location: Signal<CaretLocation | undefined> = signal<CaretLocation | undefined>(undefined)

	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	readonly recovery = signal<CaretRecovery | undefined>(undefined) // bridge; removed in Task 11

	// wire() exists because CaretFeature is instantiated before ParsingFeature in
	// Store. All field initializers complete before the Store constructor body
	// runs, so by the time wire() is called, both features are fully initialized.
	wire(parsing: ParsingFeature): void {
		effect(() => {
			const r = this.range()
			const tokens = parsing.tokens()
			const index = parsing.index()
			untracked(() => this.location(deriveLocation(r, tokens, index)))
		})
	}
}