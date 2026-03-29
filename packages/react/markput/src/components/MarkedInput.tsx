import type {CoreSlotProps, CoreSlots, MarkputHandler, OverlayTrigger, StyleProperties} from '@markput/core'
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useState} from 'react'

import {createUseHook} from '../lib/hooks/createUseHook'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {StoreContext} from '../lib/providers/StoreContext'
import type {MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {OverlayRenderer} from './OverlayRenderer'
import {Span as DefaultSpan} from './Span'

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
	/** Global component used for rendering text tokens (default: built-in Span) */
	Span?: ComponentType<MarkProps>
	/** Global component used for rendering markups (fallback for option.Mark) */
	Mark?: ComponentType<TMarkProps>
	/** Global component used for rendering overlays (fallback for option.Overlay) */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Configuration options for markups and overlays.
	 * Each option can specify its own component via option.Mark or option.Overlay.
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
	/** Enable drag mode: each individual token (mark or text) becomes its own draggable row.
	 * One mark per row, one text fragment per row.
	 * Adjacent marks need no separator; adjacent text rows are separated by `\n\n`.
	 */
	drag?: boolean | {alwaysShowHandle: boolean}
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const {ref} = props
	const className = cx(styles.Container, props.className, props.slotProps?.container?.className)
	const style = merge(props.style, props.slotProps?.container?.style) as StyleProperties
	const [store] = useState(() => new Store({createUseHook, defaultSpan: DefaultSpan}))

	store.state.set({
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: props.onChange,
		readOnly: props.readOnly ?? false,
		drag: props.drag ?? false,
		options: props.options ?? DEFAULT_OPTIONS,
		showOverlayOn: props.showOverlayOn ?? 'change',
		Span: props.Span,
		Mark: props.Mark,
		Overlay: props.Overlay,
		className,
		style,
		slots: props.slots as CoreSlots,
		slotProps: props.slotProps as CoreSlotProps,
	})

	useCoreFeatures(store, ref)

	return (
		<StoreContext value={store}>
			<Container />
			<OverlayRenderer />
		</StoreContext>
	)
}