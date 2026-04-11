import type {Signal} from '../../shared/signals'
import type {CoreOption, CoreSlotProps, CoreSlots} from '../../shared/types'
import type {Token} from '../parsing'
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from './resolveSlot'
import type {SlotName} from './resolveSlot'
import type {MarkSlot, OverlaySlot, Slot} from './types'

function createNamedSlot(
	slots: Signal<CoreSlots | undefined>,
	slotProps: Signal<CoreSlotProps | undefined>,
	name: SlotName
): Slot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
	return {
		use: () => [resolveSlot(name, slots.use()), resolveSlotProps(name, slotProps.use())] as const,
		get: () => [resolveSlot(name, slots()), resolveSlotProps(name, slotProps())] as const,
	} as unknown as Slot
}

function createOverlaySlot(overlay: Signal<unknown>): OverlaySlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
	return {
		use: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay.use(), option, defaultComponent),
		get: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay(), option, defaultComponent),
	} as unknown as OverlaySlot
}

function createMarkSlot(options: Signal<CoreOption[]>, mark: Signal<unknown>, span: Signal<unknown>): MarkSlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
	return {
		use: (token: Token) => resolveMarkSlot(token, options(), mark.use(), span.use()),
		get: (token: Token) => resolveMarkSlot(token, options(), mark(), span()),
	} as unknown as MarkSlot
}

export interface SlotSignals {
	slots: Signal<CoreSlots | undefined>
	slotProps: Signal<CoreSlotProps | undefined>
	Overlay: Signal<unknown>
	options: Signal<CoreOption[]>
	Mark: Signal<unknown>
	Span: Signal<unknown>
}

export function createSlots(signals: SlotSignals) {
	return {
		container: createNamedSlot(signals.slots, signals.slotProps, 'container'),
		block: createNamedSlot(signals.slots, signals.slotProps, 'block'),
		span: createNamedSlot(signals.slots, signals.slotProps, 'span'),
		overlay: createOverlaySlot(signals.Overlay),
		mark: createMarkSlot(signals.options, signals.Mark, signals.Span),
	}
}