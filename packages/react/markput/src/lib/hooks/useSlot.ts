import {resolveOptionSlot, resolveSlot, resolveSlotProps} from '@markput/core'
import type {ComponentType, ElementType} from 'react'

import type {MarkProps, Option, OverlayProps} from '../../types'
import {useStore} from '../providers/StoreContext'

export type SlotType = 'mark' | 'overlay' | 'span'

type MarkSlotReturn = readonly [ComponentType<any>, MarkProps]

type OverlaySlotReturn = readonly [ComponentType<any>, OverlayProps]

type SpanSlotReturn = readonly [ElementType, Record<string, unknown> | undefined]

export function useSlot(type: 'mark', option?: Option, baseProps?: MarkProps, defaultComponent?: never): MarkSlotReturn

export function useSlot(
	type: 'overlay',
	option?: Option,
	baseProps?: any,
	defaultComponent?: ComponentType<any>
): OverlaySlotReturn

export function useSlot(type: 'span'): SpanSlotReturn

export function useSlot(
	type: SlotType,
	option?: Option,
	baseProps?: any,
	defaultComponent?: ComponentType<any>
): MarkSlotReturn | OverlaySlotReturn | SpanSlotReturn {
	const store = useStore()

	if (type === 'span') {
		const slots = store.state.slots.use()
		const slotProps = store.state.slotProps.use()
		const Component = resolveSlot<ElementType>('span', slots)
		const props = resolveSlotProps('span', slotProps)
		return [Component, props]
	}

	const Mark = store.state.Mark.use()
	const Overlay = store.state.Overlay.use()
	const globalComponent = (type === 'mark' ? Mark : Overlay) as ComponentType<any> | undefined

	const optionConfig = type === 'mark' ? option?.mark : option?.overlay
	const props = resolveOptionSlot(optionConfig as any, baseProps ?? {})

	const optionComponent = (type === 'mark' ? option?.Mark : option?.Overlay) as ComponentType<any> | undefined
	const Component = (optionComponent || globalComponent || defaultComponent) as ComponentType<any>

	if (!Component) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.${type === 'mark' ? 'Mark' : 'Overlay'}, global ${type === 'mark' ? 'Mark' : 'Overlay'}, or a defaultComponent.`
		)
	}

	return [Component, props]
}