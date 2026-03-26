import type {CoreSlotProps, CoreSlots} from '../types'
import {convertDataAttrs} from './dataAttributes'

export type SlotName = 'container' | 'block' | 'span'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	block: 'div',
	span: 'span',
}

export function resolveSlot<T = string>(slotName: SlotName, slots: CoreSlots | undefined): T {
	return (slots?.[slotName] ?? defaultSlots[slotName]) as T
}

export function resolveSlotProps<T = Record<string, unknown>>(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): T | undefined {
	const props = slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as T) : undefined
}