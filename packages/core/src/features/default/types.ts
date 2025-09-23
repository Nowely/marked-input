import {MarkStruct, Markup, OverlayTrigger} from '../../shared/types'

export interface InnerOption {
	markup: Markup
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
