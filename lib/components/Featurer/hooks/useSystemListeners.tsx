import {SystemEvent} from '../../../constants'
import {createNewSpan} from '../../../utils/functions/createNewSpan'
import {useListener} from '../../../utils/hooks/useListener'
import {annotate} from '../../../utils/functions/annotate'
import {toString} from '../../../utils/functions/toString'
import {useStore} from '../../../utils/hooks/useStore'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
	const store = useStore()

	useListener(SystemEvent.Change, (event) => {
		const {onChange, options} = store.props
		const {node, mark} = event

		const index = [...node!.parentElement!.children].indexOf(node)
		store.tokens[index].label = node.textContent

		//store.nodes.changed = node
		onChange(toString(store.tokens, options))
		//bus.send(SystemEvent.CheckTrigger) TODO check on value change
	}, [])

	useListener(SystemEvent.Delete, ({node}) => {
		const {onChange, options} = store.props

		store.changedNode = undefined
		node?.remove()

		const values = store.pieces.toArray().map(data => data.mark)
		onChange(toString(values, options))
		//pieces.delete(key)
		//onChange(toString([...pieces.values()], options))
	}, [])

	useListener(SystemEvent.Select, (event) => {
		const {Mark} = store.props
		const {mark, match: {option, span, index, source, node}} = event

		const annotation = annotate(option.markup!, mark.label, mark.value)
		const newSpan = createNewSpan(span, annotation, index, source)
		//const key = findSpanKey(span, pieces)
		const piece = store.pieces.findNode(node => node.mark.label===span)
		store.recovery = {caretPosition: 0, prevNode: piece?.prev?.data, isPrevPrev: true}

		if (piece) {
			piece.data.mark.label = newSpan
			//piece.data.mark.value = value.value
			//bus.send(SystemEvent.Change, {value: newSpan, key: mark.data.key})
			store.bus.send(SystemEvent.Change, {mark: {label: newSpan}, node: piece})
			if (!Mark) {
				node.textContent = newSpan
				store.recovery = {caretPosition: index + annotation.length}
			}
		}
	}, [])
}