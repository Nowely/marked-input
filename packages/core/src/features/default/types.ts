import {OverlayTrigger} from '../../shared/types'
import {Markup} from '../parsing/ParserV2/types'

/**
 * Core option for markups - Framework-agnostic configuration.
 * Extended by framework-specific Option types (e.g., React Option).
 *
 * Architecture:
 * - CoreOption: Contains only markup pattern (framework-independent)
 * - trigger configuration: Handled by framework layer via getTrigger function in TriggerFinder
 * - Separation of concerns: Core focuses on markup parsing, framework handles overlay triggers
 */
export interface CoreOption {
	/**
	 * Template string in which the mark is rendered.
	 * Must contain placeholders: `__value__`, `__meta__`, and/or `__nested__`
	 *
	 * Placeholder types:
	 * - `__value__` - main content (plain text, no nesting)
	 * - `__meta__` - additional metadata (plain text, no nesting)
	 * - `__nested__` - content supporting nested structures
	 *
	 * @example
	 * // Simple value
	 * "@[__value__]"
	 *
	 * @example
	 * // Value with metadata
	 * "@[__value__](__meta__)"
	 *
	 * @example
	 * // Nested content support
	 * "@[__nested__]"
	 */
	markup?: Markup
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
	/** Events that trigger overlay display */
	showOverlayOn?: OverlayTrigger
}
