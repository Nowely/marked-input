import {ComponentType, ElementType, FunctionComponent, HTMLAttributes, ReactNode} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {CoreOption} from '@markput/core'

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
 * React-specific markup option extending CoreOption with framework-specific functionality.
 *
 * Inherits from CoreOption:
 * - `markup` - Template string for rendering marks
 *
 * @example
 * ```typescript
 * // Per-option mark and overlay components
 * const option: Option = {
 *   markup: '@[__value__](__meta__)',
 *   slots: {
 *     mark: Button,
 *     overlay: UserList
 *   },
 *   slotProps: {
 *     mark: ({ value, meta }) => ({ label: value, tooltip: meta }),
 *     overlay: {
 *       trigger: '@',
 *       data: ['Alice', 'Bob', 'Charlie']
 *     }
 *   }
 * }
 *
 * // With static props
 * const option: Option = {
 *   markup: '[...]',
 *   slots: { mark: Badge },
 *   slotProps: {
 *     mark: { label: 'Static', variant: 'dot' }
 *   }
 * }
 * ```
 */
export interface Option<T = Record<string, any>> extends CoreOption {
	/**
	 * Per-option slot components.
	 * If not specified, falls back to global Mark/Overlay components.
	 */
	slots?: {
		/**
		 * Mark component for this option
		 * @default MarkedInputProps.Mark
		 */
		mark?: ComponentType<any>
		/**
		 * Overlay component for this option
		 * @default MarkedInputProps.Overlay
		 */
		overlay?: ComponentType<any>
	}
	/**
	 * Props for slot components. Can be either:
	 * - A static object passed directly to the component
	 * - A function that transforms MarkProps into component-specific props
	 */
	slotProps?: {
		/**
		 * Props for the mark component.
		 * Can be object or function receiving MarkProps.
		 *
		 * @example
		 * // Static object
		 * mark: { label: 'Click me', primary: true }
		 *
		 * @example
		 * // Function for dynamic transformation
		 * mark: ({ value, meta }) => ({ label: value || '', tooltip: meta })
		 */
		mark?: T | ((props: MarkProps) => T)
		/**
		 * Props for the overlay component.
		 *
		 * @example
		 * overlay: {
		 *   trigger: '@',
		 *   data: ['Alice', 'Bob'],
		 *   maxItems: 5
		 * }
		 */
		overlay?: {
			/**
			 * Sequence of symbols for calling the overlay.
			 * @default "@"
			 */
			trigger?: string
			/**
			 * Data for suggestions overlay.
			 */
			data?: string[]
			/**
			 * Additional custom props for overlay component
			 */
			[key: string]: any
		}
	}
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
