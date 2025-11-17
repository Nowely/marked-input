import {ComponentType} from 'react'
import {useStore} from './useStore'
import type {Option, MarkProps, PropsOf} from '../../types'

/**
 * Slot type that can be resolved
 */
export type SlotType = 'mark' | 'overlay'

/**
 * Extracts the slot component from Option based on slot type.
 * Returns the component type if found, undefined otherwise.
 *
 * @template TType - Slot type ('mark' | 'overlay')
 * @template TOption - Option type with slot configuration
 */
type ExtractSlotComponent<
	TType extends SlotType,
	TOption extends Option<any, any> | undefined
> = TType extends 'mark'
	? TOption extends Option<any, any>
		? TOption['slots'] extends {mark: ComponentType<any>}
			? TOption['slots']['mark']
			: undefined
		: undefined
	: TOption extends Option<any, any>
		? TOption['slots'] extends {overlay: ComponentType<any>}
			? TOption['slots']['overlay']
			: undefined
		: undefined

/**
 * Infers props type for a slot with hierarchical fallback.
 *
 * Type resolution hierarchy:
 * 1. If TOptionSlot is provided (from option.slots[type]), use its props
 * 2. Otherwise, if TGlobal is provided (from global Mark/Overlay), use its props
 * 3. Otherwise, if TDefault is provided (from defaultComponent), use its props
 * 4. Finally, fallback to TBase (typically MarkProps)
 *
 * @template TOptionSlot - Component type from option.slots[type]
 * @template TGlobal - Global component type from store (Mark or Overlay)
 * @template TDefault - Default component type passed to useSlot
 * @template TBase - Base props type (MarkProps for mark, any for overlay)
 */
type InferSlotProps<
	TOptionSlot extends ComponentType<any> | undefined,
	TGlobal extends ComponentType<any> | undefined,
	TDefault extends ComponentType<any> | undefined,
	TBase = any
> = TOptionSlot extends ComponentType<any>
	? PropsOf<TOptionSlot>
	: TGlobal extends ComponentType<any>
		? PropsOf<TGlobal>
		: TDefault extends ComponentType<any>
			? PropsOf<TDefault>
			: TBase

/**
 * Resolves the final props type for a slot.
 * Combines ExtractSlotComponent and InferSlotProps for DRY.
 *
 * @template TType - Slot type ('mark' | 'overlay')
 * @template TOption - Option type with slot configuration
 * @template TGlobal - Global component from store
 * @template TDefault - Default component
 * @template TBase - Base props type
 */
type ResolvedSlotProps<
	TType extends SlotType,
	TOption extends Option<any, any> | undefined,
	TGlobal extends ComponentType<any> | undefined,
	TDefault extends ComponentType<any> | undefined,
	TBase = any
> = InferSlotProps<ExtractSlotComponent<TType, TOption>, TGlobal, TDefault, TBase>

/**
 * Resolves a mark slot component and its props with proper fallback chain.
 *
 * @param type - Must be 'mark'
 * @param option - Option containing per-option slot configuration
 * @param baseProps - MarkProps to use as fallback or to transform
 * @returns Tuple of [MarkComponent, props] - Component is guaranteed to exist
 * @throws Error if no mark component found
 *
 * @example
 * const [Mark, props] = useSlot('mark', option, markPropsData)
 * return <Mark {...props} />
 */
export function useSlot<TOption extends Option<any, any> | undefined = undefined>(
	type: 'mark',
	option?: TOption,
	baseProps?: MarkProps,
	defaultComponent?: never
): readonly [
	ComponentType<ResolvedSlotProps<'mark', TOption, ComponentType<any> | undefined, undefined, MarkProps>>,
	ResolvedSlotProps<'mark', TOption, ComponentType<any> | undefined, undefined, MarkProps>
]

/**
 * Resolves an overlay slot component and its props with proper fallback chain.
 *
 * @param type - Must be 'overlay'
 * @param option - Option containing per-option slot configuration
 * @param baseProps - Base props for overlay (usually undefined)
 * @param defaultComponent - Default overlay component to use as fallback
 * @returns Tuple of [OverlayComponent, props] - Component is guaranteed to exist
 * @throws Error if no overlay component found and no defaultComponent provided
 *
 * @example
 * const [Overlay, props] = useSlot('overlay', overlayMatch?.option, undefined, Suggestions)
 * return <Overlay {...props} />
 */
export function useSlot<
	TOption extends Option<any, any> | undefined = undefined,
	TDefault extends ComponentType<any> | undefined = undefined
>(
	type: 'overlay',
	option?: TOption,
	baseProps?: any,
	defaultComponent?: TDefault
): readonly [
	ComponentType<ResolvedSlotProps<'overlay', TOption, ComponentType<any> | undefined, TDefault, any>>,
	ResolvedSlotProps<'overlay', TOption, ComponentType<any> | undefined, TDefault, any>
]

/**
 * Implementation: Resolves a slot component and its props with proper fallback chain.
 *
 * Component resolution:
 * 1. option.slots[type]
 * 2. global component (store.props.Mark or store.props.Overlay)
 * 3. defaultComponent (if provided)
 * 4. throws error if none found
 *
 * Props resolution:
 * 1. If option.slotProps[type] is a function: call with baseProps
 * 2. If option.slotProps[type] is an object: use directly
 * 3. Otherwise: use baseProps as fallback
 *
 * Type inference hierarchy:
 * 1. Props from option.slots[type] component
 * 2. Props from global Mark/Overlay component
 * 3. Props from defaultComponent
 * 4. Fallback to baseProps type (MarkProps for 'mark')
 */
export function useSlot<
	TType extends SlotType,
	TOption extends Option<any, any> | undefined = undefined,
	TDefault extends ComponentType<any> | undefined = undefined
>(
	type: TType,
	option?: TOption,
	baseProps?: TType extends 'mark' ? MarkProps : any,
	defaultComponent?: TDefault
): readonly [
	ComponentType<ResolvedSlotProps<TType, TOption, ComponentType<any> | undefined, TDefault, TType extends 'mark' ? MarkProps : any>>,
	ResolvedSlotProps<TType, TOption, ComponentType<any> | undefined, TDefault, TType extends 'mark' ? MarkProps : any>
] {
	// Get global component from store
	const globalComponent = useStore(state =>
		type === 'mark' ? state.props.Mark : state.props.Overlay
	) as ComponentType<any> | undefined

	// Define base props type for type inference
	type BasePropsType = TType extends 'mark' ? MarkProps : any

	// Resolve component: option.slots[type] → global component → defaultComponent
	const Component = (option?.slots?.[type] || globalComponent || defaultComponent) as ComponentType<
		ResolvedSlotProps<TType, TOption, typeof globalComponent, TDefault, BasePropsType>
	>

	// Throw error if component not found
	if (!Component) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.slots.${type}, global ${type === 'mark' ? 'Mark' : 'Overlay'}, or a defaultComponent.`
		)
	}

	// Resolve props based on slotProps configuration
	const slotPropsConfig = option?.slotProps?.[type]

	let props: ResolvedSlotProps<TType, TOption, typeof globalComponent, TDefault, BasePropsType>

	if (slotPropsConfig !== undefined) {
		// If slotProps is defined, use it
		if (typeof slotPropsConfig === 'function') {
			// If it's a function, transform baseProps
			props = slotPropsConfig(baseProps) as ResolvedSlotProps<TType, TOption, typeof globalComponent, TDefault, BasePropsType>
		} else {
			// If it's an object, use it directly
			props = slotPropsConfig as ResolvedSlotProps<TType, TOption, typeof globalComponent, TDefault, BasePropsType>
		}
	} else {
		// Otherwise, use baseProps as fallback
		props = (baseProps ?? {}) as ResolvedSlotProps<TType, TOption, typeof globalComponent, TDefault, BasePropsType>
	}

	return [Component, props] as const
}
