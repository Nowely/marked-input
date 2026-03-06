import {beforeEach, describe, it, expect, vi} from 'vitest'

import {defineState} from './defineState'
import type {Signal, UseHookFactory} from './defineState'

describe('Utility: defineState', () => {
	const createUseHook: UseHookFactory = vi.fn(signal => vi.fn(() => signal.get()))

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('get', () => {
		it('should return the initial value via signal.get()', () => {
			const state = defineState({count: 42}, createUseHook)
			expect(state.count.get()).toBe(42)
		})

		it('should return undefined for a key not present in the initial object', () => {
			const state = defineState({count: 0} as any, createUseHook)
			expect((state as any).missing).toBeUndefined()
		})

		it('should support object and array initial values', () => {
			const obj = {x: 1}
			const arr = [1, 2, 3]
			const state = defineState({obj, arr}, createUseHook)
			expect(state.obj.get()).toBe(obj)
			expect(state.arr.get()).toEqual([1, 2, 3])
		})
	})

	describe('signal.set', () => {
		it('should update the value returned by signal.get()', () => {
			const state = defineState({name: 'Alice'}, createUseHook)
			state.name.set('Bob')
			expect(state.name.get()).toBe('Bob')
		})

		it('should notify subscriber when the value changes', () => {
			const state = defineState({value: 0}, createUseHook)
			const subscriber = vi.fn()
			state.value.on(subscriber)
			state.value.set(1)
			expect(subscriber).toHaveBeenCalledOnce()
			expect(subscriber).toHaveBeenCalledWith(1)
		})

		it('should NOT notify subscribers when the same reference is set', () => {
			const ref = {id: 1}
			const state = defineState({ref}, createUseHook)
			const subscriber = vi.fn()
			state.ref.on(subscriber)
			state.ref.set(ref) // same reference
			expect(subscriber).not.toHaveBeenCalled()
		})
	})

	describe('signal.on (subscription)', () => {
		it('should call the subscriber each time the value changes', () => {
			const state = defineState({n: 0}, createUseHook)
			const subscriber = vi.fn()
			state.n.on(subscriber)
			state.n.set(1)
			state.n.set(2)
			expect(subscriber).toHaveBeenCalledTimes(2)
		})

		it('should return an unsubscribe function that stops future notifications', () => {
			const state = defineState({n: 0}, createUseHook)
			const subscriber = vi.fn()
			const unsubscribe = state.n.on(subscriber)
			state.n.set(1)
			unsubscribe()
			state.n.set(2)
			expect(subscriber).toHaveBeenCalledOnce()
		})

		it('should notify all registered subscribers', () => {
			const state = defineState({n: 0}, createUseHook)
			const a = vi.fn()
			const b = vi.fn()
			state.n.on(a)
			state.n.on(b)
			state.n.set(99)
			expect(a).toHaveBeenCalledWith(99)
			expect(b).toHaveBeenCalledWith(99)
		})
	})

	describe('state.set (batch)', () => {
		it('should update multiple keys at once', () => {
			const state = defineState({x: 0, y: 0}, createUseHook)
			state.set({x: 10, y: 20})
			expect(state.x.get()).toBe(10)
			expect(state.y.get()).toBe(20)
		})

		it('should only update the keys that are provided', () => {
			const state = defineState({x: 0, y: 0}, createUseHook)
			state.set({x: 5})
			expect(state.x.get()).toBe(5)
			expect(state.y.get()).toBe(0)
		})

		it('should silently ignore keys not in the initial state', () => {
			const state = defineState({x: 0} as any, createUseHook)
			expect(() => state.set({unknown: 42} as any)).not.toThrow()
			expect(state.x.get()).toBe(0)
		})
	})

	describe('signal identity', () => {
		it('should share the same underlying reactive when the same key is accessed twice', () => {
			const state = defineState({n: 0}, createUseHook)
			// Subscribe via first access, set via second — both must work together
			const subscriber = vi.fn()
			state.n.on(subscriber)
			state.n.set(7)
			expect(subscriber).toHaveBeenCalledWith(7)
		})
	})

	describe('use property', () => {
		it('should call createUseHook with the signal when the signal is first accessed', () => {
			const state = defineState({n: 0}, createUseHook)
			const signal: Signal<number> = state.n
			expect(createUseHook).toHaveBeenCalledWith(signal)
		})

		it('should assign the return value of createUseHook to signal.use', () => {
			const useHook = vi.fn()
			const factory: UseHookFactory = vi.fn(() => useHook)
			const state = defineState({n: 0}, factory)
			expect(state.n.use).toBe(useHook)
		})
	})
})