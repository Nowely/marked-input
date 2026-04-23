import type {Store} from '../../store'

export class MarkputHandler {
	constructor(private readonly store: Store) {}

	get container() {
		return this.store.feature.slots.state.container()
	}

	get overlay() {
		return this.store.feature.overlay.state.overlay()
	}

	focus() {
		this.store.nodes.focus.head?.focus()
	}
}