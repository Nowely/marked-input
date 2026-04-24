import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes current and isControlledMode without last', () => {
		const store = new Store()
		expect(typeof store.value.current).toBe('function')
		expect(typeof store.value.isControlledMode).toBe('function')
		expect('last' in store.value).toBe(false)
		expect(store.value.current()).toBe('')
		expect(store.value.isControlledMode()).toBe(false)
	})

	it('initializes from controlled value on enable', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		store.value.enable()
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('initializes from defaultValue when uncontrolled', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		store.value.enable()
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('exposes event, signal, and computed instances directly', () => {
		const store = new Store()
		expect(typeof store.value.next).toBe('function')
		expect(typeof store.value.current).toBe('function')
		expect(typeof store.value.isControlledMode).toBe('function')
		expect(typeof store.value.change).toBe('function')
	})

	it('controlled next emits without committing current or tokens', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.value.enable()
		store.value.next('world')
		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('controlled next emits repeated identical candidates', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.value.enable()

		store.value.next('world')
		store.value.next('world')

		expect(onChange).toHaveBeenCalledTimes(2)
		expect(onChange).toHaveBeenNthCalledWith(1, 'world')
		expect(onChange).toHaveBeenNthCalledWith(2, 'world')
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('uncontrolled next commits current and tokens', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', onChange})
		store.value.enable()
		store.value.next('world')
		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('controlled prop echo commits current and tokens', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		store.value.enable()
		store.props.set({value: 'world'})
		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('preserves current when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.set({value: 'hello', defaultValue: 'default'})
		store.value.enable()
		store.props.set({value: undefined})
		expect(store.value.isControlledMode()).toBe(false)
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('controlled change emits candidate and restores accepted tokens', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.value.enable()
		store.parsing.tokens([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		store.value.change()
		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		store.value.disable()
	})

	it('uncontrolled change accepts serialized candidate', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', onChange})
		store.value.enable()
		store.parsing.tokens([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		store.value.change()
		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('world')
		store.value.disable()
	})

	describe('change handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
		})

		it('react to change event after enable', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			store.parsing.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.value.enable()

			store.value.change()

			expect(onChange).toHaveBeenCalled()
		})

		it('be idempotent — calling enable twice does not double-subscribe', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			store.parsing.tokens([{type: 'text', content: 'hi', position: {start: 0, end: 2}}])

			store.value.enable()
			store.value.enable()

			store.value.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})

	describe('next handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
		})

		it('parses next and writes tokens + current', () => {
			const onChange = vi.fn()
			store.props.set({onChange, Mark: () => null, options: [{markup: '@[__value__]'}]})

			store.value.enable()

			store.value.next('hello @[world]')

			expect(store.parsing.tokens().length).toBeGreaterThan(0)
			expect(store.value.current()).toBe('hello @[world]')
			expect(onChange).toHaveBeenCalledWith('hello @[world]')
		})
	})

	describe('disable()', () => {
		it('stop reacting to events after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			store.parsing.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.value.enable()
			store.value.disable()

			store.value.change()

			expect(onChange).not.toHaveBeenCalled()
		})

		it('allow re-enabling after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			store.parsing.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.value.enable()
			store.value.disable()
			store.value.enable()

			store.value.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})
})