import {KEYBOARD} from '../../shared/constants'
import {shiftFocusPrev, shiftFocusNext} from '../navigation'
import {selectAllText} from '../selection'
import type {Store} from '../store/Store'

export class ArrowNavFeature {
	#keydownHandler?: (e: KeyboardEvent) => void

	constructor(private store: Store) {}

	enable() {
		if (this.#keydownHandler) return

		const container = this.store.refs.container
		if (!container) return

		this.#keydownHandler = e => {
			if (this.store.state.drag.get()) return
			if (!this.store.nodes.focus.target) return

			if (e.key === KEYBOARD.LEFT) {
				shiftFocusPrev(this.store, e)
			} else if (e.key === KEYBOARD.RIGHT) {
				shiftFocusNext(this.store, e)
			}

			selectAllText(this.store, e)
		}

		container.addEventListener('keydown', this.#keydownHandler)
	}

	disable() {
		const container = this.store.refs.container
		if (!container || !this.#keydownHandler) return

		container.removeEventListener('keydown', this.#keydownHandler)
		this.#keydownHandler = undefined
	}
}