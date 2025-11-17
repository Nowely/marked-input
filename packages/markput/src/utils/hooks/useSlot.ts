import {ComponentType} from 'react'
import {useStore} from './useStore'
import type {Option, MarkProps, ResolveSlotProps} from '../../types'

/**
 * Slot type that can be resolved
 */
export type SlotType = 'mark' | 'overlay'

/**
 * Helper type for mark slot return value.
 * Simplifies function overload signatures.
 */
type MarkSlotReturn<TOption extends Option<any, any> | undefined> = readonly [
	ComponentType<ResolveSlotProps<'mark', TOption, ComponentType<any> | undefined, undefined>>,
	ResolveSlotProps<'mark', TOption, ComponentType<any> | undefined, undefined>
]

/**
 * Helper type for overlay slot return value.
 * Simplifies function overload signatures.
 */
type OverlaySlotReturn<
	TOption extends Option<any, any> | undefined,
	TDefault extends ComponentType<any> | undefined
> = readonly [
	ComponentType<ResolveSlotProps<'overlay', TOption, ComponentType<any> | undefined, TDefault>>,
	ResolveSlotProps<'overlay', TOption, ComponentType<any> | undefined, TDefault>
]

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
): MarkSlotReturn<TOption>

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
): OverlaySlotReturn<TOption, TDefault>

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
): TType extends 'mark' ? MarkSlotReturn<TOption> : OverlaySlotReturn<TOption, TDefault> {
	// Get global component from store
	const globalComponent = useStore(state =>
		type === 'mark' ? state.props.Mark : state.props.Overlay
	) as ComponentType<any> | undefined

	// Resolve component: option.slots[type] → global component → defaultComponent
	const Component = (option?.slots?.[type] || globalComponent || defaultComponent) as ComponentType<
		ResolveSlotProps<TType, TOption, typeof globalComponent, TDefault>
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

	let props: ResolveSlotProps<TType, TOption, typeof globalComponent, TDefault>

	if (slotPropsConfig !== undefined) {
		// If slotProps is defined, use it
		if (typeof slotPropsConfig === 'function') {
			// If it's a function, transform baseProps
			props = slotPropsConfig(baseProps) as ResolveSlotProps<TType, TOption, typeof globalComponent, TDefault>
		} else {
			// If it's an object, use it directly
			props = slotPropsConfig as ResolveSlotProps<TType, TOption, typeof globalComponent, TDefault>
		}
	} else {
		// Otherwise, use baseProps as fallback
		props = (baseProps ?? {}) as ResolveSlotProps<TType, TOption, typeof globalComponent, TDefault>
	}

	return [Component, props] as unknown as TType extends 'mark' ? MarkSlotReturn<TOption> : OverlaySlotReturn<TOption, TDefault>
}
