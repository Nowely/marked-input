import type {ComponentType, CSSProperties, Ref} from 'react'
import {useState} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {Whisper} from './Whisper'
import type {CoreSlotProps, CoreSlots, OverlayTrigger, StyleProperties} from '@markput/core'
import {cx, merge, Store} from '@markput/core'
import styles from '@markput/core/styles.module.css'
import {StoreContext} from '../lib/providers/StoreContext'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {createUseHook} from '../lib/hooks/createUseHook'
import {DEFAULT_OPTIONS} from '../constants'

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
	const {
		ref,
		value,
		defaultValue,
		onChange,
		readOnly,
		Mark,
		Overlay,
		slots,
		slotProps,
		options = DEFAULT_OPTIONS,
		showOverlayOn = 'change',
		className: classNameProp,
		style: styleProp,
	} = props
	const className = cx(styles.Container, classNameProp, slotProps?.container?.className)
	const style = merge(styleProp, slotProps?.container?.style)
	const [store] = useState(() => new Store({createUseHook}))

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
