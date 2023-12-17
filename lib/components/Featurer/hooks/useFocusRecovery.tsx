import {useEffect} from 'react'
import {Caret} from '../../../utils/classes/Caret'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusRecovery = () => {
	const store = useStore()
	const pieces = useStore(store => store.pieces)
	const deps = !store.props.Mark ? undefined : [pieces]

	//Restore focus after delete mark
	useEffect(() => {
		if (store.recovery) {
			const {prevNodeData, caretPosition, isPrevPrev} = store.recovery

			const node = store.pieces.findNode(data => data === prevNodeData)
			const newNode = isPrevPrev
				? node?.next?.next?.next ?? store.pieces.head?.next?.next
				: node?.next ?? store.pieces.head
			const element = newNode?.data.ref.current
			//debugger
			element?.focus()

			if (element)
				Caret.trySetIndex(element, caretPosition)

			store.recovery = undefined
		}
	}, deps)
}