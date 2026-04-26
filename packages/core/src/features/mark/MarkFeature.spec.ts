import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('MarkFeature', () => {
	it('enabled is false when no Mark is configured', () => {
		const store = new Store()
		expect(store.mark.enabled()).toBe(false)
	})

	it('enabled is true when Mark prop is set', () => {
		const store = new Store()
		store.props.set({Mark: () => null})
		expect(store.mark.enabled()).toBe(true)
	})

	it('exposes enabled and slot', () => {
		const store = new Store()
		expect(typeof store.mark.enabled).toBe('function')
		expect(typeof store.mark.slot).toBe('function')
	})

	describe('disable()', () => {
		it('is safe to call after enable', () => {
			const store = new Store()

			store.mark.enable()

			expect(() => store.mark.disable()).not.toThrow()
		})
	})
})