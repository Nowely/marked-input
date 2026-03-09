import type {CoreSlotProps, CoreSlots, MarkputHandler, OverlayTrigger, StyleProperties} from '@markput/core'
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useState} from 'react'

import {createUseHook} from '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {StoreContext} from '../lib/providers/StoreContext'
import type {MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {BlockContainer} from './BlockContainer'
import {Container} from './Container'
import {OverlayRenderer} from './OverlayRenderer'

import styles from '@markput/core/styles.module.css'

/**
 * Props for MarkedInput component.
 *
 * @template TMarkProps - Type of props for the global Mark component
 * @template TOverlayProps - Type of props for the global Overlay component
 *
 * @example
 * ```tsx
 * <MarkedInput<ChipProps>
 *   Mark={Chip}
 *   options={[{
 *     markup: '@[__value__]',
 *     mark: { label: 'Click me' }
 *   }]}
 * />
 * ```
 */
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> {
	/** Ref to handler */
	ref?: Ref<MarkputHandler>
	/** Global component used for rendering markups (fallback for option.mark.slot) */
	Mark?: ComponentType<TMarkProps>
	/** Global component used for rendering overlays (fallback for option.overlay.slot) */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Configuration options for markups and overlays.
	 * Each option can specify its own slot component via mark.slot or overlay.slot.
	 * Falls back to global Mark/Overlay components when not specified.
	 */
	options?: Option<TMarkProps, TOverlayProps>[]
	/** Additional classes */
	className?: string
	/** Additional style */
	style?: CSSProperties
	/**
	 * Override internal components using slots
	 * @example slots={{ container: 'div', span: 'span' }}
	 */
	slots?: Slots
	/**
	 * Props to pass to slot components
	 * @example slotProps={{ container: { onKeyDown: handler }, span: { className: 'custom' } }}
	 */
	slotProps?: SlotProps
	/**
	 * Events that trigger overlay display
	 * @default 'change'
	 */
	showOverlayOn?: OverlayTrigger
	/** Annotated text with markups */
	value?: string
	/** Initial value for uncontrolled mode */
	defaultValue?: string
	/** Change event handler */
	onChange?: (value: string) => void
	/** Read-only mode */
	readOnly?: boolean
	/** Enable Notion-like draggable blocks with drag handles for reordering.
	 * Pass an object to configure block behavior, e.g. `{ alwaysShowHandle: true }` for mobile.
	 */
	block?: boolean | {alwaysShowHandle: boolean}
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
		block = false,
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
		block,
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

	const ContainerImpl = block ? BlockContainer : Container

	return (
		<StoreContext value={store}>
			<ContainerImpl />
			<OverlayRenderer />
		</StoreContext>
	)
}