import {SystemEvent} from '../constants'
import {annotate} from '../utils/functions/annotate'
import {createNewSpan} from '../utils/functions/createNewSpan'
import {toString} from '../utils/functions/toString'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'

//TODO upgrade to full members of react events to external
export function useSystemListeners() {
	const store = useStore()

	useListener(SystemEvent.Change, (event) => {
		const {onChange, options} = store.props
		const {node, mark} = event

		const index = [...node!.parentElement!.children].indexOf(node)
		store.tokens[index].label = node.textContent

		onChange(toString(store.tokens, options))
		//bus.send(SystemEvent.CheckTrigger) TODO check on value change
	}, [])

	useListener(SystemEvent.Select, (event) => {
		const {Mark} = store.props
		const {mark, match: {option, span, index, source, node}} = event

		const annotation = annotate(option.markup!, mark.label, mark.value)
		const newSpan = createNewSpan(span, annotation, index, source)
		//const key = findSpanKey(span, pieces)
		const piece = store.pieces.findNode(node => node.mark.label === span)
		store.recovery = {caret: 0, anchor: piece?.prev?.data, isPrev: true}

		if (piece) {
			piece.data.mark.label = newSpan
			//piece.data.mark.value = value.value
			//bus.send(SystemEvent.Change, {value: newSpan, key: mark.data.key})
			store.bus.send(SystemEvent.Change, {mark: {label: newSpan}, node: piece})
			if (!Mark) {
				node.textContent = newSpan
				store.recovery = {caret: index + annotation.length}
			}
		}
	}, [])
}