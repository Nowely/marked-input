import {FunctionComponent, ReactNode} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {MarkToken, Markup} from '@markput/core'

/**
 * Simplified props passed to Mark components via initMark
 */
export interface MarkProps {
	/** Main content value of the mark */
	value?: string
	/** Additional metadata for the mark */
	meta?: string
	/** Nested content as string (raw, unparsed) */
	nested?: string
	/** Rendered children content (ReactNode) for nested marks */
	children?: ReactNode
}

export interface Option<T = Record<string, any>> {
	/**
	 * Template string instead of which the mark is rendered.
	 * Must contain placeholders: `__value__`, `__meta__`, and/or `__nested__`
	 *
	 * Placeholder types:
	 * - `__value__` - main content (plain text, no nesting)
	 * - `__meta__` - additional metadata (plain text, no nesting)
	 * - `__nested__` - content supporting nested structures
	 *
	 * @default "@[__value__](__meta__)"
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
	 *
	 * @example
	 * // HTML-like with nesting
	 * "<__value__>__nested__</__value__>"
	 */
	markup?: Markup
	/**
	 * Sequence of symbols for calling the overlay.
	 * @default "@"
	 */
	trigger?: string //| RegExp
	/**
	 * Data for an overlay component. By default, it is suggestions.
	 */
	data?: string[] //TODO | object[]
	/**
	 * Function to initialize props for the mark component. Gets simplified props with
	 * value, meta, nested content (raw string), and rendered children (ReactNode).
	 *
	 * @param props - Simplified MarkProps with value, meta, nested, and children
	 * @returns Props object for the Mark component
	 *
	 * @example
	 * // Simple props mapping
	 * initMark: ({ value, meta }) => ({ label: value || '', tooltip: meta })
	 *
	 * @example
	 * // With nested content awareness
	 * initMark: ({ value, meta, children }) => ({
	 *   label: value || '',
	 *   tooltip: meta,
	 *   content: children
	 * })
	 *
	 * @example
	 * // Access to raw nested content
	 * initMark: ({ value, nested }) => ({
	 *   label: value || '',
	 *   rawNested: nested // raw unparsed nested content
	 * })
	 */
	initMark?: (props: MarkProps) => T
}

export type ConfiguredMarkedInput<T> = FunctionComponent<MarkedInputProps<T>>

export interface MarkedInputHandler {
	/**
	 * Container element
	 */
	readonly container: HTMLDivElement | null
	/**
	 * Overlay element if exists
	 */
	readonly overlay: HTMLElement | null

	focus(): void
}
