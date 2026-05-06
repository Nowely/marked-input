import type {CaretLocation, CaretRecovery, Result, TokenAddress} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature {
	readonly recovery = signal<CaretRecovery | undefined>(undefined)
	readonly location = signal<CaretLocation | undefined>(undefined)
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			enableFocus(_store)
			enableSelection(_store)
		})
	}

	placeAt(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<void, 'notIndexed' | 'invalidBoundary'> {
		return this._store.dom.placeCaretAtRawPosition(rawPosition, affinity)
	}

	focus(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		return this._store.dom.focusAddress(address, boundary)
	}
}