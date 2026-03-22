import {resolveOptionSlot, resolveSlot, resolveSlotProps} from '@markput/core'
import type {Component, Ref} from 'vue'

import type {MarkProps, Option, OverlayProps} from '../../types'
import {useStore} from './useStore'

export type SlotType = 'mark' | 'overlay' | 'span'

type MarkSlotReturn = readonly [Component, MarkProps]

type OverlaySlotReturn = readonly [Component, OverlayProps]

type SpanSlotReturn = readonly [Component | string, Record<string, unknown> | undefined]

export function useSlot(type: 'mark', option?: Option, baseProps?: MarkProps, defaultComponent?: never): MarkSlotReturn

export function useSlot(
	type: 'overlay',
	option?: Option,
	baseProps?: any,
	defaultComponent?: Component
): OverlaySlotReturn

export function useSlot(type: 'span'): SpanSlotReturn

export function useSlot(
	type: SlotType,
	option?: Option,
	baseProps?: any,
	defaultComponent?: Component
): MarkSlotReturn | OverlaySlotReturn | SpanSlotReturn {
	const store = useStore()

	if (type === 'span') {
		const slotsRef = store.state.slots.use() as Ref<any>
		const slotPropsRef = store.state.slotProps.use() as Ref<any>
		const Comp = resolveSlot<Component | string>('span', slotsRef.value)
		const props = resolveSlotProps('span', slotPropsRef.value)
		return [Comp, props]
	}

	const MarkRef = store.state.Mark.use() as Ref<Component | undefined>
	const OverlayRef = store.state.Overlay.use() as Ref<Component | undefined>
	const globalComponent = type === 'mark' ? MarkRef.value : OverlayRef.value

	const optionConfig = type === 'mark' ? option?.mark : option?.overlay
	const props = resolveOptionSlot(optionConfig as any, baseProps ?? {})

	const optionComponent = (type === 'mark' ? option?.Mark : option?.Overlay) as Component | undefined
	const Comp = (optionComponent || globalComponent || defaultComponent) as Component

	if (!Comp) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.${type === 'mark' ? 'Mark' : 'Overlay'}, global ${type === 'mark' ? 'Mark' : 'Overlay'}, or a defaultComponent.`
		)
	}

	return [Comp, props]
}