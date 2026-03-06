import type {CoreOption} from '@markput/core'
import type {ComponentType, ElementType, HTMLAttributes, ReactNode} from 'react'

/**
 * Props passed to Mark components.
 */
export interface MarkProps {
	/** Custom component to render this mark */
	slot?: ComponentType<MarkProps>
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
 * Props for Overlay components.
 */
export interface OverlayProps {
	/** Custom component to render this overlay */
	slot?: ComponentType<OverlayProps>
	/** Trigger character(s) that activate the overlay */
	trigger?: string
	/** Data array for suggestions/autocomplete */
	data?: string[]
}

// ============================================================================
// Option Interface
// ============================================================================

/**
 * React-specific markup option for defining mark behavior and styling.
 *
 * @template TMarkProps - Type of props for the mark component
 * @template TOverlayProps - Type of props for the overlay component
 *
 * @example
 * const option: Option<ChipProps> = {
 *   markup: '@[__value__]',
 *   mark: { slot: Chip, label: 'Click' }
 * }
 */
export interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreOption {
	/**
	 * Props for the mark component.
	 * Can be a static object or a function that transforms MarkProps.
	 */
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
	/**
	 * Props for the overlay component.
	 */
	overlay?: TOverlayProps
}

/**
 * Available slots for customizing MarkedInput internal components
 */
export interface Slots {
	/** Root container component */
	container?: ElementType<HTMLAttributes<HTMLDivElement>>
	/** Text span component for rendering text tokens */
	span?: ElementType<HTMLAttributes<HTMLSpanElement>>
}

/**
 * Data attributes with automatic camelCase to kebab-case conversion
 */
export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

/**
 * Props for each slot component
 */
export interface SlotProps {
	/** Props to pass to the container slot */
	container?: HTMLAttributes<HTMLDivElement> & DataAttributes
	/** Props to pass to the span slot */
	span?: HTMLAttributes<HTMLSpanElement> & DataAttributes
}