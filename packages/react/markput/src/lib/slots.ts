import type {SlotName} from '@markput/core'
import {resolveSlot as resolveSlotCore, resolveSlotProps as resolveSlotPropsCore} from '@markput/core'
import type {ElementType, HTMLAttributes} from 'react'

export function resolveSlot(slotName: SlotName, slots: Parameters<typeof resolveSlotCore>[1]): ElementType {
	return resolveSlotCore(slotName, slots) as ElementType
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: Parameters<typeof resolveSlotPropsCore>[1]
): HTMLAttributes<HTMLElement> | undefined {
	return resolveSlotPropsCore(slotName, slotProps) as HTMLAttributes<HTMLElement> | undefined
}