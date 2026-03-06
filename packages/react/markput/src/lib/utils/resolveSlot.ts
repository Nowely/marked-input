import type {CoreSlotProps, CoreSlots} from '@markput/core'
import {convertDataAttrs} from '@markput/core'
import type {ElementType, HTMLAttributes} from 'react'

export type SlotName = 'container' | 'span'

const defaultSlots: Record<SlotName, ElementType> = {
	container: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: CoreSlots | undefined): ElementType {
	if (slots?.[slotName]) {
		return slots[slotName] as ElementType
	}

	return defaultSlots[slotName]
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): HTMLAttributes<HTMLElement> | undefined {
	const props = slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as HTMLAttributes<HTMLElement>) : undefined
}