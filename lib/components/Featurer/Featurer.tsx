import {ForwardedRef, forwardRef} from 'react'
import {MarkedInputHandler} from '../../types'
import {MarkedInputProps} from '../MarkedInput'
import {useCheckTriggerOnSelectionChange} from './hooks/useCheckTriggerOnSelectionChange'
import {useCloseOverlayByEsc} from './hooks/useCloseOverlayByEsc'
import {useCloseOverlayByOutsideClick} from './hooks/useCloseOverlayByOutsideClick'
import {useContainerEvents} from './hooks/useContainerEvents'
import {useFocusedNode} from './hooks/useFocusedNode'
import {useFocusOnEmptyInput} from './hooks/useFocusOnEmptyInput'
import {useFocusRecovery} from './hooks/useFocusRecovery'
import {useKeyDown} from './hooks/useKeyDown'
import {useMarkedInputHandler} from './hooks/useMarkedInputHandler'
import {useStateUpdating} from './hooks/useStateUpdating'
import {useSystemListeners} from './hooks/useSystemListeners'
import {useTextSelection} from './hooks/useTextSelection'
import {useTrigger} from './hooks/useTrigger'
import {useValueParser} from './hooks/useValueParser'

export const Featurer = forwardRef(({props}: { props: MarkedInputProps<any> }, ref: ForwardedRef<MarkedInputHandler>) => {
	//TODO move to provider
	useStateUpdating(props)
	useMarkedInputHandler(ref)

	useContainerEvents()
	useSystemListeners()
	useValueParser()

	useFocusedNode()
	useKeyDown()
	useFocusOnEmptyInput()
	useFocusRecovery()

	useTrigger()
	useCheckTriggerOnSelectionChange()

	useCloseOverlayByEsc()
	useCloseOverlayByOutsideClick()

	useTextSelection()

	return null
})