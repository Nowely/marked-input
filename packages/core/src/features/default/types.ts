import {OverlayTrigger} from '../../shared/types'
import {Markup} from '../parsing/ParserV2/types'

/**
 * Core option for markups - used internally by core for parsing and triggering
 * Includes data for overlay/suggestions
 */
export interface CoreOption {
	markup?: Markup
	trigger?: string
	data?: string[]
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
	options?: CoreOption[]
	/** Triggering events for overlay */
	trigger?: OverlayTrigger
}
