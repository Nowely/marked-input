import {CSSProperties, ComponentType, ForwardedRef, forwardRef} from 'react'
import '@markput/core/styles.css'
import {MarkedInputHandler, Option, Slots, SlotProps} from '../types'
import {Container} from './Container'
import {Featurer} from './Featurer'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import {CoreMarkputProps, Token, OverlayTrigger} from '@markput/core'

export interface MarkedInputProps<T = Token> extends Omit<CoreMarkputProps, 'options' | 'showOverlayOn'> {
	/** Ref to handler */
	ref?: ForwardedRef<MarkedInputHandler>
	/** Component that used for render markups */
	Mark?: ComponentType<T>
	/** Component that used for render overlays such as suggestions, mentions, autocomplete, modal, tooltip and etc */
	Overlay?: ComponentType
	/**
	 * Passed options for configure
	 * @default [{overlayTrigger: '@', markup: '@[__label__](__value__)', data: []}]
	 */
	options?: Option<T>[]
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
	<T = Token>(props: MarkedInputProps<T>): JSX.Element | null

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
