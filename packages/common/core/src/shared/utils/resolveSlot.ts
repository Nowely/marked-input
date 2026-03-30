import type {Token} from '../../features/parsing'
import type {CoreOption, CoreSlotProps, CoreSlots} from '../types'
import {convertDataAttrs} from './dataAttributes'
import {resolveOptionSlot} from './resolveOptionSlot'

export type SlotName = 'container' | 'block' | 'span'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	block: 'div',
	span: 'span',
}

export function resolveSlot(slotName: SlotName, slots: CoreSlots | undefined): string {
	return (slots?.[slotName] ?? defaultSlots[slotName]) as string
}

export function resolveSlotProps(
	slotName: SlotName,
	slotProps: CoreSlotProps | undefined
): Record<string, unknown> | undefined {
	const props = slotProps?.[slotName]
	return props ? convertDataAttrs(props as Record<string, unknown>) : undefined
}

/**
 * Internal view of a framework-specific Option for slot resolution.
 * Framework Option types (React, Vue) extend CoreOption with these properties.
 */
export interface SlotOption extends CoreOption {
	Mark?: unknown
	mark?: unknown
	Overlay?: unknown
	overlay?: unknown
}

export function resolveOverlaySlot(globalComponent: unknown, option?: CoreOption, defaultComponent?: unknown) {
	const slotOption = option as SlotOption | undefined
	const Component = slotOption?.Overlay ?? globalComponent ?? defaultComponent
	if (!Component)
		throw new Error(
			'No overlay component found. Provide either option.Overlay, global Overlay, or a defaultComponent.'
		)
	const props = resolveOptionSlot<Record<string, unknown>>(
		slotOption?.overlay as
			| Record<string, unknown>
			| ((base: Record<string, unknown>) => Record<string, unknown>)
			| undefined,
		{}
	)
	return [Component, props] as const
}

export function resolveMarkSlot(
	token: Token,
	tokenOptions: SlotOption[] | undefined,
	GlobalMark: unknown,
	GlobalSpan: unknown,
	defaultSpan: unknown
) {
	if (token.type === 'text') return [GlobalSpan ?? defaultSpan, {value: token.content}] as const
	const option = tokenOptions?.[token.descriptor.index]
	const baseProps = {value: token.value, meta: token.meta}
	const props = resolveOptionSlot(
		option?.mark as
			| Record<string, unknown>
			| ((base: Record<string, unknown>) => Record<string, unknown>)
			| undefined,
		baseProps
	)
	const Component = option?.Mark ?? GlobalMark
	if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
	return [Component, props] as const
}