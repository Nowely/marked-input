import {useEffect} from 'react'
import {Caret} from '../../../utils/classes/Caret'
import {useStore} from '../../../utils/hooks/useStore'

export const useFocusRecovery = () => {
	const store = useStore()
	const tokens = useStore(store => store.tokens)
	const deps = store.props.Mark ? [tokens] : undefined

	//Restore focus after delete mark
	useEffect(() => {
		if (!store.recovery) return

		const {prevNode, caretPosition, isPrevPrev} = store.recovery
		const element = (isPrevPrev
			? prevNode?.nextSibling?.nextSibling?.nextSibling ?? store.refs.container.current?.firstChild?.nextSibling?.nextSibling
			: prevNode?.nextSibling ?? store.refs.container.current?.firstChild) as HTMLElement | undefined
		element?.focus()
		if (element)
			Caret.trySetIndex(element, caretPosition)
		store.recovery = undefined
	}, deps)
}