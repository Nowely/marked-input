import {KEYBOARD} from '../../shared/constants'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {shiftFocusPrev, shiftFocusNext} from '../navigation'
import {selectAllText} from '../selection'

export class ArrowNavFeature {
	#scope?: () => void

	constructor(private readonly store: Store) {}

	enable() {
		if (this.#scope) return

		const container = this.store.refs.container
		if (!container) return

		this.#scope = effectScope(() => {
			listen(container, 'keydown', e => {
				if (this.store.computed.isBlock()) return
				if (!this.store.nodes.focus.target) return

				if (e.key === KEYBOARD.LEFT) {
					shiftFocusPrev(this.store, e)
				} else if (e.key === KEYBOARD.RIGHT) {
					shiftFocusNext(this.store, e)
				}

				selectAllText(this.store, e)
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}