import {
	deleteMark,
	handleBeforeInput,
	handlePaste,
	KEYBOARD,
	selectAllText,
	shiftFocusPrev,
	shiftFocusNext,
} from '@markput/core'
import {useEffect} from 'react'
import {useDownOf} from '../../lib/hooks/useDownOf'
import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

//TODO Focus on mark and attribute for this
//TODO different rules for editable
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, event => shiftFocusPrev(store, event))
	useDownOf(KEYBOARD.RIGHT, event => shiftFocusNext(store, event))

	useDownOf(KEYBOARD.DELETE, deleteSelfMark)
	useDownOf(KEYBOARD.BACKSPACE, deleteSelfMark)

	useDownOf(KEYBOARD.DELETE, deleteNextMark)
	useDownOf(KEYBOARD.BACKSPACE, deletePrevMark)

	useListener('keydown', event => selectAllText(store, event), [])
	useListener('paste', event => handlePaste(store, event), [])

	// beforeinput doesn't bubble, so we use capture phase on the container
	useEffect(() => {
		const container = store.refs.container
		if (!container) return

		const listener = (event: Event) => {
			handleBeforeInput(store, event as InputEvent)
		}

		container.addEventListener('beforeinput', listener, true)
		return () => container.removeEventListener('beforeinput', listener, true)
	}, [])

	function deleteSelfMark() {
		if (store.nodes.focus.isMark) deleteMark('self', store)
	}

	function deletePrevMark(event: KeyboardEvent) {
		if (store.nodes.focus.isSpan && store.nodes.focus.isCaretAtBeginning && store.nodes.focus.prev.target) {
			event.preventDefault()
			deleteMark('prev', store)
		}
	}

	//TODO pass focus
	//TODO on && !store.nodes.focus.next.isEditable remove first symbol
	function deleteNextMark(event: KeyboardEvent) {
		if (store.nodes.focus.isSpan && store.nodes.focus.isCaretAtEnd && store.nodes.focus.next.target) {
			event.preventDefault()
			deleteMark('next', store)
		}
	}
}
