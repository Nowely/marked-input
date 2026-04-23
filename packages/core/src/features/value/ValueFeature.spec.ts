import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes previousValue, innerValue signals', () => {
		const store = new Store()
		expect(typeof store.feature.value.previousValue).toBe('function')
		expect(typeof store.feature.value.innerValue).toBe('function')
	})

	it('exposes currentValue computed defaulting to empty string', () => {
		const store = new Store()
		expect(store.feature.value.currentValue()).toBe('')
	})

	it('currentValue falls back to props.value when previousValue is unset', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		expect(store.feature.value.currentValue()).toBe('hello')
	})

	it('currentValue returns previousValue when set', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		store.feature.value.previousValue('world')
		expect(store.feature.value.currentValue()).toBe('world')
	})

	it('exposes signal and computed instances directly', () => {
		const store = new Store()
		expect(typeof store.feature.value.previousValue).toBe('function')
		expect(typeof store.feature.value.innerValue).toBe('function')
		expect(typeof store.feature.value.currentValue).toBe('function')
		expect(typeof store.feature.value.change).toBe('function')
	})

	describe('change handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
		})

		it('react to change event after enable', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			store.feature.parsing.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()

			store.feature.value.change()

			expect(onChange).toHaveBeenCalled()
		})

		it('be idempotent — calling enable twice does not double-subscribe', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			store.feature.parsing.state.tokens([{type: 'text', content: 'hi', position: {start: 0, end: 2}}])

			store.feature.value.enable()
			store.feature.value.enable()

			store.feature.value.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})

	describe('innerValue handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
		})

		it('parses innerValue and writes tokens + previousValue', () => {
			const onChange = vi.fn()
			store.props.set({onChange, Mark: () => null, options: [{markup: '@[__value__]'}]})

			store.feature.value.enable()

			store.feature.value.innerValue('hello @[world]')

			expect(store.feature.parsing.state.tokens().length).toBeGreaterThan(0)
			expect(store.feature.value.previousValue()).toBe('hello @[world]')
			expect(onChange).toHaveBeenCalledWith('hello @[world]')
		})
	})

	describe('disable()', () => {
		it('stop reacting to events after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			store.feature.parsing.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()
			store.feature.value.disable()

			store.feature.value.change()

			expect(onChange).not.toHaveBeenCalled()
		})

		it('allow re-enabling after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			store.feature.parsing.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()
			store.feature.value.disable()
			store.feature.value.enable()

			store.feature.value.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})
})