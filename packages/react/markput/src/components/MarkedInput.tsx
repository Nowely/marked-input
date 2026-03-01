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

/**
 * Props for MarkedInput component.
 *
 * @template TMarkProps - Type of props for the global Mark component
 * @template TOverlayProps - Type of props for the global Overlay component
 */
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> {
	/** Ref to handler */
	ref?: Ref<MarkedInputHandler>
	/** Global component used for rendering markups (fallback for option.mark.slot) */
	Mark?: ComponentType<TMarkProps>
	/** Global component used for rendering overlays (fallback for option.overlay.slot) */
	Overlay?: ComponentType<TOverlayProps>
	/** Configuration options for markups and overlays */
	options?: Option<TMarkProps, TOverlayProps>[]
	/** Additional classes */
	className?: string
	/** Additional style */
	style?: CSSProperties
	/** Override internal components using slots */
	slots?: Slots
	/** Props to pass to slot components */
	slotProps?: SlotProps
	/** Events that trigger overlay display @default 'change' */
	showOverlayOn?: OverlayTrigger
	/** Annotated text with markups */
	value?: string
	/** Initial value for uncontrolled mode */
	defaultValue?: string
	/** Change event handler */
	onChange?: (value: string) => void
	/** Read-only mode */
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
		readOnly = false,
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

	store.state.set({
		value,
		defaultValue,
		onChange,
		readOnly,
		options,
		showOverlayOn,
		Mark,
		Overlay,
		className,
		style: style as StyleProperties,
		slots: slots as CoreSlots,
		slotProps: slotProps as CoreSlotProps,
	})

	useCoreFeatures(store, ref)

	return (
		<StoreContext.Provider value={store}>
			<Container />
			<Whisper />
		</StoreContext.Provider>
	)
}
