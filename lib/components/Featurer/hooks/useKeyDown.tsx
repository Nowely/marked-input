import {KEY, SystemEvent} from '../../../constants'
import {useStore} from '../../../utils'
import {Caret} from '../../../utils/Caret'
import {useDownOf} from '../../../utils/useDownOf'
import {useListener} from '../../../utils/useListener'

export function useKeyDown() {
	const store = useStore()

	useDownOf(KEY.LEFT, event => {
		if (!isCaretInStart(event)) return

		const node = store.focusedNode?.prev
		const element = node?.data.ref.current ?? node?.prev?.data.ref.current
		element?.focus()
		Caret.setCaretToEnd(element)
		event.preventDefault()
	})

	useDownOf(KEY.RIGHT, event => {
		if (!isCaretInEnd(event)) return

		const node = store.focusedNode?.next
		const element = node?.data.ref.current ?? node?.next?.data.ref.current
		element?.focus()
		event.preventDefault()
	})

	useDownOf(KEY.DELETE, event => {
		if (!isCaretInEnd(event)) return

		const node = store.focusedNode?.next
		if (!node) return

		const caretPosition = node.prev?.data.mark.label.length ?? 0
		store.recovery = {prevNodeData: node.prev?.prev?.data, caretPosition}
		store.bus.send(SystemEvent.Delete, {node})
		event.preventDefault()
	})

	useDownOf(KEY.BACKSPACE, event => {
		if (!isCaretInStart(event)) return

		const node = store.focusedNode?.prev
		if (!node) return

		const caretPosition = node.prev?.data.mark.label.length ?? 0
		store.recovery = {prevNodeData: node.prev?.prev?.data, caretPosition}
		store.bus.send(SystemEvent.Delete, {node})
		event.preventDefault()
	})

	//Select all text
	useListener('keydown', (event) => {
		if (event.ctrlKey && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.containerRef.current?.firstChild
			const focusNode = store.containerRef.current?.lastChild

			if (!selection || !anchorNode || !focusNode) return
			selection.setBaseAndExtent(anchorNode, 0, focusNode, 1)
		}
	}, [])
}

function isCaretInStart(e: KeyboardEvent) {
	const target = e.target as HTMLSpanElement
	const caretIndex = Caret.getCaretIndex(target)
	return caretIndex === 0
}

function isCaretInEnd(event: KeyboardEvent) {
	const target = event.target as HTMLSpanElement
	const caretIndex = Caret.getCaretIndex(target)
	return caretIndex === target.textContent?.length
}
