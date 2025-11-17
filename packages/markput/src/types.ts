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
// Slot Props Resolution (for runtime use in useSlot)
// ============================================================================

/**
 * Extract mark component props from Option.slots.mark.
 */
type ExtractSlotMarkProps<TOption> = TOption extends {slots?: {mark?: infer TMarkComp}} ? PropsOf<TMarkComp> : never

/**
 * Extract overlay component props from Option.slots.overlay.
 */
type ExtractSlotOverlayProps<TOption> = TOption extends {slots?: {overlay?: infer TOverlayComp}}
	? PropsOf<TOverlayComp>
	: never

/**
 * Helper type for hierarchical fallback with component types.
 */
type InferPropsWithFallback<
	TExtracted,
	TGlobal extends ComponentType<any> | undefined,
	TDefault extends ComponentType<any> | undefined,
	TBase,
> = [TExtracted] extends [never]
	? TGlobal extends ComponentType<any>
		? PropsOf<TGlobal>
		: TDefault extends ComponentType<any>
			? PropsOf<TDefault>
			: TBase
	: TExtracted

/**
 * Unified slot props resolution for both compile-time (Option interface) and runtime (useSlot).
 *
 * Resolution hierarchy:
 * 1. Props from option.slots[type] component (if defined)
 * 2. Props from global component (Mark or Overlay from MarkedInputProps)
 * 3. Props from default component (if provided)
 * 4. Base props type (MarkProps for mark, any for overlay)
 */
export type ResolveSlotProps<
	TType extends 'mark' | 'overlay',
	TOption extends Option<any, any> | undefined,
	TGlobal extends ComponentType<any> | undefined,
	TDefault extends ComponentType<any> | undefined,
> = TType extends 'mark'
	? InferPropsWithFallback<ExtractSlotMarkProps<TOption>, TGlobal, TDefault, MarkProps>
	: InferPropsWithFallback<ExtractSlotOverlayProps<TOption>, TGlobal, TDefault, any>

// ============================================================================
// Option Interface with Automatic Type Inference
// ============================================================================

/**
 * React-specific markup option for defining mark behavior and styling.
 *
 * Type Parameters:
 * - `TMarkProps` - Global mark component props (default: `MarkProps`)
 * - `TOverlayProps` - Global overlay component props (default: `OverlayProps`)
 * - `TSlotMarkProps` - Per-option mark props (default: inherits from `TMarkProps`)
 * - `TSlotOverlayProps` - Per-option overlay props (default: inherits from `TOverlayProps`)
 *
 * @example
 * // Using explicit type parameter
 * const option: Option<ButtonProps> = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }
 * }
 *
 * @example
 * // Using function transformer
 * const option: Option<ButtonProps> = {
 *   slotProps: { mark: (props: MarkProps) => ({ label: props.value }) }
 * }
 */
export interface Option<
	TMarkProps = MarkProps,
	TOverlayProps = OverlayProps,
	TSlotMarkProps = any,
	TSlotOverlayProps = any,
> extends CoreOption {
	/**
	 * Per-option slot components.
	 */
	slots?: {
		/** Mark component for this option. */
		mark?: ComponentType<TSlotMarkProps>
		/** Overlay component for this option. */
		overlay?: ComponentType<TSlotOverlayProps>
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
		overlay?: TOverlayProps | ((props: OverlayProps) => TOverlayProps)
	}
}

/**
 * Helper type for creating options with slot-specific types.
 *
 * @example
 * const option: OptionWithSlots<ButtonProps> = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }
 * }
 */
export type OptionWithSlots<TSlotMarkProps = MarkProps, TSlotOverlayProps = OverlayProps> = Option<
	MarkProps,
	OverlayProps,
	TSlotMarkProps,
	TSlotOverlayProps
>

/**
 * Helper function to create a typed option.
 *
 * @example
 * const tagOption = option<TagProps>()({
 *   markup: '@(__value__)',
 *   slotProps: {
 *     mark: (props: MarkProps) => ({ children: props.value, color: props.value })
 *   }
 * })
 */
export function option<TMarkProps = MarkProps, TOverlayProps = OverlayProps>() {
	return <TSlotMarkProps = TMarkProps, TSlotOverlayProps = TOverlayProps>(
		opt: Option<TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps>
	): Option<TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps> => opt
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
