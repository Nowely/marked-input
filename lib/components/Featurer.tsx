import {ForwardedRef} from 'react'
import {MarkedInputHandler} from '../types'
import {useCheckTrigger} from '../features/useCheckTrigger'
import {useCloseOverlayByEsc} from '../features/useCloseOverlayByEsc'
import {useCloseOverlayByOutsideClick} from '../features/useCloseOverlayByOutsideClick'
import {useFocusedNode} from '../features/useFocusedNode'
import {useFocusOnEmptyInput} from '../features/useFocusOnEmptyInput'
import {useFocusRecovery} from '../features/useFocusRecovery'
import {useKeyDown} from '../features/useKeyDown'
import {useMarkedInputHandler} from '../features/useMarkedInputHandler'
import {useSystemListeners} from '../features/useSystemListeners'
import {useTextSelection} from '../features/useTextSelection'
import {useTrigger} from '../features/useTrigger'
import {useValueParser} from '../features/useValueParser'

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