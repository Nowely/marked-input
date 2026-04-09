import {describe, it, expect, beforeEach, vi} from 'vitest'

import {DEFAULT_OPTIONS} from '../../shared/constants'
import {setUseHookFactory, effect} from '../../shared/signals'
import {Store} from './Store'

describe('Store', () => {
	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
	})

	it('should construct with only defaultSpan option', () => {
		const store = new Store({defaultSpan: null})
		expect(store.state.tokens()).toEqual([])
		expect(store.state.readOnly()).toBe(false)
	})

	it('should return default for showOverlayOn when not set', () => {
		const store = new Store({defaultSpan: null})
		expect(store.state.showOverlayOn.get()).toBe('change')
	})

	it('should return default for options when not set', () => {
		const store = new Store({defaultSpan: null})
		expect(store.state.options.get()).toEqual(DEFAULT_OPTIONS)
	})

	it('should have events', () => {
		const store = new Store({defaultSpan: null})
		expect(typeof store.events.parse).toBe('function')
		expect(typeof store.events.change).toBe('function')
		expect(typeof store.events.delete).toBe('function')
	})

	describe('applyValue', () => {
		it('should update tokens and previousValue when parser is undefined', () => {
			const store = new Store({defaultSpan: null})
			store.applyValue('hello')
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
			expect(store.state.previousValue.get()).toBe('hello')
		})

		it('should call onChange when set', () => {
			const store = new Store({defaultSpan: null})
			const onChange = vi.fn()
			store.state.onChange.set(onChange)
			store.applyValue('world')
			expect(onChange).toHaveBeenCalledOnce()
			expect(onChange).toHaveBeenCalledWith('world')
		})

		it('should not throw when onChange is not set', () => {
			const store = new Store({defaultSpan: null})
			expect(() => store.applyValue('test')).not.toThrow()
		})
	})

	describe('createHandler', () => {
		it('should return an object with container, overlay, and focus properties', () => {
			const store = new Store({defaultSpan: null})
			const handler = store.createHandler()
			expect('container' in handler).toBe(true)
			expect('overlay' in handler).toBe(true)
			expect('focus' in handler).toBe(true)
		})

		it('should reflect refs.container via handler.container', () => {
			const store = new Store({defaultSpan: null})
			const handler = store.createHandler()
			expect(handler.container).toBe(null)
			// Assign a stub (no real DOM needed — just a reference check)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLDivElement
			store.refs.container = stub
			expect(handler.container).toBe(stub)
		})

		it('should reflect refs.overlay via handler.overlay', () => {
			const store = new Store({defaultSpan: null})
			const handler = store.createHandler()
			expect(handler.overlay).toBe(null)
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for reference identity check only, no DOM methods used
			const stub = {} as HTMLElement
			store.refs.overlay = stub
			expect(handler.overlay).toBe(stub)
		})

		it('should expose focus as a callable function', () => {
			const store = new Store({defaultSpan: null})
			const handler = store.createHandler()
			expect(typeof handler.focus).toBe('function')
			// focus() with no focus node attached should not throw
			// NodeProxy.head is undefined by default, so focus() is a no-op
		})
	})

	describe('setState', () => {
		it('should update provided state values', () => {
			const store = new Store({defaultSpan: null})
			store.setState({value: 'hello', readOnly: true})
			expect(store.state.value.get()).toBe('hello')
			expect(store.state.readOnly.get()).toBe(true)
		})

		it('should leave unprovided keys unchanged', () => {
			const store = new Store({defaultSpan: null})
			store.setState({readOnly: true})
			expect(store.state.value.get()).toBeUndefined()
			expect(store.state.readOnly.get()).toBe(true)
		})

		it('should not throw when called with an empty object', () => {
			const store = new Store({defaultSpan: null})
			expect(() => store.setState({})).not.toThrow()
		})

		it('should batch updates so effects fire once', () => {
			const store = new Store({defaultSpan: null})
			const effectSpy = vi.fn()
			effect(() => {
				store.state.value.get()
				store.state.readOnly.get()
				effectSpy()
			})
			effectSpy.mockClear()
			store.setState({value: 'hello', readOnly: true})
			expect(effectSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe('slot', () => {
		it('should return default container slot', () => {
			const store = new Store({defaultSpan: null})
			expect(store.slot.container.get()).toEqual(['div', undefined])
		})

		it('should return default block slot', () => {
			const store = new Store({defaultSpan: null})
			expect(store.slot.block.get()).toEqual(['div', undefined])
		})

		it('should return default span slot', () => {
			const store = new Store({defaultSpan: null})
			expect(store.slot.span.get()).toEqual(['span', undefined])
		})

		it('should resolve custom container slot', () => {
			const store = new Store({defaultSpan: null})
			store.state.slots.set({container: 'section'})
			expect(store.slot.container.get()).toEqual(['section', undefined])
		})

		it('should resolve custom slot with props', () => {
			const store = new Store({defaultSpan: null})
			store.state.slots.set({span: 'strong'})
			store.state.slotProps.set({span: {className: 'bold'}})
			const [, props] = store.slot.span.get()
			expect(props).toEqual({className: 'bold'})
		})

		it('should resolve mark slot for text token using defaultSpan', () => {
			const store = new Store({defaultSpan: 'span'})
			const token = {type: 'text', content: 'hello', position: {start: 0, end: 5}} as const
			const [component, props] = store.slot.mark.get(token)
			expect(component).toBe('span')
			expect(props).toEqual({value: 'hello'})
		})

		it('should throw for mark token without Mark component', () => {
			const store = new Store({defaultSpan: null})
			// oxlint-disable-next-line no-unsafe-type-assertion -- minimal stub for test, token shape is intentionally partial
			const token = {
				type: 'mark',
				value: '@john',
				meta: undefined,
				descriptor: {index: 0},
				position: {start: 0, end: 5},
			} as any
			expect(() => store.slot.mark.get(token)).toThrow('No mark component found')
		})
	})
})