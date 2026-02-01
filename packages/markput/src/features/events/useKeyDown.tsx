import {deleteMark, KEYBOARD} from '@markput/core'
import {useDownOf} from '../../lib/hooks/useDownOf'
import {useListener} from '../../lib/hooks/useListener'
import {useStore} from '../../lib/hooks/useStore'

//TODO Focus on mark and attribute for this
//TODO different rules for editable
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, shiftFocusPrev)
	useDownOf(KEYBOARD.RIGHT, shiftFocusNext)

	useDownOf(KEYBOARD.DELETE, deleteSelfMark)
	useDownOf(KEYBOARD.BACKSPACE, deleteSelfMark)

	useDownOf(KEYBOARD.DELETE, deleteNextMark)
	useDownOf(KEYBOARD.BACKSPACE, deletePrevMark)

	useListener('keydown', selectAllText, [])

	function shiftFocusPrev(event: KeyboardEvent) {
		const {focus} = store.nodes
		if ((focus.isMark && !focus.isEditable) || focus.isCaretAtBeginning) {
			const prev = focus.prev
			prev.focus()
			if (!prev.isFocused) {
				prev.prev.focus()
				event.preventDefault()
			}
			focus.setCaretToEnd()
		}
	}

	function shiftFocusNext(event: KeyboardEvent) {
		const {focus} = store.nodes
		if ((focus.isMark && !focus.isEditable) || focus.isCaretAtEnd) {
			const next = focus.next
			next.focus()
			if (!next.isFocused) {
				next.next.focus()
				event.preventDefault()
			}
		}
	}

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

	function selectAllText(event: KeyboardEvent) {
		if (event.ctrlKey && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.refs.container?.firstChild
			const focusNode = store.refs.container?.lastChild

			if (!selection || !anchorNode || !focusNode) return
			selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)
		}
	}
}
