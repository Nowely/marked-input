import type {ComponentType, CSSProperties, Ref} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'
import {useMarkedInputHandler} from '../features/useMarkedInputHandler'
import {useSystemListeners} from '../features/events/useSystemListeners'
import {useValueParser} from '../features/parsing/useValueParser'
import {useFocusedNode} from '../features/focus/useFocusedNode'
import {useKeyDown} from '../features/events/useKeyDown'
import {useFocusOnEmptyInput} from '../features/focus/useFocusOnEmptyInput'
import {useFocusRecovery} from '../features/focus/useFocusRecovery'
import {useTrigger} from '../features/overlay/useTrigger'
import {useCheckTrigger} from '../features/overlay/useCheckTrigger'
import {useCloseOverlayByEsc} from '../features/events/useCloseOverlayByEsc'
import {useCloseOverlayByOutsideClick} from '../features/events/useCloseOverlayByOutsideClick'
import {useTextSelection} from '../features/focus/useTextSelection'

export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreMarkputProps {
	ref?: Ref<MarkedInputHandler>
	Mark?: ComponentType<TMarkProps>
	Overlay?: ComponentType<TOverlayProps>
	options?: Option<TMarkProps, TOverlayProps>[]
	className?: string
	style?: CSSProperties
	slots?: Slots
	slotProps?: SlotProps
	showOverlayOn?: OverlayTrigger
}

function Features({ref}: {ref?: Ref<MarkedInputHandler>}) {
	useMarkedInputHandler(ref)
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

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const {ref, ...rest} = props
	return (
		<StoreProvider props={rest as MarkedInputProps}>
			<Container />
			<Whisper />
			<Features ref={ref} />
		</StoreProvider>
	)
}
