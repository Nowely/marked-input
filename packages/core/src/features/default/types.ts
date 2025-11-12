import {MarkStruct} from '../parsing/ParserV1/types'
import {OverlayTrigger} from '../../shared/types'
import {Markup as ParserV1Markup} from '../parsing/ParserV1'

export interface InnerOption {
	markup: ParserV1Markup
	trigger: string
	data: string[]
}

//TODO Correct inner types
interface MarkedInputProps<T = MarkStruct> {
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
	 * Override props of internal components via react elements
	 * @param div - container
	 * @param span - span
	 */
	children?: any
}

export interface InnerMarkedInputProps extends MarkedInputProps<unknown> {
	options: InnerOption[]
	trigger: OverlayTrigger
	className: string
}
