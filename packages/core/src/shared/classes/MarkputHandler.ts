import type {Store} from '../../store'

export class MarkputHandler {
	constructor(private readonly store: Store) {}

	get container() {
		return this.store.slots.container()
	}

	get overlay() {
		return this.store.overlay.overlay()
	}

	focus() {
		this.store.nodes.focus.head?.focus()
	}
}