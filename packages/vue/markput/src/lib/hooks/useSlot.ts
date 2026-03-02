import type {Component, Ref} from 'vue'
import {useStore} from './useStore'
import type {MarkProps, Option, OverlayProps} from '../../types'

export type SlotType = 'mark' | 'overlay'

type MarkSlotReturn = readonly [Component, MarkProps]

type OverlaySlotReturn = readonly [Component, OverlayProps]

export function useSlot(type: 'mark', option?: Option, baseProps?: MarkProps, defaultComponent?: never): MarkSlotReturn

export function useSlot(
	type: 'overlay',
	option?: Option,
	baseProps?: any,
	defaultComponent?: Component
): OverlaySlotReturn

export function useSlot(
	type: SlotType,
	option?: Option,
	baseProps?: any,
	defaultComponent?: Component
): MarkSlotReturn | OverlaySlotReturn {
	const store = useStore()
	const MarkRef = store.state.Mark.use() as Ref<Component | undefined>
	const OverlayRef = store.state.Overlay.use() as Ref<Component | undefined>
	const globalComponent = type === 'mark' ? MarkRef.value : OverlayRef.value

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

	const Comp = (props.slot || globalComponent || defaultComponent) as Component

	if (!Comp) {
		throw new Error(
			`No ${type} component found. ` +
				`Provide either option.${type}.slot, global ${type === 'mark' ? 'Mark' : 'Overlay'}, or a defaultComponent.`
		)
	}

	return [Comp, props]
}
