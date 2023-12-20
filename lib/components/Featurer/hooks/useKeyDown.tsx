import {KEYBOARD, SystemEvent} from '../../../constants'
import {castToHTMLElement} from '../../../utils/checkers/castToHTMLElement'
import {Caret} from '../../../utils/classes/Caret'
import {useDownOf} from '../../../utils/hooks/useDownOf'
import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

//TODO Focus on mark and attribute for this
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, event => {
		if (!isCaretInStart(event)) return

		const node = store.nodes.focused?.previousSibling?.previousSibling
		castToHTMLElement(node)
		if (node) {
			node.focus()
			Caret.setCaretToEnd(node)
		}

		event.preventDefault()
	})

	useDownOf(KEYBOARD.RIGHT, event => {
		if (!isCaretInEnd(event)) return

		const node = store.nodes.focused?.nextSibling?.nextSibling
		castToHTMLElement(node)
		if (node) node.focus()

		event.preventDefault()
	})

	useDownOf(KEYBOARD.DELETE, event => {
		if (!isCaretInEnd(event)) return

		const node = store.nodes.focused
		castToHTMLElement(node)
		if (!node) return

		const caretPosition = node.textContent?.length ?? 0
		store.recovery = {prevNode: node.previousSibling, caretPosition}
		store.bus.send(SystemEvent.Delete, {node: node.nextSibling})
		event.preventDefault()
	})

	useDownOf(KEYBOARD.BACKSPACE, event => {
		if (!isCaretInStart(event)) return

		const node = store.nodes.focused?.previousSibling
		castToHTMLElement(node)
		if (!node) return

		const caretPosition = node.previousSibling?.textContent?.length ?? 0
		store.recovery = {prevNode: node?.previousSibling, caretPosition}
		store.bus.send(SystemEvent.Delete, {node})
		event.preventDefault()
	})

	//Select all text
	useListener('keydown', (event) => {
		if (event.ctrlKey && event.code === 'KeyA') {
			event.preventDefault()

			const selection = window.getSelection()
			const anchorNode = store.refs.container.current?.firstChild
			const focusNode = store.refs.container.current?.lastChild

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
