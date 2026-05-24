import {describe, expect, it, vi} from 'vitest'

import {signal, watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('Host', () => {
	it('exposes mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.host.mounted).toBe('function')
		expect(typeof store.host.unmounted).toBe('function')
		expect(typeof store.host.rendered).toBe('function')
	})

	it('exposes a container signal initialised to null', () => {
		const store = new Store()
		expect(store.host.container()).toBeNull()
		const el = document.createElement('div')
		store.host.container(el)
		expect(store.host.container()).toBe(el)
		store.host.container(null)
		expect(store.host.container()).toBeNull()
	})

	describe('onMounted()', () => {
		it('runs setup once on mounted', () => {
			const store = new Store()
			const setup = vi.fn()
			store.host.onMounted(setup)

			expect(setup).not.toHaveBeenCalled()
			store.host.mounted()
			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('does not re-run setup if mounted fires again without an unmount', () => {
			const store = new Store()
			const setup = vi.fn()
			store.host.onMounted(setup)

			store.host.mounted()
			store.host.mounted()

			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('disposes inner watchers on unmount', () => {
			const store = new Store()
			const source = signal<number>({initial: 0})
			const observed = vi.fn()
			store.host.onMounted(() => {
				watch(source, value => observed(value))
			})

			store.host.mounted()
			source(1)
			expect(observed).toHaveBeenCalledTimes(1)
			expect(observed).toHaveBeenLastCalledWith(1)

			store.host.unmounted()
			source(2)
			expect(observed).toHaveBeenCalledTimes(1)
		})

		it('does nothing if registered after mount', () => {
			const store = new Store()
			const setup = vi.fn()
			store.host.mounted()
			store.host.onMounted(setup)
			expect(setup).not.toHaveBeenCalled()
		})

		it('re-runs setup with a fresh scope on remount', () => {
			const store = new Store()
			const source = signal<number>({initial: 0})
			const observed = vi.fn()
			const setup = vi.fn(() => {
				watch(source, value => observed(value))
			})
			store.host.onMounted(setup)

			store.host.mounted()
			source(1)
			store.host.unmounted()
			store.host.mounted()
			source(2)

			expect(setup).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenNthCalledWith(1, 1)
			expect(observed).toHaveBeenNthCalledWith(2, 2)
		})
	})
})