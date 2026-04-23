import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes previousValue, innerValue signals', () => {
		const store = new Store()
		expect(typeof store.feature.value.state.previousValue).toBe('function')
		expect(typeof store.feature.value.state.innerValue).toBe('function')
	})

	it('exposes currentValue computed defaulting to empty string', () => {
		const store = new Store()
		expect(store.feature.value.computed.currentValue()).toBe('')
	})

	it('currentValue falls back to props.value when previousValue is unset', () => {
		const store = new Store()
		store.setProps({value: 'hello'})
		expect(store.feature.value.computed.currentValue()).toBe('hello')
	})

	it('currentValue returns previousValue when set', () => {
		const store = new Store()
		store.setProps({value: 'hello'})
		store.feature.value.state.previousValue('world')
		expect(store.feature.value.computed.currentValue()).toBe('world')
	})

	it('aliases the same signal instances as the legacy store.state maps during migration', () => {
		const store = new Store()
		expect(store.feature.value.state.previousValue).toBe(store.state.previousValue)
		expect(store.feature.value.state.innerValue).toBe(store.state.innerValue)
		expect(store.feature.value.computed.currentValue).toBe(store.computed.currentValue)
		expect(store.feature.value.emit.change).toBe(store.emit.change)
	})

	describe('change handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
		})

		it('react to change event after enable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()

			store.emit.change()

			expect(onChange).toHaveBeenCalled()
		})

		it('be idempotent — calling enable twice does not double-subscribe', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hi', position: {start: 0, end: 2}}])

			store.feature.value.enable()
			store.feature.value.enable()

			store.emit.change()

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
			store.setProps({onChange, Mark: () => null, options: [{markup: '@[__value__]'}]})

			store.feature.value.enable()

			store.feature.value.state.innerValue('hello @[world]')

			expect(store.state.tokens().length).toBeGreaterThan(0)
			expect(store.state.previousValue()).toBe('hello @[world]')
			expect(onChange).toHaveBeenCalledWith('hello @[world]')
		})
	})

	describe('disable()', () => {
		it('stop reacting to events after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()
			store.feature.value.disable()

			store.emit.change()

			expect(onChange).not.toHaveBeenCalled()
		})

		it('allow re-enabling after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.value.enable()
			store.feature.value.disable()
			store.feature.value.enable()

			store.emit.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})
})