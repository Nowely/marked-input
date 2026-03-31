import type {CoreOption, CoreSlots, DataAttributes} from '@markput/core'
import type {ComponentType, ElementType, HTMLAttributes, ReactNode} from 'react'

/**
 * Props passed to Mark components.
 */
export interface MarkProps {
	/** Main content value of the mark */
	value?: string
	/** Additional metadata for the mark */
	meta?: string
	/** Rendered children content (ReactNode) for nested marks */
	children?: ReactNode
}

/**
 * Props for Overlay components.
 */
export interface OverlayProps {
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
	/** Per-option component for rendering this mark */
	Mark?: ComponentType<TMarkProps>
	/**
	 * Props for the mark component.
	 * Can be a static object or a function that transforms MarkProps.
	 */
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
	/** Per-option component for rendering this overlay */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Props for the overlay component.
	 */
	overlay?: TOverlayProps
}

/**
 * Available slots for customizing MarkedInput internal components
 */
export interface Slots extends CoreSlots {
	/** Root container component */
	container?: ElementType<HTMLAttributes<HTMLDivElement>>
}

export interface SlotProps {
	container?: HTMLAttributes<HTMLDivElement> & DataAttributes
}