import type {CaretLocation, CaretRecovery, Result, TokenAddress} from '../../shared/editorContracts'
import {signal} from '../../shared/signals'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature implements Feature {
	readonly recovery = signal<CaretRecovery | undefined>(undefined)
	readonly location = signal<CaretLocation | undefined>(undefined)
	readonly selecting = signal<'drag' | 'all' | undefined>(undefined)

	#disposers: Array<() => void> = []

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#disposers.length) return
		this.#disposers = [enableFocus(this._store), enableSelection(this._store)]
	}

	disable() {
		this.#disposers.forEach(d => d())
		this.#disposers = []
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