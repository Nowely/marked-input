import type {Store} from '../store'

export function shiftFocusPrev(store: Store, event: KeyboardEvent): boolean {
	const {focus} = store.nodes
	if ((focus.isMark && !focus.isEditable) || focus.isCaretAtBeginning) {
		const prev = focus.prev
		prev.focus()
		if (!prev.isFocused) {
			prev.prev.focus()
			event.preventDefault()
		}
		focus.setCaretToEnd()
		return true
	}
	return false
}

export function shiftFocusNext(store: Store, event: KeyboardEvent): boolean {
	const {focus} = store.nodes
	if ((focus.isMark && !focus.isEditable) || focus.isCaretAtEnd) {
		const next = focus.next
		next.focus()
		if (!next.isFocused) {
			next.next.focus()
			event.preventDefault()
		}
		return true
	}
	return false
}