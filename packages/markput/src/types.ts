import {ComponentType, ElementType, FunctionComponent, HTMLAttributes, ReactNode} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {CoreOption} from '@markput/core'

/**
 * Utility type to extract props from a ComponentType.
 */
export type PropsOf<T> = T extends ComponentType<infer P> ? (P extends object ? P : never) : never

/**
 * Simplified props passed to Mark components via slotProps
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
 * Default props for Overlay components via slotProps.
 */
export interface OverlayProps {
	/** Trigger character(s) that activate the overlay */
	trigger?: string
	/** Data array for suggestions/autocomplete */
	data?: string[]
}

// ============================================================================
// Option Interface with Automatic Type Inference
// ============================================================================

/**
 * React-specific markup option for defining mark behavior and styling.
 *
 * @example
 * const option: Option = {
 *   markup: '@[__value__]',
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }
 * }
 */
export interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreOption {
	/**
	 * Per-option slot components.
	 */
	slots?: {
		/** Mark component for this option. */
		mark?: ComponentType<TMarkProps>
		/** Overlay component for this option. */
		overlay?: ComponentType<TOverlayProps>
	}
	/**
	 * Props for slot components.
	 */
	slotProps?: {
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
}

export type ConfiguredMarkedInput<T> = FunctionComponent<MarkedInputProps<T>>

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

export interface MarkedInputHandler {
	/** Container element */
	readonly container: HTMLDivElement | null
	/** Overlay element if exists */
	readonly overlay: HTMLElement | null

	focus(): void
}
