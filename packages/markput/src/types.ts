import {ElementType, FunctionComponent, HTMLAttributes, ReactNode} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {CoreOption} from '@markput/core'

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

/**
 * React-specific markup option extending CoreOption with framework-specific functionality.
 *
 * Inherits from CoreOption:
 * - `markup` - Template string for rendering marks
 * - `overlayTrigger` - Sequence of symbols that trigger the overlay
 * - `data` - Data for overlay component (suggestions, etc.)
 *
 * @example
 * ```typescript
 * const option: Option = {
 *   markup: '@[__value__](__meta__)',
 *   overlayTrigger: '@',
 *   data: ['Alice', 'Bob', 'Charlie'],
 *   initMark: ({ value, meta }) => ({ label: value, tooltip: meta })
 * }
 * ```
 */
export interface Option<T = Record<string, any>> extends CoreOption {
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

/**
 * Available slots for customizing MarkedInput internal components
 */
export interface Slots {
	/**
	 * Root container component
	 * @default 'div'
	 */
	container?: ElementType<HTMLAttributes<HTMLDivElement>>
	/**
	 * Text span component for rendering text tokens
	 * @default 'span'
	 */
	span?: ElementType<HTMLAttributes<HTMLSpanElement>>
}

/**
 * Data attributes with automatic camelCase to kebab-case conversion
 * Keys starting with 'data' followed by camelCase will be converted to data-* attributes
 *
 * @example
 * // Input
 * { dataUserId: '123', dataUserName: 'John' }
 * // Output: data-user-id="123" data-user-name="John"
 */
export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

/**
 * Props for each slot component
 */
export interface SlotProps {
	/**
	 * Props to pass to the container slot.
	 * Supports all standard HTML attributes.
	 * Data attributes can be passed using camelCase keys starting with 'data'.
	 */
	container?: HTMLAttributes<HTMLDivElement> & DataAttributes
	/**
	 * Props to pass to the span slot.
	 * Supports all standard HTML attributes.
	 * Data attributes can be passed using camelCase keys starting with 'data'.
	 */
	span?: HTMLAttributes<HTMLSpanElement> & DataAttributes
}

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
