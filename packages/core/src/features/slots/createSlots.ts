import type {Signal} from '../../shared/signals'
import type {CoreOption, CoreSlotProps, CoreSlots, GenericComponent} from '../../shared/types'
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
		get: () => [resolveSlot(name, slots.get()), resolveSlotProps(name, slotProps.get())] as const,
	} as unknown as Slot
}

function createOverlaySlot(overlay: Signal<GenericComponent | undefined>): OverlaySlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
	return {
		use: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay.use(), option, defaultComponent),
		get: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay.get(), option, defaultComponent),
	} as unknown as OverlaySlot
}

function createMarkSlot(
	options: Signal<CoreOption[]>,
	mark: Signal<GenericComponent | undefined>,
	span: Signal<GenericComponent | undefined>,
	getDefaultSpan: () => unknown
): MarkSlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
	return {
		use: (token: Token) => resolveMarkSlot(token, options.get(), mark.use(), span.use(), getDefaultSpan()),
		get: (token: Token) => resolveMarkSlot(token, options.get(), mark.get(), span.get(), getDefaultSpan()),
	} as unknown as MarkSlot
}

export interface SlotSignals {
	slots: Signal<CoreSlots | undefined>
	slotProps: Signal<CoreSlotProps | undefined>
	Overlay: Signal<GenericComponent | undefined>
	options: Signal<CoreOption[]>
	Mark: Signal<GenericComponent | undefined>
	Span: Signal<GenericComponent | undefined>
	getDefaultSpan: () => unknown
}

export function createSlots(signals: SlotSignals) {
	return {
		container: createNamedSlot(signals.slots, signals.slotProps, 'container'),
		block: createNamedSlot(signals.slots, signals.slotProps, 'block'),
		span: createNamedSlot(signals.slots, signals.slotProps, 'span'),
		overlay: createOverlaySlot(signals.Overlay),
		mark: createMarkSlot(signals.options, signals.Mark, signals.Span, signals.getDefaultSpan),
	}
}