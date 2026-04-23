import type {Store} from '../../store/Store'

export class SystemListenerFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}