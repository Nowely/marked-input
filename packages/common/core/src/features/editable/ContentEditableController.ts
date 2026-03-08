import type {Store} from '../store/Store'

export class ContentEditableController {
	#unsubscribe?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#unsubscribe) return

		this.#unsubscribe = this.store.state.readOnly.on(() => this.sync())
		this.sync()
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
		const isBlock = !!this.store.state.block.get()

		// In non-block mode, even-indexed children are text spans (odd are marks).
		// In block mode, all children are DraggableBlock divs and need contentEditable.
		const step = isBlock ? 1 : 2
		for (let i = 0; i < children.length; i += step) {
			;(children[i] as HTMLElement).contentEditable = value
		}
	}
}