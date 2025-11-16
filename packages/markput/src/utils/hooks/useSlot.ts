import {ComponentType} from 'react'
import {useStore} from './useStore'
import type {Option} from '../../types'

/**
 * Slot type that can be resolved
 */
export type SlotType = 'mark' | 'overlay'

/**
 * Resolves a slot component and its props with proper fallback chain.
 *
 * Component resolution:
 * 1. option.slots[type]
 * 2. global component (store.props.Mark or store.props.Overlay)
 * 3. throws error if none found
 *
 * Props resolution:
 * 1. If option.slotProps[type] is a function: call with baseProps
 * 2. If option.slotProps[type] is an object: use directly
 * 3. Otherwise: use baseProps as fallback
 *
 * @template T - Type of props for the resolved component
 * @param type - Type of slot: 'mark' or 'overlay'
 * @param option - Option containing per-option slot configuration
 * @param baseProps - Base props to use as fallback or to transform (typically MarkProps for 'mark')
 * @returns Tuple of [Component, props] - Component is guaranteed to exist
 * @throws Error if no component found for the slot type
 *
 * @example
 * // For mark slot
 * const [Mark, props] = useSlot('mark', option, markPropsData)
 * return <Mark {...props} />
 *
 * @example
 * // For overlay slot
 * const [Overlay, props] = useSlot('overlay', overlayMatch?.option)
 * return <Overlay {...props} />
 */
export function useSlot<T = any>(
	type: SlotType,
	option?: Option,
	baseProps?: any
): readonly [ComponentType<T>, T] {

	// Get global component from store
	const globalComponent = useStore(state =>
		type === 'mark' ? state.props.Mark : state.props.Overlay
	)

	// Resolve component: option.slots[type] → global component
	const Component = option?.slots?.[type] || globalComponent

	// Throw error if component not found
	if (!Component) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.slots.${type} or global ${type === 'mark' ? 'Mark' : 'Overlay'} component.`
		)
	}

	// Resolve props based on slotProps configuration
	const slotPropsConfig = option?.slotProps?.[type]

	let props: T

	if (slotPropsConfig !== undefined) {
		// If slotProps is defined, use it
		if (typeof slotPropsConfig === 'function') {
			// If it's a function, transform baseProps
			props = slotPropsConfig(baseProps)
		} else {
			// If it's an object, use it directly
			props = slotPropsConfig as T
		}
	} else {
		// Otherwise, use baseProps as fallback
		props = baseProps ?? ({} as T)
	}

	return [Component, props] as const
}
