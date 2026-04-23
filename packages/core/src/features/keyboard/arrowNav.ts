import {KEYBOARD} from '../../shared/constants'
import {effectScope, listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {selectAllText} from '../caret'
import {shiftFocusPrev, shiftFocusNext} from '../navigation'

export function enableArrowNav(store: Store): () => void {
	const container = store.slots.container()
	if (!container) return () => {}

	const scope = effectScope(() => {
		listen(container, 'keydown', e => {
			if (store.slots.isBlock()) return
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