import type {CSSProperties, ComponentType, ForwardedRef} from 'react'
import {forwardRef} from 'react'
import type {MarkedInputHandler, Option, Slots, SlotProps, OverlayProps, MarkProps} from '../types'
import {Container} from './Container'
import {Featurer} from './Featurer'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'

/**
 * Props for MarkedInput component.
 *
 * @template TMarkProps - Type of props for the global Mark component
 * @template TOverlayProps - Type of props for the global Overlay component
 *
 * @example
 * ```typescript
 * <MarkedInput<ChipProps>
 *   Mark={Chip}
 *   options={[{
 *     markup: '@[__value__]',
 *     mark: { label: 'Click me' }
 *   }]}
 * />
 * ```
 */
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreMarkputProps {
	/** Ref to handler */
	ref?: ForwardedRef<MarkedInputHandler>
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
	<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
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

/**
 * @function
 */
export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent
