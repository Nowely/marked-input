import type {CoreSlotProps, CoreSlots} from '@markput/core'
import {convertDataAttrs} from '@markput/core'

export type SlotName = 'container' | 'span'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: CoreSlots | undefined): string {
	if (slots?.[slotName]) {
		return slots[slotName] as string
	}

	return defaultSlots[slotName]
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): Record<string, unknown> | undefined {
	const props = slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as Record<string, unknown>) : undefined
}
