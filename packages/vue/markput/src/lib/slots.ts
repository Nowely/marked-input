import type {CoreSlotProps, CoreSlots, SlotName} from '@markput/core'
import {resolveSlot as resolveSlotCore, resolveSlotProps as resolveSlotPropsCore} from '@markput/core'
import type {Component} from 'vue'

export function resolveSlot(slotName: SlotName, slots: CoreSlots | undefined): string | Component {
	return resolveSlotCore(slotName, slots) as string | Component
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): Record<string, unknown> | undefined {
	return resolveSlotPropsCore(slotName, slotProps)
}