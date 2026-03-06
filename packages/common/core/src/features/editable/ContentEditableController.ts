import type {Store} from '../store/Store'

export class ContentEditableController {
	#unsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#unsubscribe) return

		this.sync()
		this.#unsubscribe = this.store.state.readOnly.on(() => this.sync())
	}

	disable() {
		this.#unsubscribe?.()
		this.#unsubscribe = undefined
	}

	sync() {
		const container = this.store.refs.container
		if (!container) return

		const readOnly = this.store.state.readOnly.get()
		const value = readOnly ? 'false' : 'true'
		const children = container.children

		for (let i = 0; i < children.length; i += 2) {
			;(children[i] as HTMLElement).contentEditable = value
		}
	}
}