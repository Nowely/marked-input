import {useCallback} from 'react'
import {SystemEvent} from '../../../types'
import {useStore} from '../../../utils'
import {useListener} from '../../../utils/useListener'

export function useCheckTriggerOnSelectionChange() {
	const {bus} = useStore()

	const sendCheckTrigger = useCallback(() => bus.send(SystemEvent.CheckTrigger), [])

	useListener('focusin', () =>
		document.addEventListener('selectionchange', sendCheckTrigger), [])

	useListener('focusout', () =>
		document.removeEventListener('selectionchange', sendCheckTrigger), [])
}