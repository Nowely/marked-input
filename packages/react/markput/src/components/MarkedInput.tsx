import type {ComponentType, CSSProperties, Ref} from 'react'
import {useMemo, useState} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, CoreSlotProps, CoreSlots, OverlayTrigger, StyleProperties} from '@markput/core'
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
	const normalized = normalizeProps(rest as MarkedInputProps)
	const {
		value,
		defaultValue,
		onChange,
		readOnly,
		options,
		showOverlayOn,
		Mark,
		Overlay,
		className,
		style,
		slots,
		slotProps,
	} = normalized
	const createUseHook = useMemo(createUseSignalHook, [])
	const [store] = useState(() => {
		const s = new Store({createUseHook})
		s.state.value(value)
		s.state.defaultValue(defaultValue)
		s.state.onChange(onChange)
		s.state.readOnly(readOnly ?? false)
		s.state.options(options)
		s.state.showOverlayOn(showOverlayOn)
		s.state.Mark(Mark)
		s.state.Overlay(Overlay)
		s.state.className(className)
		s.state.style(style as StyleProperties)
		s.state.slots(slots as CoreSlots)
		s.state.slotProps(slotProps as CoreSlotProps)
		return s
	})

	store.state.value(value)
	store.state.defaultValue(defaultValue)
	store.state.onChange(onChange)
	store.state.readOnly(readOnly ?? false)
	store.state.options(options)
	store.state.showOverlayOn(showOverlayOn)
	store.state.Mark(Mark)
	store.state.Overlay(Overlay)
	store.state.className(className)
	store.state.style(style as StyleProperties)
	store.state.slots(slots as CoreSlots)
	store.state.slotProps(slotProps as CoreSlotProps)

	return (
		<StoreContext.Provider value={store}>
			<MarkedInputInner ref={ref} />
		</StoreContext.Provider>
	)
}
