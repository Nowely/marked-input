import {describe, it, expect, beforeEach} from 'vitest'

import {setUseHookFactory, signal} from '../../shared/signals'
import type {CoreOption, CoreSlotProps, CoreSlots, GenericComponent} from '../../shared/types'
import {createSlots} from './createSlots'
import type {SlotSignals} from './createSlots'

describe('createSlots', () => {
	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
	})

	function setup(): ReturnType<typeof createSlots> {
		return createSlots({
			slots: signal<CoreSlots | undefined>(undefined),
			slotProps: signal<CoreSlotProps | undefined>(undefined),
			Overlay: signal<GenericComponent | undefined>(undefined),
			options: signal<CoreOption[]>([]),
			Mark: signal<GenericComponent | undefined>(undefined),
			Span: signal<GenericComponent | undefined>(undefined),
		})
	}

	it('should return default container slot', () => {
		const slot = setup()
		expect(slot.container.get()).toEqual(['div', undefined])
	})

	it('should return default block slot', () => {
		const slot = setup()
		expect(slot.block.get()).toEqual(['div', undefined])
	})

	it('should return default span slot', () => {
		const slot = setup()
		expect(slot.span.get()).toEqual(['span', undefined])
	})

	it('should resolve custom container slot', () => {
		const slots = signal<CoreSlots | undefined>(undefined)
		const slotProps = signal<CoreSlotProps | undefined>(undefined)
		const sut = createSlots({
			slots,
			slotProps,
			Overlay: signal<GenericComponent | undefined>(undefined),
			options: signal<CoreOption[]>([]),
			Mark: signal<GenericComponent | undefined>(undefined),
			Span: signal<GenericComponent | undefined>(undefined),
		} satisfies SlotSignals)
		slots.set({container: 'section'})
		expect(sut.container.get()).toEqual(['section', undefined])
	})

	it('should resolve custom slot with props', () => {
		const slots = signal<CoreSlots | undefined>(undefined)
		const slotProps = signal<CoreSlotProps | undefined>(undefined)
		const sut = createSlots({
			slots,
			slotProps,
			Overlay: signal<GenericComponent | undefined>(undefined),
			options: signal<CoreOption[]>([]),
			Mark: signal<GenericComponent | undefined>(undefined),
			Span: signal<GenericComponent | undefined>(undefined),
		} satisfies SlotSignals)
		slots.set({span: 'strong'})
		slotProps.set({span: {className: 'bold'}})
		const [, props] = sut.span.get()
		expect(props).toEqual({className: 'bold'})
	})

	it('should resolve mark slot for text token using hardcoded span fallback', () => {
		const slot = setup()
		const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
		const [component, props] = slot.mark.get(token)
		expect(component).toBe('span')
		expect(props).toEqual({})
	})

	it('should pass value prop to custom Span component for text token', () => {
		const CustomSpan = () => {}
		const slot = createSlots({
			slots: signal<CoreSlots | undefined>(undefined),
			slotProps: signal<CoreSlotProps | undefined>(undefined),
			Overlay: signal<GenericComponent | undefined>(undefined),
			options: signal<CoreOption[]>([]),
			Mark: signal<GenericComponent | undefined>(undefined),
			Span: signal<GenericComponent | undefined>(CustomSpan),
		})
		const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
		const [component, props] = slot.mark.get(token)
		expect(component).toBe(CustomSpan)
		expect(props).toEqual({value: 'hello'})
	})

	it('should throw for mark token without Mark component', () => {
		const slot = setup()
		// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test, token shape is intentionally partial
		const token = {
			type: 'mark',
			value: '@john',
			meta: undefined,
			descriptor: {index: 0},
			position: {start: 0, end: 5},
		} as any
		expect(() => slot.mark.get(token)).toThrow('No mark component found')
	})
})