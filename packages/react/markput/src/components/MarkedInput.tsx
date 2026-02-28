import type {ComponentType, CSSProperties, Ref} from 'react'
import {useEffect, useMemo, useState} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'
import {Store} from '@markput/core'
import {StoreContext} from '../lib/providers/StoreContext'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {createUseSignalHook} from '../lib/hooks/createUseSignalHook'
import {normalizeProps} from '../lib/utils/normalizeProps'

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

function MarkedInputInner({ref}: {ref?: Ref<MarkedInputHandler>}) {
	useCoreFeatures(ref)
	return (
		<>
			<Container />
			<Whisper />
		</>
	)
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const {ref, ...rest} = props
	const storeProps = normalizeProps(rest as MarkedInputProps)
	const createUseHook = useMemo(createUseSignalHook, [])
	const [store] = useState(() => new Store(storeProps, {createUseHook}))

	useEffect(() => {
		store.props = storeProps
	})

	return (
		<StoreContext.Provider value={store}>
			<MarkedInputInner ref={ref} />
		</StoreContext.Provider>
	)
}
