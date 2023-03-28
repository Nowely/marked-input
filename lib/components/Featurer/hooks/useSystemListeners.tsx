import {SystemEvent} from '../../../constants'
import {MarkStruct, Payload, Trigger} from '../../../types'
import {annotate, createNewSpan, toString, useStore} from '../../../utils'
import {useListener} from '../../../utils/useListener'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
	const store = useStore()

	useListener(SystemEvent.Change, (event: Payload) => {
		const {pieces, onChange, options} = store.state
		const {key, value} = event

		const node = pieces.find(data => data.key === key)
		if (node && value) {
			node.mark.label = value.label
			node.mark.value = value.value
		}

		const values = pieces.toArray().map(node => node.mark)
		onChange(toString(values, options))
		//bus.send(SystemEvent.CheckTrigger) TODO check on value change
	}, [])

	useListener(SystemEvent.Delete, (event: Payload) => {
		const {pieces, onChange, options} = store.state
		const {key} = event

		const piece = pieces.findNode(node => node.key === key)
		if (piece) piece.remove()

		const values = pieces.toArray().map(data => data.mark)
		onChange(toString(values, options))
		//pieces.delete(key)
		//onChange(toString([...pieces.values()], options))
	}, [])

	useListener(SystemEvent.Select, (event: { value: MarkStruct, trigger: Trigger }) => {
		const {pieces} = store.state
		const {value, trigger: {option, span, index, source, node}} = event

		const annotation = annotate(option.markup!, value.label, value.value)
		const newSpan = createNewSpan(span, annotation, index, source)
		//const key = findSpanKey(span, pieces)
		const piece = pieces.findNode(node => node.mark.label === span)
		store.recovery = {caretPosition: 0, prevNodeData: piece?.prev?.data, isPrevPrev: true}

		if (piece) {
			piece.data.mark.label = newSpan
			//piece.data.mark.value = value.value
			//bus.send(SystemEvent.Change, {value: newSpan, key: mark.data.key})
			store.bus.send(SystemEvent.Change, {value: {label: newSpan}, key: piece.data.key})
			node.textContent = newSpan
		}
	}, [])
}