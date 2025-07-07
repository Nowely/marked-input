import {ComponentType, CSSProperties, ForwardedRef, forwardRef, ReactElement} from 'react'
import '../styles.css'
import {DefaultOptions} from '../constants'
import {MarkedInputHandler, MarkStruct, Option, OverlayTrigger} from '../types'
import {Container} from './Container'
import {Featurer} from './Featurer'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'

export interface MarkedInputProps<T = MarkStruct> {
	/**
	 * Ref to handler
	 */
	ref?: ForwardedRef<MarkedInputHandler>
	/**
	 * Annotated text with markups for mark
	 */
	value?: string
	/** Default value */
	defaultValue?: string
	/**
	 * Change event
	 */
	onChange?: (value: string) => void
	/**
	 * Component that used for render markups
	 */
	Mark?: ComponentType<T>
	/**
	 * Component that used for render overlays such as suggestions, mentions, autocomplete, modal, tooltip and etc.
	 */
	Overlay?: ComponentType
	/**
	 * Prevents from changing the value
	 */
	readOnly?: boolean
	/**
	 * Passed options for configure
	 * @default [{trigger: '@', markup: '@[__label__](__value__)', data: []}]
	 */
	options?: Option<T>[]
	/**
	 * Additional classes
	 */
	className?: string
	/**
	 * Additional style
	 */
	style?: CSSProperties
	/**
	 * Override props of internal components via react elements
	 * @param div - container
	 * @param span - span
	 */
	children?: ReactElement | ReactElement[]
	/**
	 * Triggering events for overlay
	 * @default 'change'
	 */
	trigger?: OverlayTrigger
}

export interface MarkedInputComponent {
	<T = MarkStruct>(props: MarkedInputProps<T>): JSX.Element | null

	displayName?: string
}

export const _MarkedInput = (props: MarkedInputProps, ref: ForwardedRef<MarkedInputHandler>) => {
	const propsWithDefault = Object.assign({}, {
		options: DefaultOptions,
		trigger: 'change'
	}, props)

	return (
		<StoreProvider props={propsWithDefault}>
			<Container/>
			<Whisper/>
			<Featurer inRef={ref}/>
		</StoreProvider>
	)
}

export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent