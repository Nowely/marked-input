import type {ElementType, HTMLAttributes} from 'react'
import type {Store} from '@markput/core'
import {convertDataAttrs} from '@markput/core'

export type SlotName = 'container' | 'span'

const defaultSlots: Record<SlotName, ElementType> = {
	container: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, store: Store): ElementType {
	const slots = store.state.slots.get() as Record<SlotName, ElementType> | undefined
	if (slots?.[slotName]) {
		return slots[slotName]!
	}

	return defaultSlots[slotName]
}

export function resolveSlotProps(slotName: SlotName, store: Store): HTMLAttributes<HTMLElement> | undefined {
	const slotProps = store.state.slotProps.get() as Record<string, unknown> | undefined
	const props = slotProps?.[slotName]
	return props ? (convertDataAttrs(props as Record<string, unknown>) as HTMLAttributes<HTMLElement>) : undefined
}
