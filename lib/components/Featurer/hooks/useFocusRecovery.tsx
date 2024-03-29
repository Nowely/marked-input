import {useEffect} from 'react'
import {useStore} from '../../../utils'
import {Caret} from '../../../utils/Caret'
import {useSelector} from '../../../utils/useSelector'

export const useFocusRecovery = () => {
	const store = useStore()
	const pieces = useSelector(state => state.pieces)
	const deps = !store.state.Mark ? undefined : [pieces]

	//Restore focus after delete mark
	useEffect(() => {
		if (store.recovery) {
			const {prevNodeData, caretPosition, isPrevPrev} = store.recovery

			const node = store.state.pieces.findNode(data => data === prevNodeData)
			const newNode = isPrevPrev
				? node?.next?.next?.next ?? store.state.pieces.head?.next?.next
				: node?.next ?? store.state.pieces.head
			const element = newNode?.data.ref.current
			//debugger
			element?.focus()

			if (element)
				Caret.trySetIndex(element, caretPosition)

			store.recovery = undefined
		}
	}, deps)
}