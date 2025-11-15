import {CSSProperties, ElementType, HTMLAttributes} from 'react'
import {Store} from '@markput/core'
import {convertDataAttrs} from './dataAttributes'

/**
 * Slot names that can be customized
 */
export type SlotName = 'container' | 'span'

/**
 * Default components for each slot
 */
const defaultSlots: Record<SlotName, ElementType> = {
	container: 'div',
	span: 'span',
}

/**
 * Resolves the component to use for a given slot.
 * Priority: slots > default
 *
 * @param slotName - Name of the slot to resolve
 * @param state - Store state
 * @returns Component to use for the slot
 */
export function resolveSlot(slotName: SlotName, state: Store): ElementType {
	// Check if slots prop has this slot defined
	if (state.props.slots?.[slotName]) {
		return state.props.slots[slotName]!
	}

	// Default slot component
	return defaultSlots[slotName]
}

/**
 * Resolves props to pass to a slot component.
 * Automatically converts camelCase data attribute keys to kebab-case.
 *
 * @param slotName - Name of the slot
 * @param state - Store state
 * @returns Props object to spread onto the component
 */
export function resolveSlotProps(
	slotName: SlotName,
	state: Store
): HTMLAttributes<HTMLElement> | undefined {
	const props = state.props.slotProps?.[slotName]
	return props ? convertDataAttrs(props) : undefined
}

/**
 * Merges multiple class names, filtering out falsy values
 *
 * @param classes - Class names to merge (strings, undefined, null, false)
 * @returns Merged class name string or undefined if all values are falsy
 */
export function mergeClassNames(...classes: (string | undefined | null | false)[]): string | undefined {
	return classes.filter(Boolean).join(' ') || undefined
}

/**
 * Merges multiple style objects, with later values overriding earlier ones
 *
 * @param styles - Style objects to merge (CSSProperties, undefined, null, false)
 * @returns Merged style object or undefined if all values are falsy
 */
export function mergeStyles(...styles: (CSSProperties | undefined | null | false)[]): CSSProperties | undefined {
	const merged = styles.reduce<CSSProperties>((acc, style) => {
		if (style) {
			Object.assign(acc, style)
		}
		return acc
	}, {})

	return Object.keys(merged).length > 0 ? merged : undefined
}

