import {ForwardedRef} from 'react'
import {MarkedInputHandler} from '../../types'
import {useCheckTrigger} from './hooks/useCheckTrigger'
import {useCloseOverlayByEsc} from './hooks/useCloseOverlayByEsc'
import {useCloseOverlayByOutsideClick} from './hooks/useCloseOverlayByOutsideClick'
import {useFocusedNode} from './hooks/useFocusedNode'
import {useFocusOnEmptyInput} from './hooks/useFocusOnEmptyInput'
import {useFocusRecovery} from './hooks/useFocusRecovery'
import {useKeyDown} from './hooks/useKeyDown'
import {useMarkedInputHandler} from './hooks/useMarkedInputHandler'
import {useSystemListeners} from './hooks/useSystemListeners'
import {useTextSelection} from './hooks/useTextSelection'
import {useTrigger} from './hooks/useTrigger'
import {useValueParser} from './hooks/useValueParser'

export const Featurer = ({inRef}: { inRef: ForwardedRef<MarkedInputHandler> }) => {
	useMarkedInputHandler(inRef)

	useSystemListeners()
	useValueParser()

	useFocusedNode()
	useKeyDown()
	useFocusOnEmptyInput()
	useFocusRecovery()

	useTrigger()
	useCheckTrigger()

	useCloseOverlayByEsc()
	useCloseOverlayByOutsideClick()

	useTextSelection()

	return null
}