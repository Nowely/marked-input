import {KEYBOARD} from '../../shared/constants'
import {SystemEvent} from '../events'
import type {Store} from '../store/Store'

export class CloseOverlayController {
	#escHandler?: (e: KeyboardEvent) => void
	#clickHandler?: (e: MouseEvent) => void

	constructor(private store: Store) {}

	enable() {
		if (this.#escHandler) return

		this.#escHandler = e => {
			if (e.key === KEYBOARD.ESC) {
				this.store.bus.send(SystemEvent.ClearTrigger)
			}
		}

		this.#clickHandler = e => {
			const target = e.target as HTMLElement | null
			if (this.store.refs.overlay?.contains(target)) return
			if (this.store.refs.container?.contains(target)) return
			this.store.bus.send(SystemEvent.ClearTrigger)
		}

		window.addEventListener('keydown', this.#escHandler)
		document.addEventListener('click', this.#clickHandler, true)
	}

	disable() {
		if (!this.#escHandler || !this.#clickHandler) return

		window.removeEventListener('keydown', this.#escHandler)
		document.removeEventListener('click', this.#clickHandler, true)

		this.#escHandler = undefined
		this.#clickHandler = undefined
	}
}
