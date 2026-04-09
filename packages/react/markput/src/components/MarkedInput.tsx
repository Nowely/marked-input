import type {CoreSlotProps, MarkputHandler, OverlayTrigger, StyleProperties} from '@markput/core'
import {cx, merge, Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useLayoutEffect, useState} from 'react'

// oxlint-disable-next-line no-unassigned-import -- side-effect import: registers the React useHook factory via setUseHookFactory
import '../lib/hooks/createUseHook'
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
	// oxlint-disable-next-line no-unsafe-type-assertion -- CSSProperties is structurally compatible with StyleProperties at runtime
	const style = merge(props.style, props.slotProps?.container?.style) as StyleProperties
	// oxlint-disable-next-line no-unsafe-type-assertion -- HTMLAttributes lacks index signature but is structurally compatible at runtime
	const slotProps = props.slotProps as CoreSlotProps
	const [store] = useState(() => {
		const nextStore = new Store({defaultSpan: DefaultSpan})
		nextStore.setState({
			value: props.value,
			defaultValue: props.defaultValue,
			onChange: props.onChange,
			readOnly: props.readOnly,
			drag: props.drag,
			options: props.options,
			showOverlayOn: props.showOverlayOn,
			Span: props.Span,
			Mark: props.Mark,
			Overlay: props.Overlay,
			className,
			style,
			slots: props.slots,
			slotProps,
		})
		return nextStore
	})

	useLayoutEffect(() => {
		store.setState({
			value: props.value,
			defaultValue: props.defaultValue,
			onChange: props.onChange,
			readOnly: props.readOnly,
			drag: props.drag,
			options: props.options,
			showOverlayOn: props.showOverlayOn,
			Span: props.Span,
			Mark: props.Mark,
			Overlay: props.Overlay,
			className,
			style,
			slots: props.slots,
			slotProps,
		})
	})

	useCoreFeatures(store, ref)

	return (
		<StoreContext value={store}>
			<Container />
			<OverlayRenderer />
		</StoreContext>
	)
}