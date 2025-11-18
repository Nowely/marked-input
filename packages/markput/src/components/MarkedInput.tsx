import type {CSSProperties, ComponentType, ForwardedRef} from 'react'
import {forwardRef} from 'react'
import '@markput/core/styles.css'
import type {MarkedInputHandler, Option, Slots, SlotProps, OverlayProps, MarkProps} from '../types'
import {Container} from './Container'
import {Featurer} from './Featurer'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'

/**
 * Props for MarkedInput component with hierarchical type support.
 *
 * Type parameters:
 * - `TMarkProps` - Type of props for the global Mark component (default: MarkProps)
 * - `TOverlayProps` - Type of props for the global Overlay component (default: OverlayProps)
 *
 * The global Mark and Overlay components serve as defaults when options don't specify
 * their own slot components. Each option can override these with option.slots.
 *
 * Default types:
 * - TMarkProps = MarkProps: Type-safe base props (value, meta, nested, children)
 * - TOverlayProps = OverlayProps: Type-safe overlay props (trigger, data)
 *
 * @example
 * ```typescript
 * // Using global Mark component with custom props type
 * interface ButtonProps { label: string; onClick: () => void }
 * <MarkedInput<ButtonProps>
 *   Mark={Button}
 *   options={[{
 *     markup: '@[__value__]',
 *     slotProps: { mark: { label: 'Click me', onClick: () => {} } }
 *   }]}
 * />
 * ```
 */
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreMarkputProps {
	/** Ref to handler */
	ref?: ForwardedRef<MarkedInputHandler>
	/** Global component used for rendering markups (fallback for option.slots.mark) */
	Mark?: ComponentType<TMarkProps>
	/** Global component used for rendering overlays like suggestions, mentions, etc (fallback for option.slots.overlay) */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Configuration options for markups and overlays.
	 * Each option can specify its own slot components and props via option.slots and option.slotProps.
	 * Falls back to global Mark/Overlay components when not specified.
	 * @default [{overlayTrigger: '@', markup: '@[__label__](__value__)', data: []}]
	 */
	options?: Option<TMarkProps, TOverlayProps>[]
	/** Additional classes */
	className?: string
	/** Additional style */
	style?: CSSProperties
	/**
	 * Override internal components using slots
	 * @example
	 * slots={{ container: 'div', span: 'span' }}
	 */
	slots?: Slots
	/**
	 * Props to pass to slot components
	 * @example
	 * slotProps={{ container: { onKeyDown: handler }, span: { className: 'custom' } }}
	 */
	slotProps?: SlotProps
	/**
	 * Events that trigger overlay display
	 * @default 'change'
	 */
	showOverlayOn?: OverlayTrigger
}

export interface MarkedInputComponent {
	<TMarkProps = any, TOverlayProps = OverlayProps>(
		props: MarkedInputProps<TMarkProps, TOverlayProps>
	): JSX.Element | null

	displayName?: string
}

export const _MarkedInput = (props: MarkedInputProps, ref: ForwardedRef<MarkedInputHandler>) => {
	return (
		<StoreProvider props={props}>
			<Container />
			<Whisper />
			<Featurer inRef={ref} />
		</StoreProvider>
	)
}

export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent
