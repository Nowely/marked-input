import type {ComponentType} from 'react'

import type {MarkProps, Option, OverlayProps} from '../../types'
import {useStore} from '../providers/StoreContext'

export type SlotType = 'mark' | 'overlay'

type MarkSlotReturn = readonly [ComponentType<any>, MarkProps]

type OverlaySlotReturn = readonly [ComponentType<any>, OverlayProps]

export function useSlot(type: 'mark', option?: Option, baseProps?: MarkProps, defaultComponent?: never): MarkSlotReturn

export function useSlot(
	type: 'overlay',
	option?: Option,
	baseProps?: any,
	defaultComponent?: ComponentType<any>
): OverlaySlotReturn

export function useSlot(
	type: SlotType,
	option?: Option,
	baseProps?: any,
	defaultComponent?: ComponentType<any>
): MarkSlotReturn | OverlaySlotReturn {
	const store = useStore()
	const Mark = store.state.Mark.use()
	const Overlay = store.state.Overlay.use()
	const globalComponent = (type === 'mark' ? Mark : Overlay) as ComponentType<any> | undefined

	const optionConfig = type === 'mark' ? option?.mark : option?.overlay
	let props: any

	if (optionConfig !== undefined) {
		if (typeof optionConfig === 'function') {
			props = optionConfig(baseProps)
		} else {
			props = optionConfig
		}
	} else {
		props = baseProps ?? {}
	}

	const Component = (props.slot || globalComponent || defaultComponent) as ComponentType<any>

	if (!Component) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.${type}.slot, global ${type === 'mark' ? 'Mark' : 'Overlay'}, or a defaultComponent.`
		)
	}

	return [Component, props]
}