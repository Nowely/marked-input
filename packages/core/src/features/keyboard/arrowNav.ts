import {KEYBOARD} from '../../shared/constants'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {shiftFocusPrev, shiftFocusNext} from '../navigation'
import {selectAllText} from '../selection'

export function enableArrowNav(store: Store): () => void {
	const container = store.state.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'keydown', e => {
			if (store.computed.isBlock()) return
			if (!store.nodes.focus.target) return

			if (e.key === KEYBOARD.LEFT) {
				shiftFocusPrev(store, e)
			} else if (e.key === KEYBOARD.RIGHT) {
				shiftFocusNext(store, e)
			}

			selectAllText(store, e)
		})
	})

	return () => scope()
}