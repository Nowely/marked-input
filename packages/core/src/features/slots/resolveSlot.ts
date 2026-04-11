import type {CoreOption, CoreSlotProps, CoreSlots} from '../../shared/types'
import {convertDataAttrs} from '../../shared/utils/dataAttributes'
import type {Token} from '../parsing'
import {resolveOptionSlot} from './resolveOptionSlot'

export type SlotName = 'container' | 'block' | 'span'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	block: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: unknown): unknown {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slots` is `CoreSlots | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	return (slots as CoreSlots | undefined)?.[slotName] ?? defaultSlots[slotName]
}

export function resolveSlotProps(slotName: SlotName, slotProps: unknown): Record<string, unknown> | undefined {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slotProps` is `CoreSlotProps | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	const props = (slotProps as CoreSlotProps | undefined)?.[slotName]
	return props ? convertDataAttrs(props) : undefined
}

type SlotProp = Record<string, unknown> | ((base: Record<string, unknown>) => Record<string, unknown>)

/**
 * Internal view of a framework-specific Option for slot resolution.
 * Framework Option types (React, Vue) extend CoreOption with these properties.
 */
export interface SlotOption extends Omit<CoreOption, 'overlay'> {
	Mark?: unknown
	mark?: SlotProp
	Overlay?: unknown
	overlay?: SlotProp
}

export function resolveOverlaySlot(globalComponent: unknown, option?: SlotOption, defaultComponent?: unknown) {
	const Component = option?.Overlay ?? globalComponent ?? defaultComponent
	if (!Component)
		throw new Error(
			'No overlay component found. Provide either option.Overlay, global Overlay, or a defaultComponent.'
		)
	const props = resolveOptionSlot<Record<string, unknown>>(option?.overlay, {})
	return [Component, props] as const
}

export function resolveMarkSlot(
	token: Token,
	tokenOptions: SlotOption[] | undefined,
	GlobalMark: unknown,
	GlobalSpan: unknown
) {
	if (token.type === 'text') {
		return [GlobalSpan ?? 'span', GlobalSpan ? {value: token.content} : {}] as const
	}
	const option = tokenOptions?.[token.descriptor.index]
	const baseProps = {value: token.value, meta: token.meta}
	const props = resolveOptionSlot(option?.mark, baseProps)
	const Component = option?.Mark ?? GlobalMark
	if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
	return [Component, props] as const
}