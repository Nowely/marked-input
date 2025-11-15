import {OverlayTrigger} from '../../shared/types'
import {Markup} from '../parsing/ParserV2/types'

export interface InnerOption {
	markup: Markup
	trigger: string
	data: string[]
}

//TODO Correct inner types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MarkedInputProps<T = any> {
	/** Ref to handler */
	ref?: any
	/** Annotated text with markups for mark */
	value?: string
	/** Default value */
	defaultValue?: string
	/** Change event */
	onChange?: (value: string) => void
	/** Component that used for render markups */
	Mark?: any
	/** Component that used for render overlays such as suggestions, mentions, autocomplete, modal, tooltip and etc */
	Overlay?: any
	/** Prevents from changing the value */
	readOnly?: boolean
	/** Additional style */
	style?: any
	/**
	 * Override internal components using slots
	 */
	slots?: any
	/**
	 * Props to pass to slot components
	 */
	slotProps?: any
}

export interface InnerMarkedInputProps extends MarkedInputProps<unknown> {
	options: InnerOption[]
	trigger: OverlayTrigger
	className: string
}
