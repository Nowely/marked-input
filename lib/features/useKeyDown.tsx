import {KEYBOARD} from '../constants'
import {deleteMark} from '../utils/functions/deleteMark'
import {useDownOf} from '../utils/hooks/useDownOf'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'

//TODO Focus on mark and attribute for this
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, shiftFocusPrev)
	useDownOf(KEYBOARD.RIGHT, shiftFocusNext)

	//TODO different rules for editable
	useDownOf(KEYBOARD.DELETE, preventDefault)
	useDownOf(KEYBOARD.BACKSPACE, preventDefault)

	useDownOf(KEYBOARD.DELETE, deleteSelfMark)
	useDownOf(KEYBOARD.BACKSPACE, deleteSelfMark)

	useDownOf(KEYBOARD.DELETE, deleteNextMark)
	useDownOf(KEYBOARD.BACKSPACE, deletePrevMark)

	useListener('keydown', selectAllText, [])

	function preventDefault(event: KeyboardEvent) {
		event.preventDefault()
	}

	function shiftFocusPrev() {
		const {focus} = store
		if (focus.isEditable && !focus.isCaretAtBeginning) return

		focus.prev.focus()
		focus.setCaretToEnd()
	}

	function shiftFocusNext() {
		const {focus} = store
		if (focus.isEditable && !focus.isCaretAtEnd) return

		focus.next.focus()
	}

	function deleteSelfMark() {
		if (!store.focus.isEditable)
			deleteMark('self', store)
	}

	function deletePrevMark() {
		if (store.focus.isEditable && store.focus.isCaretAtBeginning)
			deleteMark('prev', store)
	}

	function deleteNextMark() {
		if (store.focus.isEditable && store.focus.isCaretAtEnd)
			deleteMark('next', store)
	}

	function selectAllText(event: KeyboardEvent) {
		if (event.ctrlKey && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.refs.container.current?.firstChild
			const focusNode = store.refs.container.current?.lastChild

			if (!selection || !anchorNode || !focusNode) return
			selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)
		}
	}
}

