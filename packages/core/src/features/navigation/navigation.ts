import type {Store} from '../../store'
import {Caret} from '../caret'

export function shiftFocusPrev(store: Store, event: KeyboardEvent): boolean {
	const {focus} = store.nodes
	if ((focus.isMark && !focus.isEditable) || focus.isCaretAtBeginning) {
		// Walk back to the nearest focusable element (skip non-editable marks)
		let prev = focus.prev
		while (prev.target && prev.isMark && !prev.isEditable) {
			prev = prev.prev
		}
		if (!prev.target) return false

		event.preventDefault()
		prev.target.focus()
		// After focusin fires, store.nodes.focus.target is updated to prev.target.
		// Set caret at the end of the newly focused element.
		Caret.setCaretToEnd(prev.target)
		return true
	}
	return false
}

export function shiftFocusNext(store: Store, event: KeyboardEvent): boolean {
	const {focus} = store.nodes
	if ((focus.isMark && !focus.isEditable) || focus.isCaretAtEnd) {
		// Walk forward to the nearest focusable element (skip non-editable marks)
		let next = focus.next
		while (next.target && next.isMark && !next.isEditable) {
			next = next.next
		}
		if (!next.target) return false

		event.preventDefault()
		next.target.focus()
		// Set caret at the beginning of the newly focused element
		Caret.trySetIndex(next.target, 0)
		return true
	}
	return false
}