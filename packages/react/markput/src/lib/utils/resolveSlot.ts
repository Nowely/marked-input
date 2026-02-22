import type {ElementType, HTMLAttributes} from 'react'
import type {Store} from '@markput/core'
import {convertDataAttrs} from '@markput/core'
import type {MarkedInputProps} from '../../components/MarkedInput'

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
export function resolveSlot(slotName: SlotName, state: Store<MarkedInputProps>): ElementType {
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
	state: Store<MarkedInputProps>
): HTMLAttributes<HTMLElement> | undefined {
	const props = state.props.slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as HTMLAttributes<HTMLElement>) : undefined
}
