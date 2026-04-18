import type {Store} from '../../store'

export class MarkputHandler {
	constructor(private readonly store: Store) {}

	get container() {
		return this.store.state.container()
	}

	get overlay() {
		return this.store.state.overlay()
	}

	focus() {
		this.store.nodes.focus.head?.focus()
	}
}