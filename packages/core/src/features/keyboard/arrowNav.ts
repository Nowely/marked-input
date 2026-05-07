import {KEYBOARD} from '../../shared/constants'
import {listen} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {selectAllText} from '../caret'

type KbCtx = Pick<Store, 'dom' | 'caret' | 'slots' | 'parsing'>

export function enableArrowNav(store: KbCtx): void {
	const container = store.dom.container()
	if (!container) return

	listen(container, 'keydown', e => {
		if (store.slots.isBlock()) return

		if (e.key === KEYBOARD.LEFT) {
			shiftFocus(store, e, 'prev')
		} else if (e.key === KEYBOARD.RIGHT) {
			shiftFocus(store, e, 'next')
		}

		selectAllText(store, e)
	})
}

function shiftFocus(store: KbCtx, event: KeyboardEvent, direction: 'prev' | 'next'): boolean {
	const location = store.caret.location()
	if (!location) return false

	const token = store.parsing.index().resolveAddress(location.address)
	if (!token.ok) return false

	const focusedMark = token.value.type === 'mark' && location.role !== 'text'
	if (!focusedMark) {
		const selection = store.dom.readRawSelection()
		if (!selection.ok || selection.value.range.start !== selection.value.range.end) return false

		const atStart = selection.value.range.start <= token.value.position.start
		const atEnd = selection.value.range.end >= token.value.position.end
		if (direction === 'prev' && !atStart) return false
		if (direction === 'next' && !atEnd) return false
	}

	const path = location.address.path
	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const siblingAddress = store.parsing.index().addressFor(siblingPath)
	if (!siblingAddress) return false

	event.preventDefault()
	const result = store.dom.focusAddress(siblingAddress, direction === 'prev' ? 'end' : 'start')
	if (!result.ok) return false
	const sibling = store.parsing.index().resolve(siblingPath)
	if (sibling?.type === 'mark') return true

	if (direction === 'prev') {
		store.dom.placeCaretAtRawPosition(sibling?.position.end ?? 0, 'before')
		return true
	}
	store.dom.placeCaretAtRawPosition(sibling?.position.start ?? 0, 'after')
	return true
}