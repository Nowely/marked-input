import {KEYBOARD, SystemEvent} from '../../../constants'
import {castToHTMLElement} from '../../../utils/checkers/castToHTMLElement'
import {Caret} from '../../../utils/classes/Caret'
import {getNodeIndex} from '../../../utils/functions/getNodeIndex'
import {toString} from '../../../utils/functions/toString'
import {useDownOf} from '../../../utils/hooks/useDownOf'
import {useListener} from '../../../utils/hooks/useListener'
import {useStore} from '../../../utils/hooks/useStore'

//TODO Focus on mark and attribute for this
export function useKeyDown() {
	const store = useStore()

	useDownOf(KEYBOARD.LEFT, event => {
		const target = event.target as HTMLElement | null
		if (!isCaretInStart(target)) return

		const node = target.previousSibling //store.nodes.focused?.previousSibling//?.previousSibling
		castToHTMLElement(node)
		if (node) {
			node.focus()
			Caret.setCaretToEnd(node)
		}

		event.preventDefault()
	})

	useDownOf(KEYBOARD.RIGHT, event => {
		const target = event.target as HTMLElement | null
		if (!isCaretInEnd(target)) return

		const node = store.nodes.focused?.nextSibling//?.nextSibling
		castToHTMLElement(node)
		if (node) node.focus()

		event.preventDefault()
	})

	useDownOf(KEYBOARD.DELETE, event => {
		const target = event.target as HTMLElement | null
		if (!target) return

		const index = getNodeIndex(target)

		//Remove not text
		if (target.contentEditable !== 'true') {
			let [span1, mark, span2] = store.tokens.splice(index - 1, 3)
			store.tokens = store.tokens.toSpliced(index - 1, 0, {
				label: span1.label + span2.label
			})

			const caretPosition = target.previousSibling?.textContent?.length ?? 0
			store.recovery = {prevNode: target.previousSibling?.previousSibling, caretPosition}

			store.props.onChange(toString(store.tokens, store.props.options))
			return
		}

		if (!isCaretInEnd(target)) return

		const caretPosition = target.textContent?.length ?? 0
		store.recovery = {prevNode: target.previousSibling, caretPosition}

		store.bus.send(SystemEvent.Delete, {node: target.nextSibling})

		store.nodes.focused = undefined

		store.tokens = store.tokens.toSpliced(index, 1)

		event.preventDefault()
	})

	useDownOf(KEYBOARD.BACKSPACE, event => {
		const target = event.target as HTMLElement | null
		if (!target) return

		const index = getNodeIndex(target)

		//Remove not text
		if (target.contentEditable !== 'true') {
			let [span1, mark, span2] = store.tokens.splice(index - 1, 3)
			store.tokens = store.tokens.toSpliced(index - 1, 0, {
				label: span1.label + span2.label
			})

			const caretPosition = target.previousSibling?.textContent?.length ?? 0
			store.recovery = {prevNode: target.previousSibling?.previousSibling, caretPosition}

			store.props.onChange(toString(store.tokens, store.props.options))
			return
		}

		if (!isCaretInStart(target)) return

		const caretPosition = target.textContent?.length ?? 0
		store.recovery = {prevNode: target.previousSibling, caretPosition}

		store.bus.send(SystemEvent.Delete, {node: target.nextSibling})

		store.nodes.focused = undefined

		store.tokens = store.tokens.toSpliced(index, 1)

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

function isCaretInStart(target: HTMLElement | null): target is HTMLElement {
	if (!target) return false
	const caretIndex = Caret.getCaretIndex(target)
	return caretIndex === 0
}

function isCaretInEnd(target: HTMLElement | null): target is HTMLElement {
	if (!target) return false
	const caretIndex = Caret.getCaretIndex(target)
	return caretIndex === target.textContent?.length
}
