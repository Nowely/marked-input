import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest'

import {effect} from './alien-signals'
import {defineEvents} from './defineEvents'
import {voidEvent, payloadEvent, watch} from './signal'

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

describe('Utility: defineEvents (signals API)', () => {
	describe('schema-based construction', () => {
		it('should return an object with a callable for each declared key', () => {
			const events = defineEvents<{change: void; parse: void}>({
				change: voidEvent(),
				parse: voidEvent(),
			})
			expect(typeof events.change).toBe('function')
			expect(typeof events.parse).toBe('function')
		})

		it('should return the exact same event references that were passed in', () => {
			const ping = voidEvent()
			const events = defineEvents<{ping: void}>({ping})
			expect(events.ping).toBe(ping)
		})

		it('should work with payload events', () => {
			const events = defineEvents<{move: {x: number; y: number}}>({
				move: payloadEvent<{x: number; y: number}>(),
			})
			expect(typeof events.move).toBe('function')
		})
	})

	describe('emit without payload (voidEvent)', () => {
		it('should re-run an effect that subscribed when the event is emitted', () => {
			const events = defineEvents<{ping: void}>({ping: voidEvent()})
			const runs = vi.fn()

			trackedEffect(() => {
				events.ping() // subscribe inside effect
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			events.ping() // emit outside effect
			expect(runs).toHaveBeenCalledTimes(2)
		})

		it('should fire subscribers on every call regardless of previous calls', () => {
			const events = defineEvents<{tick: void}>({tick: voidEvent()})
			const fn = vi.fn()
			const dispose = watch(() => events.tick(), fn)
			disposers.push(dispose)

			events.tick()
			events.tick()
			events.tick()
			expect(fn).toHaveBeenCalledTimes(3)
		})
	})

	describe('emit with payload (payloadEvent)', () => {
		it('should deliver the payload to watchers', () => {
			const events = defineEvents<{move: {x: number; y: number}}>({
				move: payloadEvent<{x: number; y: number}>(),
			})
			let captured: {x: number; y: number} | undefined

			trackedEffect(() => {
				captured = events.move()
			})

			expect(captured).toBeUndefined()
			events.move({x: 3, y: 7})
			expect(captured).toEqual({x: 3, y: 7})
		})

		it('should fire subscribers even when emitting the same payload reference twice', () => {
			const events = defineEvents<{update: {id: number}}>({
				update: payloadEvent<{id: number}>(),
			})
			const payload = {id: 1}
			const runs = vi.fn()

			trackedEffect(() => {
				events.update()
				runs()
			})

			expect(runs).toHaveBeenCalledTimes(1)
			events.update(payload)
			expect(runs).toHaveBeenCalledTimes(2)
			events.update(payload) // same reference — payloadEvent always fires
			expect(runs).toHaveBeenCalledTimes(3)
		})
	})

	describe('subscription via watch()', () => {
		it('should call fn when the event is emitted', () => {
			const events = defineEvents<{tick: void}>({tick: voidEvent()})
			const fn = vi.fn()
			const dispose = watch(() => events.tick(), fn)
			disposers.push(dispose)

			events.tick()
			expect(fn).toHaveBeenCalled()
		})

		it('should NOT call fn on initial setup (skip-first-run)', () => {
			const events = defineEvents<{tick: void}>({tick: voidEvent()})
			const fn = vi.fn()
			const dispose = watch(() => events.tick(), fn)
			disposers.push(dispose)

			expect(fn).not.toHaveBeenCalled()
		})

		it('should stop calling fn after the disposer is invoked', () => {
			const events = defineEvents<{tick: void}>({tick: voidEvent()})
			const fn = vi.fn()
			const dispose = watch(() => events.tick(), fn)
			disposers.push(dispose)

			events.tick()
			dispose()
			events.tick()
			expect(fn).toHaveBeenCalledOnce()
		})
	})

	describe('multiple subscribers', () => {
		it('should notify all registered subscribers when the event fires', () => {
			const events = defineEvents<{signal: void}>({signal: voidEvent()})
			const a = vi.fn()
			const b = vi.fn()
			const disposeA = watch(() => events.signal(), a)
			const disposeB = watch(() => events.signal(), b)
			disposers.push(disposeA, disposeB)

			events.signal()
			expect(a).toHaveBeenCalled()
			expect(b).toHaveBeenCalled()
		})
	})

	describe('event identity', () => {
		it('should return the same event function on repeated property access', () => {
			const events = defineEvents<{tick: void}>({tick: voidEvent()})
			const e1 = events.tick
			const e2 = events.tick
			expect(e1).toBe(e2)
		})

		it('should route subscribe and emit through the same underlying event', () => {
			const events = defineEvents<{click: void}>({click: voidEvent()})
			const fn = vi.fn()

			trackedEffect(() => {
				events.click() // subscribe
				fn()
			})

			expect(fn).toHaveBeenCalledTimes(1)
			events.click() // emit — must re-trigger the same subscriber
			expect(fn).toHaveBeenCalledTimes(2)
		})
	})
})