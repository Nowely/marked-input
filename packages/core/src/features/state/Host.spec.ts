import {describe, expect, it, vi} from 'vitest'

import {signal, watch} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('Host', () => {
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
		it('runs setup when container is attached', () => {
			const store = new Store()
			const container = document.createElement('div')
			const setup = vi.fn()
			store.host.onMounted(setup)

			expect(setup).not.toHaveBeenCalled()
			store.host.container(container)
			expect(setup).toHaveBeenCalledTimes(1)
			expect(setup).toHaveBeenCalledWith(container)
		})

		it('does not re-run setup if the same container is set again', () => {
			const store = new Store()
			const container = document.createElement('div')
			const setup = vi.fn()
			store.host.onMounted(setup)

			store.host.container(container)
			store.host.container(container)

			expect(setup).toHaveBeenCalledTimes(1)
		})

		it('disposes inner subscriptions when the container is detached', () => {
			const store = new Store()
			const container = document.createElement('div')
			const source = signal<number>({initial: 0})
			const observed = vi.fn()
			store.host.onMounted(() => {
				watch(source, value => observed(value))
			})

			store.host.container(container)
			source(1)
			expect(observed).toHaveBeenCalledTimes(1)
			expect(observed).toHaveBeenLastCalledWith(1)

			store.host.container(null)
			source(2)
			expect(observed).toHaveBeenCalledTimes(1)
		})

		it('does nothing if registered after the container is already attached', () => {
			const store = new Store()
			const container = document.createElement('div')
			const setup = vi.fn()

			store.host.container(container)
			store.host.onMounted(setup)
			expect(setup).not.toHaveBeenCalled()
		})

		it('re-runs setup with a fresh scope on re-attach', () => {
			const store = new Store()
			const container = document.createElement('div')
			const source = signal<number>({initial: 0})
			const observed = vi.fn()
			const setup = vi.fn(() => {
				watch(source, value => observed(value))
			})
			store.host.onMounted(setup)

			store.host.container(container)
			source(1)
			store.host.container(null)
			store.host.container(container)
			source(2)

			expect(setup).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenNthCalledWith(1, 1)
			expect(observed).toHaveBeenNthCalledWith(2, 2)
		})

		it('re-runs setup with the new container on swap', () => {
			const store = new Store()
			const first = document.createElement('div')
			const second = document.createElement('div')
			const setup = vi.fn()
			store.host.onMounted(setup)

			store.host.container(first)
			expect(setup).toHaveBeenCalledTimes(1)
			expect(setup).toHaveBeenLastCalledWith(first)

			store.host.container(second)
			expect(setup).toHaveBeenCalledTimes(2)
			expect(setup).toHaveBeenLastCalledWith(second)
		})

		it('disposes the previous scope before re-running on container swap', () => {
			const store = new Store()
			const first = document.createElement('div')
			const second = document.createElement('div')
			const source = signal<number>({initial: 0})
			const observed = vi.fn()
			store.host.onMounted(container => {
				watch(source, value => observed(container, value))
			})

			store.host.container(first)
			source(1)
			expect(observed).toHaveBeenCalledWith(first, 1)

			store.host.container(second)
			source(2)
			expect(observed).toHaveBeenCalledTimes(2)
			expect(observed).toHaveBeenLastCalledWith(second, 2)
		})
	})
})