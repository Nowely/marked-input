import type {Store} from '../store/Store'

export class FocusController {
	#focusinHandler?: (e: FocusEvent) => void
	#focusoutHandler?: () => void
	#clickHandler?: () => void

	constructor(private store: Store) {}

	enable() {
		if (this.#focusinHandler) return

		const container = this.store.refs.container
		if (!container) return

		this.#focusinHandler = e => {
			this.store.nodes.focus.target = e.target as HTMLElement
		}

		this.#focusoutHandler = () => {
			this.store.nodes.focus.target = undefined
		}

		this.#clickHandler = () => {
			const tokens = this.store.state.tokens.get()
			if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
				const element = this.store.refs.container?.firstElementChild as HTMLElement | undefined
				element?.focus()
			}
		}

		container.addEventListener('focusin', this.#focusinHandler)
		container.addEventListener('focusout', this.#focusoutHandler)
		container.addEventListener('click', this.#clickHandler)
	}

	disable() {
		const container = this.store.refs.container
		if (!container || !this.#focusinHandler) return

		container.removeEventListener('focusin', this.#focusinHandler)
		container.removeEventListener('focusout', this.#focusoutHandler!)
		container.removeEventListener('click', this.#clickHandler!)

		this.#focusinHandler = undefined
		this.#focusoutHandler = undefined
		this.#clickHandler = undefined
	}

	recover() {
		const recovery = this.store.state.recovery.get()
		if (!recovery) return

		const {anchor, caret, isNext} = recovery

		switch (true) {
			case isNext && !anchor.target:
				this.store.nodes.focus.tail.focus()
				break
			case isNext:
				anchor.prev.focus()
				break
			case !anchor.target:
				this.store.nodes.focus.head.focus()
				break
			default:
				anchor.next.focus()
		}

		this.store.nodes.focus.caret = caret
		this.store.state.recovery.set(undefined)
	}
}
