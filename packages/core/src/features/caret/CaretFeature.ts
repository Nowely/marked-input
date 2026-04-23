import {signal} from '../../shared/signals'
import type {Feature, Recovery} from '../../shared/types'
import type {Store} from '../../store/Store'
import {enableFocus} from './focus'
import {enableSelection} from './selection'

export class CaretFeature implements Feature {
	readonly recovery = signal<Recovery | undefined>(undefined)
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
}