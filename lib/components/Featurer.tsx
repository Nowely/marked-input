import {ForwardedRef} from 'react'
import {useCloseOverlayByEsc} from '../features/events/useCloseOverlayByEsc'
import {useCloseOverlayByOutsideClick} from '../features/events/useCloseOverlayByOutsideClick'
import {useKeyDown} from '../features/events/useKeyDown'
import {useSystemListeners} from '../features/events/useSystemListeners'
import {useFocusedNode} from '../features/focus/useFocusedNode'
import {useFocusOnEmptyInput} from '../features/focus/useFocusOnEmptyInput'
import {useFocusRecovery} from '../features/focus/useFocusRecovery'
import {useTextSelection} from '../features/focus/useTextSelection'
import {useCheckTrigger} from '../features/overlay/useCheckTrigger'
import {useTrigger} from '../features/overlay/useTrigger'
import {useValueParser} from '../features/parsing/useValueParser'
import {useMarkedInputHandler} from '../features/useMarkedInputHandler'
import {MarkedInputHandler} from '../types'

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