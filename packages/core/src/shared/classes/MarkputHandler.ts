import type {Store} from '../../store'

export class MarkputHandler {
	constructor(private readonly store: Store) {}

	get container() {
		return this.store.slots.container()
	}

	get overlay() {
		return this.store.overlay.element()
	}

	focus() {
		const firstAddress = this.store.parsing.index().addressFor([0])
		if (firstAddress && this.store.dom.focusAddress(firstAddress).ok) return
		this.container?.focus()
	}
}