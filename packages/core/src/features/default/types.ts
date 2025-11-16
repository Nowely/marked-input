import {OverlayTrigger} from '../../shared/types'
import {Markup} from '../parsing/ParserV2/types'

export interface InnerOption {
	markup: Markup
	trigger: string
	data: string[]
}

/**
 * Framework-agnostic core props for MarkedInput
 * Contains only data and configuration, no framework-specific fields
 */
export interface CoreMarkputProps {
	/** Annotated text with markups for mark */
	value?: string
	/** Default value */
	defaultValue?: string
	/** Change event handler */
	onChange?: (value: string) => void
	/** Prevents from changing the value */
	readOnly?: boolean
	/** Configuration options for markups and overlays */
	options: InnerOption[]
	/** Triggering events for overlay */
	trigger?: OverlayTrigger
}
