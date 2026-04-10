import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../features/store/Store'
import type {LifecycleAdapter} from './lifecycle-adapter'
import {setLifecycleAdapterFactory, getLifecycleAdapterFactory} from './lifecycle-adapter'
import {setUseHookFactory} from './registry'

vi.mock('../../features/feature-manager', () => ({
	createCoreFeatures: () => ({
		enableAll: vi.fn(),
		disableAll: vi.fn(),
	}),
}))

describe('lifecycle-adapter registry', () => {
	beforeEach(() => {
		// oxlint-disable-next-line no-unsafe-type-assertion -- reset registry to undefined for test isolation
		setLifecycleAdapterFactory(undefined as never)
	})

	it('returns undefined when no factory is registered', () => {
		expect(getLifecycleAdapterFactory()).toBeUndefined()
	})

	it('stores and retrieves the factory', () => {
		const factory = vi.fn()
		setLifecycleAdapterFactory(factory)
		expect(getLifecycleAdapterFactory()).toBe(factory)
	})

	it('overwrites a previously registered factory', () => {
		const first = vi.fn()
		const second = vi.fn()
		setLifecycleAdapterFactory(first)
		setLifecycleAdapterFactory(second)
		expect(getLifecycleAdapterFactory()).toBe(second)
	})
})

describe('Lifecycle.setup()', () => {
	let store: Store

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
	})

	it('wires onMount to enable() and onUnmount to disable()', () => {
		let mountCb: (() => void) | undefined
		let unmountCb: (() => void) | undefined

		const adapter: LifecycleAdapter = {
			onMount: vi.fn(cb => {
				mountCb = cb
			}),
			onUnmount: vi.fn(cb => {
				unmountCb = cb
			}),
			watchPostRender: vi.fn(),
			watchPostCommit: vi.fn(),
		}

		store.lifecycle.setup(adapter)

		expect(adapter.onMount).toHaveBeenCalledOnce()
		expect(adapter.onUnmount).toHaveBeenCalledOnce()

		const enableSpy = vi.spyOn(store.lifecycle, 'enable')
		const disableSpy = vi.spyOn(store.lifecycle, 'disable')

		mountCb!()
		expect(enableSpy).toHaveBeenCalledOnce()

		unmountCb!()
		expect(disableSpy).toHaveBeenCalledOnce()
	})

	it('wires watchPostRender with value, Mark, options deps and syncParser callback', () => {
		const adapter: LifecycleAdapter = {
			onMount: vi.fn(),
			onUnmount: vi.fn(),
			watchPostRender: vi.fn(),
			watchPostCommit: vi.fn(),
		}

		store.lifecycle.setup(adapter)

		expect(adapter.watchPostRender).toHaveBeenCalledOnce()
		// oxlint-disable-next-line no-unsafe-type-assertion -- vi.fn() mock access requires cast
		const [deps, cb] = (adapter.watchPostRender as ReturnType<typeof vi.fn>).mock.calls[0]

		expect(deps).toHaveLength(3)
		expect(deps[0]).toBe(store.state.value)
		expect(deps[1]).toBe(store.state.Mark)
		expect(deps[2]).toBe(store.state.options)

		const syncParserSpy = vi.spyOn(store.lifecycle, 'syncParser')
		cb()
		expect(syncParserSpy).toHaveBeenCalledOnce()
	})

	it('wires watchPostCommit with tokens dep and recoverFocus callback', () => {
		const adapter: LifecycleAdapter = {
			onMount: vi.fn(),
			onUnmount: vi.fn(),
			watchPostRender: vi.fn(),
			watchPostCommit: vi.fn(),
		}

		store.lifecycle.setup(adapter)

		expect(adapter.watchPostCommit).toHaveBeenCalledOnce()
		// oxlint-disable-next-line no-unsafe-type-assertion -- vi.fn() mock access requires cast
		const [dep, cb] = (adapter.watchPostCommit as ReturnType<typeof vi.fn>).mock.calls[0]

		expect(dep).toBe(store.state.tokens)

		const recoverFocusSpy = vi.spyOn(store.lifecycle, 'recoverFocus')
		cb()
		expect(recoverFocusSpy).toHaveBeenCalledOnce()
	})
})