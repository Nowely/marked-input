import {FocusEvent, useCallback} from 'react'
import {Type} from '../../../types'
import {useStore} from '../../../utils'
import {useContainerListener} from '../../../utils/useListener'

export function useCheckTriggerOnSelectionChange() {
	const {bus} = useStore()

	const sendCheckTrigger = useCallback(() => bus.send(Type.CheckTrigger), [])

	useContainerListener('focusin', (e: FocusEvent<HTMLElement>) =>
		document.addEventListener('selectionchange', sendCheckTrigger), [])

	useContainerListener('focusout', (e: FocusEvent<HTMLElement>) =>
		document.removeEventListener('selectionchange', sendCheckTrigger), [])
}