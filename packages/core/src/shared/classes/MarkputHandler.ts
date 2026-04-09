import type {Store} from '../../features/store'

export class MarkputHandler {
	constructor(private store: Store) {}

	get container() {
		return this.store.refs.container
	}

	get overlay() {
		return this.store.refs.overlay
	}

	focus() {
		this.store.nodes.focus.head?.focus()
	}
}