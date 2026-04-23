import type {CoreOption, DraggableConfig, MarkputHandler, OverlayTrigger} from '@markput/core'
import {Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useImperativeHandle, useLayoutEffect, useState} from 'react'

import {StoreContext} from '../lib/providers/StoreContext'
import type {MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {OverlayRenderer} from './OverlayRenderer'

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
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps> {
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
	/** Layout mode: 'inline' renders tokens in a single flow, 'block' stacks each token as its own row.
	 * @default 'inline'
	 */
	layout?: 'inline' | 'block'
	/** Enable drag interaction on block rows. Only effective when layout='block'.
	 * @default false
	 */
	draggable?: boolean | DraggableConfig
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const [store] = useState(() => new Store())
	store.props.set(props)

	useLayoutEffect(() => {
		store.lifecycle.mounted()
		return () => store.lifecycle.unmounted()
	}, [])

	useImperativeHandle(props.ref, () => store.handler, [store])

	return (
		<StoreContext value={store}>
			<Container />
			<OverlayRenderer />
		</StoreContext>
	)
}