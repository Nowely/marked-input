import {SystemEvent} from '../../../constants'
import {MarkStruct, Payload, OverlayMatch} from '../../../types'
import {createNewSpan} from '../../../utils/functions/createNewSpan'
import {useListener} from '../../../utils/hooks/useListener'
import {annotate} from '../../../utils/functions/annotate'
import {useStore} from '../../../utils/providers/StoreProvider'
import {toString} from '../../../utils/functions/toString'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
	const store = useStore()

	useListener(SystemEvent.Change, (event: Payload) => {
		const {pieces, onChange, options} = store.state
		const {node, value} = event

		if (value) {
			node.data.mark.label = value.label
			node.data.mark.value = value.value
		}
		store.recovery = {caretPosition: 0, prevNodeData: node?.prev?.data, isPrevPrev: true}
		const values = pieces.toArray().map(node => node.mark)

		store.changedNode = node
		onChange(toString(values, options))
		//bus.send(SystemEvent.CheckTrigger) TODO check on value change
	}, [])

	useListener(SystemEvent.Delete, (event: Payload) => {
		const {pieces, onChange, options} = store.state
		const {node} = event

		store.changedNode = undefined
		node.remove()

		const values = pieces.toArray().map(data => data.mark)
		onChange(toString(values, options))
		//pieces.delete(key)
		//onChange(toString([...pieces.values()], options))
	}, [])

	useListener(SystemEvent.Select, (event: { value: MarkStruct, match: OverlayMatch }) => {
		const {pieces, Mark} = store.state
		const {value, match: {option, span, index, source, node}} = event

		const annotation = annotate(option.markup!, value.label, value.value)
		const newSpan = createNewSpan(span, annotation, index, source)
		//const key = findSpanKey(span, pieces)
		const piece = pieces.findNode(node => node.mark.label===span)
		store.recovery = {caretPosition: 0, prevNodeData: piece?.prev?.data, isPrevPrev: true}

		if (piece) {
			piece.data.mark.label = newSpan
			//piece.data.mark.value = value.value
			//bus.send(SystemEvent.Change, {value: newSpan, key: mark.data.key})
			store.bus.send(SystemEvent.Change, {value: {label: newSpan}, node: piece})
			if (!Mark) {
				node.textContent = newSpan
				store.recovery = {caretPosition: index + annotation.length}
			}
		}
	}, [])
}