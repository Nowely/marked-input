import type {ComponentType, CSSProperties, Ref} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'
import {useMarkedInputHandler} from '../features/useMarkedInputHandler'
import {useEvents} from '../features/useEvents'
import {useFocus} from '../features/useFocus'
import {useOverlayFeature} from '../features/useOverlayFeature'
import {useParsing} from '../features/useParsing'

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
	useEvents()
	useParsing()
	useFocus()
	useOverlayFeature()
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
