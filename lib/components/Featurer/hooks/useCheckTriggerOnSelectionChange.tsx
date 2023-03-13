import {FocusEvent, useCallback} from 'react'
import {Type} from '../../../types'
import {useStore} from '../../../utils'
import {useListener} from '../../../utils/useListener'

export function useCheckTriggerOnSelectionChange() {
    const {bus} = useStore()

    const sendCheckTrigger = useCallback(() => bus.send(Type.CheckTrigger), [])

    useListener('onFocus', (e: FocusEvent<HTMLElement>) =>
        document.addEventListener('selectionchange', sendCheckTrigger), [])

    useListener('onBlur', (e: FocusEvent<HTMLElement>) =>
        document.removeEventListener('selectionchange', sendCheckTrigger), [])
}