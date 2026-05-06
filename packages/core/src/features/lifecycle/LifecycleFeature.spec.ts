import {describe, expect, it, vi} from 'vitest'

import {signal, watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('LifecycleFeature', () => {
	it('exposes mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.lifecycle.mounted).toBe('function')
		expect(typeof store.lifecycle.unmounted).toBe('function')
		expect(typeof store.lifecycle.rendered).toBe('function')
	})

	describe('onMounted()', () => {
		it('runs setup once on mounted', () => {
			const store = new Store()
			const setup = vi.fn()
			store.lifecycle.onMounted(setup)

			expect(setup).not.toHaveBeenCalled()
			store.lifecycle.mounted()
			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('does not re-run setup if mounted fires again without an unmount', () => {
			const store = new Store()
			const setup = vi.fn()
			store.lifecycle.onMounted(setup)

			store.lifecycle.mounted()
			store.lifecycle.mounted()

			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('disposes inner watchers on unmount', () => {
			const store = new Store()
			const source = signal(0)
			const observed = vi.fn()
			store.lifecycle.onMounted(() => {
				watch(source, value => observed(value))
			})

			store.lifecycle.mounted()
			source(1)
			expect(observed).toHaveBeenCalledTimes(1)
			expect(observed).toHaveBeenLastCalledWith(1)

			store.lifecycle.unmounted()
			source(2)
			expect(observed).toHaveBeenCalledTimes(1)
		})

		it('does nothing if registered after mount', () => {
			const store = new Store()
			const setup = vi.fn()
			store.lifecycle.mounted()
			store.lifecycle.onMounted(setup)
			expect(setup).not.toHaveBeenCalled()
		})

		it('re-runs setup with a fresh scope on remount', () => {
			const store = new Store()
			const source = signal(0)
			const observed = vi.fn()
			const setup = vi.fn(() => {
				watch(source, value => observed(value))
			})
			store.lifecycle.onMounted(setup)

			store.lifecycle.mounted()
			source(1)
			store.lifecycle.unmounted()
			store.lifecycle.mounted()
			source(2)

			expect(setup).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenNthCalledWith(1, 1)
			expect(observed).toHaveBeenNthCalledWith(2, 2)
		})
	})
})