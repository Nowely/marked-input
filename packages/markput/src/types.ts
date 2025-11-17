import {ComponentType, ElementType, FunctionComponent, HTMLAttributes, ReactNode} from 'react'
import {MarkedInputProps} from './components/MarkedInput'
import {CoreOption} from '@markput/core'

/**
 * Utility type to extract props from a ComponentType.
 * Ensures the extracted props is an object type, not a primitive.
 *
 * @example
 * type ButtonProps = PropsOf<typeof Button> // extracts Button's props
 *
 * @example
 * type InvalidProps = PropsOf<string> // never
 */
export type PropsOf<T> = T extends ComponentType<infer P>
	? P extends object
		? P
		: never
	: never

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
 * Used for autocomplete, suggestions, and similar overlay features.
 */
export interface OverlayProps {
	/** Trigger character(s) that activate the overlay (e.g., '@', '/', '#') */
	trigger?: string
	/** Data array for suggestions/autocomplete */
	data?: string[]
}

// ============================================================================
// Automatic Type Inference Helpers (never-sentinel pattern)
// ============================================================================

/**
 * Check if type is never.
 * Wrapped in tuple to prevent distributive conditional type behavior.
 */
type IsNever<T> = [T] extends [never] ? true : false

/**
 * Extract props from ComponentType with safety checks.
 * Returns never if the component type is invalid or props are not an object.
 */
type ExtractProps<T> = T extends ComponentType<infer P>
	? P extends object
		? P
		: never
	: never

/**
 * Extract mark component props from Option.slots.mark.
 * Returns never if slots.mark is not defined or invalid.
 */
type ExtractSlotMarkProps<TOption> = TOption extends {slots?: {mark?: infer TMarkComp}}
	? ExtractProps<TMarkComp>
	: never

/**
 * Extract overlay component props from Option.slots.overlay.
 * Returns never if slots.overlay is not defined or invalid.
 */
type ExtractSlotOverlayProps<TOption> = TOption extends {slots?: {overlay?: infer TOverlayComp}}
	? ExtractProps<TOverlayComp>
	: never

/**
 * Resolve final mark props type with hierarchical fallback.
 *
 * Resolution order (never-sentinel pattern):
 * 1. If TSlotMarkProps is explicit (not never) → use it
 * 2. Otherwise, try to extract from Option.slots.mark
 * 3. If extraction fails → fallback to TMarkProps (global)
 *
 * This enables automatic type inference: when TSlotMarkProps = never (default),
 * the type is automatically extracted from the component in slots.mark.
 */
type ResolveMarkProps<TOption, TMarkProps, TSlotMarkProps> = IsNever<TSlotMarkProps> extends true
	? ExtractSlotMarkProps<TOption> extends never
		? TMarkProps // Fallback to global
		: ExtractSlotMarkProps<TOption> // Extracted from slots.mark
	: TSlotMarkProps // Explicit type provided

/**
 * Resolve final overlay props type with hierarchical fallback.
 * Same logic as ResolveMarkProps but for overlay slot.
 */
type ResolveOverlayProps<TOption, TOverlayProps, TSlotOverlayProps> = IsNever<TSlotOverlayProps> extends true
	? ExtractSlotOverlayProps<TOption> extends never
		? TOverlayProps // Fallback to global
		: ExtractSlotOverlayProps<TOption> // Extracted from slots.overlay
	: TSlotOverlayProps // Explicit type provided

// ============================================================================
// Option Interface with Automatic Type Inference
// ============================================================================

/**
 * React-specific markup option with **automatic type inference** for slotProps.
 *
 * Inherits from CoreOption:
 * - `markup` - Template string for rendering marks
 *
 * ## Type Parameters
 *
 * - `TMarkProps` - Global mark component props (default: `MarkProps` - base props)
 * - `TOverlayProps` - Global overlay component props (default: `OverlayProps`)
 * - `TSlotMarkProps` - Per-option mark props (default: `never` = auto-infer from slots.mark)
 * - `TSlotOverlayProps` - Per-option overlay props (default: `never` = auto-infer from slots.overlay)
 *
 * ## Automatic Type Inference (NEW!)
 *
 * When `TSlotMarkProps` and `TSlotOverlayProps` use default values (`never`), types are
 * **automatically extracted** from components in `slots`:
 *
 * ```typescript
 * // ✨ Automatic inference - no type parameters needed!
 * const option: Option = {
 *   markup: '@[__value__]',
 *   slots: { mark: Button },  // Button has ButtonProps
 *   slotProps: {
 *     mark: { label: 'Click' }  // ✅ Automatically typed as ButtonProps!
 *   }
 * }
 * ```
 *
 * ## Hierarchical Type Resolution
 *
 * For `slotProps.mark`:
 * 1. If `TSlotMarkProps` is explicitly provided → use it
 * 2. If `slots.mark` component exists → extract props from that component
 * 3. Otherwise → fallback to `TMarkProps` (global mark props)
 *
 * Same logic applies to `slotProps.overlay`.
 *
 * ## Examples
 *
 * @example
 * // Automatic inference (recommended)
 * const option: Option = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }  // ✅ ButtonProps inferred
 * }
 *
 * @example
 * // Explicit type override
 * const option: Option<any, OverlayProps, CustomButtonProps> = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }  // ✅ CustomButtonProps
 * }
 *
 * @example
 * // Fallback to global type (no slot specified)
 * const option: Option<ButtonProps> = {
 *   // No slots.mark
 *   slotProps: { mark: { label: 'Click' } }  // ✅ ButtonProps from TMarkProps
 * }
 *
 * @example
 * // Mixed component types in array
 * const options: Option[] = [
 *   {
 *     slots: { mark: Button },
 *     slotProps: { mark: { label: 'Hi' } }  // ✅ ButtonProps
 *   },
 *   {
 *     slots: { mark: Badge },
 *     slotProps: { mark: { color: 'red' } }  // ✅ BadgeProps
 *   }
 * ]
 *
 * @example
 * // Function transformer with automatic inference
 * const option: Option = {
 *   slots: { mark: Button },
 *   slotProps: {
 *     mark: (props: MarkProps) => ({
 *       label: props.value || 'Default'  // ✅ Returns ButtonProps
 *     })
 *   }
 * }
 */
export interface Option<
	TMarkProps = MarkProps,
	TOverlayProps = OverlayProps,
	TSlotMarkProps = never,
	TSlotOverlayProps = never
> extends CoreOption {
	/**
	 * Per-option slot components.
	 * Component types specified here are automatically extracted for slotProps typing.
	 * If not specified, falls back to global Mark/Overlay components.
	 */
	slots?: {
		/**
		 * Mark component for this option.
		 * Props are automatically inferred for slotProps.mark when TSlotMarkProps = never.
		 * @default MarkedInputProps.Mark
		 */
		mark?: ComponentType<any>
		/**
		 * Overlay component for this option.
		 * Props are automatically inferred for slotProps.overlay when TSlotOverlayProps = never.
		 * @default MarkedInputProps.Overlay
		 */
		overlay?: ComponentType<any>
	}
	/**
	 * Props for slot components with automatic type inference.
	 * Types are resolved hierarchically from slots → explicit params → global params.
	 */
	slotProps?: {
		/**
		 * Props for the mark component.
		 * Type is automatically resolved from:
		 * 1. Explicit TSlotMarkProps (if provided)
		 * 2. Component in slots.mark (if defined)
		 * 3. TMarkProps (global fallback)
		 *
		 * Can be either:
		 * - Static object passed directly to component
		 * - Function that transforms MarkProps into component-specific props
		 *
		 * @example
		 * // Static object (automatic inference from slots.mark)
		 * mark: { label: 'Click me', primary: true }
		 *
		 * @example
		 * // Function transformer (automatic inference)
		 * mark: ({ value, meta }) => ({ label: value || '', tooltip: meta })
		 */
		mark?:
			| ResolveMarkProps<
					Option<TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps>,
					TMarkProps,
					TSlotMarkProps
			  >
			| ((
					props: MarkProps
			  ) => ResolveMarkProps<
					Option<TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps>,
					TMarkProps,
					TSlotMarkProps
			  >)
		/**
		 * Props for the overlay component.
		 * Type is automatically resolved from:
		 * 1. Explicit TSlotOverlayProps (if provided)
		 * 2. Component in slots.overlay (if defined)
		 * 3. TOverlayProps (global fallback)
		 *
		 * @example
		 * overlay: {
		 *   trigger: '@',
		 *   data: ['Alice', 'Bob'],
		 *   maxItems: 5
		 * }
		 */
		overlay?: ResolveOverlayProps<
			Option<TMarkProps, TOverlayProps, TSlotMarkProps, TSlotOverlayProps>,
			TOverlayProps,
			TSlotOverlayProps
		>
	}
}

/**
 * Helper type for creating options with slot-specific types.
 *
 * **NEW**: Now supports automatic inference when type parameters are not provided!
 * - Without parameters: `OptionWithSlots` = auto-infer from slots
 * - With parameters: `OptionWithSlots<ButtonProps>` = explicit typing
 *
 * Note: Uses `MarkProps` as global default for flexibility with per-option slots.
 *
 * @example
 * ```typescript
 * // ✨ Automatic inference (NEW!)
 * const option: OptionWithSlots = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }  // ✅ ButtonProps auto-inferred!
 * }
 *
 * // Explicit typing (still works)
 * const option: OptionWithSlots<ButtonProps> = {
 *   slots: { mark: Button },
 *   slotProps: { mark: { label: 'Click' } }  // ✅ ButtonProps
 * }
 *
 * // With both mark and overlay
 * const option: OptionWithSlots<ButtonProps, CustomOverlayProps> = {
 *   slots: { mark: Button, overlay: CustomOverlay },
 *   slotProps: {
 *     mark: { label: 'Button' },           // ✅ ButtonProps
 *     overlay: { customProp: 'value' }     // ✅ CustomOverlayProps
 *   }
 * }
 * ```
 */
export type OptionWithSlots<TSlotMarkProps = never, TSlotOverlayProps = never> = Option<
	MarkProps,
	OverlayProps,
	TSlotMarkProps,
	TSlotOverlayProps
>

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
