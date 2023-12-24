import {KEYBOARD, SystemEvent} from '../../../constants'
import {toString} from '../../../utils/functions/toString'
import {useDownOf} from '../../../utils/hooks/useDownOf'
import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

//TODO Focus on mark and attribute for this
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, shiftFocusPrev)
	useDownOf(KEYBOARD.RIGHT, shiftFocusNext)

	//TODO different rules for editable
	useDownOf(KEYBOARD.DELETE, preventDefault)
	useDownOf(KEYBOARD.BACKSPACE, preventDefault)

	useDownOf(KEYBOARD.DELETE, deleteNextMark)
	useDownOf(KEYBOARD.BACKSPACE, deletePrevMark)

	useDownOf(KEYBOARD.DELETE, deleteSelfMark)
	useDownOf(KEYBOARD.BACKSPACE, deleteSelfMark)

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

	function deleteNextMark() {
		const {focus} = store

		if (focus.isEditable && focus.isCaretAtEnd)
			deleteNMark()
	}

	function deletePrevMark() {
		const {focus} = store

		if (focus.isEditable && focus.isCaretAtBeginning)
			deletePMark()
	}

	function deleteSelfMark() {
		const {focus} = store

		if (focus.isEditable) return

		let [span1, mark, span2] = store.tokens.splice(focus.index - 1, 3)
		store.tokens = store.tokens.toSpliced(focus.index - 1, 0, {
			label: span1.label + span2.label
		})

		const caretPosition = focus.prev.length
		store.recovery = {anchor: focus.prev.prev, caret: caretPosition}

		store.props.onChange(toString(store.tokens, store.props.options))
	}


	function deleteNMark() {
		const {focus} = store

		let [span1, mark, span2] = store.tokens.splice(focus.index , 3)
		store.tokens = store.tokens.toSpliced(focus.index , 0, {
			label: span1.label + span2.label
		})

		const caretPosition = focus.length
		store.recovery = {anchor: focus.prev, caret: caretPosition}

		store.props.onChange(toString(store.tokens, store.props.options))
	}
	function deletePMark() {
		const {focus} = store

		let [span1, mark, span2] = store.tokens.splice(focus.index - 2, 3)
		store.tokens = store.tokens.toSpliced(focus.index - 2, 0, {
			label: span1.label + span2.label
		})

		const caretPosition = focus.prev.prev.length

		store.recovery = {anchor: focus.prev.prev.prev, caret: caretPosition}

		store.props.onChange(toString(store.tokens, store.props.options))
	}

	function selectAllText(event: KeyboardEvent) {
		if (event.ctrlKey && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.refs.container.current?.firstChild
			const focusNode = store.refs.container.current?.lastChild

			if (!selection || ! anchorNode || !focusNode) return
			selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)
		}
	}
}
