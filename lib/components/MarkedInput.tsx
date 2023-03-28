import {ComponentType, CSSProperties, ForwardedRef, forwardRef, ReactElement} from 'react'
import '../styles.css'
import {MarkedInputHandler, MarkStruct, Option} from '../types'
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
	value: string
	/**
	 * Change event
	 */
	onChange: (value: string) => void
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
	 * @default One option with default values is used
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
	 * Forward props to internal components via react elements
	 * @param div - to container
	 */
	children?: ReactElement | ReactElement[]
}

export interface MarkedInputComponent {
	<T = MarkStruct>(props: MarkedInputProps<T>): JSX.Element | null

	displayName?: string
}

export const _MarkedInput = (props: MarkedInputProps, ref: ForwardedRef<MarkedInputHandler>) => (
	<StoreProvider props={props}>
		<Container/>
		<Whisper/>
		<Featurer inRef={ref}/>
	</StoreProvider>
)

export const MarkedInput = forwardRef(_MarkedInput) as MarkedInputComponent