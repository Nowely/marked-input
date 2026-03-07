import type {CoreSlotProps, CoreSlots, GenericAttributes, GenericElement} from '../types'
import {convertDataAttrs} from './dataAttributes'

export type SlotName = 'container' | 'span'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: CoreSlots | undefined): GenericElement {
	return slots?.[slotName] ?? defaultSlots[slotName]
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): GenericAttributes | undefined {
	const props = slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as GenericAttributes) : undefined
}