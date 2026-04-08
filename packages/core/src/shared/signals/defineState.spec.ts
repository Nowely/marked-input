import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest'

import {effect} from './alien-signals'
import {defineState} from './defineState'
import {watch} from './signal'

// Helper to track and dispose effects created during tests
let disposers: (() => void)[]

beforeEach(() => {
	disposers = []
	vi.clearAllMocks()
})

afterEach(() => {
	for (const dispose of disposers) dispose()
	disposers = []
})

function trackedEffect(fn: () => void): () => void {
	const dispose = effect(fn)
	disposers.push(dispose)
	return dispose
}

describe('Utility: defineState (signals API)', () => {
	describe('get', () => {
		it('should return the initial value via state.key()', () => {
			const state = defineState({count: 42})
			expect(state.count()).toBe(42)
		})

		it('should return undefined for a key not present in the initial object', () => {
			const state = defineState({count: 0})
			// oxlint-disable-next-line no-unsafe-type-assertion
			expect((state as Record<string, unknown>).missing).toBeUndefined()
		})

		it('should support object and array initial values', () => {
			const obj = {x: 1}
			const arr = [1, 2, 3]
			const state = defineState({obj, arr})
			expect(state.obj()).toBe(obj)
			expect(state.arr()).toEqual([1, 2, 3])
		})

		it('should support .get() as a read alias', () => {
			const state = defineState({name: 'Alice'})
			expect(state.name.get()).toBe('Alice')
		})
	})

	describe('set (write)', () => {
		it('should update the value when called with an argument', () => {
			const state = defineState({name: 'Alice'})
			state.name('Bob')
			expect(state.name()).toBe('Bob')
		})

		it('should support .set() as a write alias', () => {
			const state = defineState({name: 'Alice'})
			state.name.set('Bob')
			expect(state.name()).toBe('Bob')
		})

		it('should notify a watcher when the value changes', () => {
			const state = defineState({value: 0})
			const subscriber = vi.fn()
			const dispose = watch(() => state.value(), subscriber)
			disposers.push(dispose)
			state.value(1)
			expect(subscriber).toHaveBeenCalledOnce()
		})

		it('should NOT notify watchers when the same value is set', () => {
			const ref = {id: 1}
			const state = defineState({ref})
			const subscriber = vi.fn()
			const dispose = watch(() => state.ref(), subscriber)
			disposers.push(dispose)
			state.ref(ref) // same reference
			expect(subscriber).not.toHaveBeenCalled()
		})
	})

	describe('reactive tracking', () => {
		it('should re-run an effect that reads the signal when it changes', () => {
			const state = defineState({n: 0})
			const runs = vi.fn()

			trackedEffect(() => {
				state.n()
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			state.n(1)
			state.n(2)
			expect(runs).toHaveBeenCalledTimes(3)
		})

		it('should stop re-running after the watcher is disposed', () => {
			const state = defineState({n: 0})
			const subscriber = vi.fn()
			const dispose = watch(() => state.n(), subscriber)
			disposers.push(dispose)

			state.n(1)
			dispose()
			state.n(2)
			expect(subscriber).toHaveBeenCalledOnce()
		})

		it('should notify all watchers registered on the same signal', () => {
			const state = defineState({n: 0})
			const a = vi.fn()
			const b = vi.fn()
			const disposeA = watch(() => state.n(), a)
			const disposeB = watch(() => state.n(), b)
			disposers.push(disposeA, disposeB)

			state.n(99)
			expect(a).toHaveBeenCalledOnce()
			expect(b).toHaveBeenCalledOnce()
		})
	})

	describe('state.set (batch)', () => {
		it('should update multiple keys at once', () => {
			const state = defineState({x: 0, y: 0})
			state.set({x: 10, y: 20})
			expect(state.x()).toBe(10)
			expect(state.y()).toBe(20)
		})

		it('should only update the keys that are provided', () => {
			const state = defineState({x: 0, y: 0})
			state.set({x: 5})
			expect(state.x()).toBe(5)
			expect(state.y()).toBe(0)
		})

		it('should silently ignore keys not in the initial state', () => {
			const state = defineState({x: 0})
			// oxlint-disable-next-line no-unsafe-type-assertion
			expect(() => state.set({unknown: 42} as unknown as Parameters<typeof state.set>[0])).not.toThrow()
			expect(state.x()).toBe(0)
		})

		it('should batch — effect reading two signals runs only once after state.set()', () => {
			const state = defineState({x: 0, y: 0})
			const runs = vi.fn()

			trackedEffect(() => {
				state.x()
				state.y()
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			state.set({x: 1, y: 2})
			expect(runs).toHaveBeenCalledTimes(2) // initial + one batched re-run
		})

		it('should not notify subscribers for unchanged values', () => {
			const state = defineState({x: 42, y: 0})
			const subX = vi.fn()
			const subY = vi.fn()
			const disposeX = watch(() => state.x(), subX)
			const disposeY = watch(() => state.y(), subY)
			disposers.push(disposeX, disposeY)

			state.set({x: 42, y: 1}) // x unchanged, y changed
			expect(subX).not.toHaveBeenCalled()
			expect(subY).toHaveBeenCalledOnce()
		})

		it('should not notify any subscriber when all values are unchanged', () => {
			const state = defineState({x: 1, y: 2})
			const subX = vi.fn()
			const subY = vi.fn()
			const disposeX = watch(() => state.x(), subX)
			const disposeY = watch(() => state.y(), subY)
			disposers.push(disposeX, disposeY)

			state.set({x: 1, y: 2})
			expect(subX).not.toHaveBeenCalled()
			expect(subY).not.toHaveBeenCalled()
		})
	})

	describe('signal identity', () => {
		it('should return a stable signal reference on repeated property access', () => {
			const state = defineState({n: 0})
			const ref1 = state.n
			const ref2 = state.n
			expect(ref1).toBe(ref2)
		})

		it('should share the same underlying signal — subscribe and set through different references', () => {
			const state = defineState({n: 0})
			const subscriber = vi.fn()
			// Access signal once to register watcher, then write through a fresh access
			const sig = state.n
			const dispose = watch(() => sig(), subscriber)
			disposers.push(dispose)
			state.n(7)
			expect(subscriber).toHaveBeenCalledOnce()
		})
	})

	describe('custom equals option', () => {
		it('should support per-key custom equals', () => {
			const state = defineState({item: {id: 1, name: 'a'}}, {equals: {item: (a, b) => a.id === b.id}})
			const runs = vi.fn()

			trackedEffect(() => {
				state.item()
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			state.item({id: 1, name: 'changed'}) // same id — should skip
			expect(runs).toHaveBeenCalledTimes(1)
		})

		it('should support equals: false to fire even for the same value', () => {
			const state = defineState({count: 0}, {equals: {count: false}})
			const runs = vi.fn()

			trackedEffect(() => {
				state.count()
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			state.count(0) // same value — should still fire
			expect(runs).toHaveBeenCalledTimes(2)
		})
	})
})