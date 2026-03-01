import type {ComponentType, CSSProperties, Ref} from 'react'
import {useMemo, useState} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {Whisper} from './Whisper'
import type {CoreSlotProps, CoreSlots, OverlayTrigger, StyleProperties} from '@markput/core'
import {Store} from '@markput/core'
import {StoreContext} from '../lib/providers/StoreContext'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {createUseSignalHook} from '../lib/hooks/createUseSignalHook'
import {normalizeProps} from '../lib/utils/normalizeProps'

export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> {
	ref?: Ref<MarkedInputHandler>
	Mark?: ComponentType<TMarkProps>
	Overlay?: ComponentType<TOverlayProps>
	options?: Option<TMarkProps, TOverlayProps>[]
	className?: string
	style?: CSSProperties
	slots?: Slots
	slotProps?: SlotProps
	showOverlayOn?: OverlayTrigger
	value?: string
	defaultValue?: string
	onChange?: (value: string) => void
	readOnly?: boolean
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
		s.state.value.set(value)
		s.state.defaultValue.set(defaultValue)
		s.state.onChange.set(onChange)
		s.state.readOnly.set(readOnly ?? false)
		s.state.options.set(options)
		s.state.showOverlayOn.set(showOverlayOn)
		s.state.Mark.set(Mark)
		s.state.Overlay.set(Overlay)
		s.state.className.set(className)
		s.state.style.set(style as StyleProperties)
		s.state.slots.set(slots as CoreSlots)
		s.state.slotProps.set(slotProps as CoreSlotProps)
		return s
	})

	store.state.value.set(value)
	store.state.defaultValue.set(defaultValue)
	store.state.onChange.set(onChange)
	store.state.readOnly.set(readOnly ?? false)
	store.state.options.set(options)
	store.state.showOverlayOn.set(showOverlayOn)
	store.state.Mark.set(Mark)
	store.state.Overlay.set(Overlay)
	store.state.className.set(className)
	store.state.style.set(style as StyleProperties)
	store.state.slots.set(slots as CoreSlots)
	store.state.slotProps.set(slotProps as CoreSlotProps)

	useCoreFeatures(store, ref)

	return (
		<StoreContext.Provider value={store}>
			<Container />
			<Whisper />
		</StoreContext.Provider>
	)
}
