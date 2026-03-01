import {describe, it, expect, vi} from 'vitest'
import {defineEvents} from './defineEvents'

describe('Utility: defineEvents', () => {
	describe('emitter creation — schema-based', () => {
		it('should create an emitter for each declared key', () => {
			const events = defineEvents({change: undefined, parse: undefined})
			expect(typeof events.change).toBe('function')
			expect(typeof events.parse).toBe('function')
		})

		it('should expose an on() method on each emitter', () => {
			const events = defineEvents({change: undefined})
			expect(typeof events.change.on).toBe('function')
		})
	})

	describe('emitter creation — schema-less (lazy)', () => {
		it('should produce an emitter for any key even without a schema', () => {
			const events = defineEvents<{custom: string}>()
			expect(typeof events.custom).toBe('function')
			expect(typeof events.custom.on).toBe('function')
		})
	})

	describe('emit without payload', () => {
		it('should fire all subscribers once when called with no arguments', () => {
			const events = defineEvents({ping: undefined})
			const subscriber = vi.fn()
			events.ping.on(subscriber)
			events.ping()
			expect(subscriber).toHaveBeenCalledOnce()
		})
	})

	describe('emit with payload', () => {
		it('should pass the payload to every subscriber', () => {
			const events = defineEvents<{move: {x: number; y: number}}>()
			const subscriber = vi.fn()
			events.move.on(subscriber)
			events.move({x: 3, y: 7})
			expect(subscriber).toHaveBeenCalledWith({x: 3, y: 7})
		})
	})

	describe('on (subscription)', () => {
		it('should call the subscriber when the emitter fires', () => {
			const events = defineEvents({tick: undefined})
			const subscriber = vi.fn()
			events.tick.on(subscriber)
			events.tick()
			expect(subscriber).toHaveBeenCalled()
		})

		it('should return an unsubscribe function that stops future notifications', () => {
			const events = defineEvents({tick: undefined})
			const subscriber = vi.fn()
			const unsubscribe = events.tick.on(subscriber)
			events.tick()
			unsubscribe()
			events.tick()
			expect(subscriber).toHaveBeenCalledOnce()
		})
	})

	describe('multiple subscribers', () => {
		it('should notify all registered subscribers', () => {
			const events = defineEvents({signal: undefined})
			const a = vi.fn()
			const b = vi.fn()
			events.signal.on(a)
			events.signal.on(b)
			events.signal()
			expect(a).toHaveBeenCalled()
			expect(b).toHaveBeenCalled()
		})
	})

	describe('repeated emit', () => {
		it('should fire subscribers on every call regardless of payload equality', () => {
			const events = defineEvents<{update: number}>()
			const subscriber = vi.fn()
			events.update.on(subscriber)
			events.update(1)
			events.update(1) // same value — events bypass equality check
			events.update(1)
			expect(subscriber).toHaveBeenCalledTimes(3)
		})
	})

	describe('emitter identity', () => {
		it('should share the underlying reactive across accesses — subscribe via one reference, emit via another', () => {
			const events = defineEvents<{click: void}>()
			const subscriber = vi.fn()
			// Deliberately access the key twice to get separate emitter objects
			events.click.on(subscriber)
			events.click() // second access — must still trigger the subscriber
			expect(subscriber).toHaveBeenCalledOnce()
		})

		it('should return a new emitter function object on each key access', () => {
			const events = defineEvents({tick: undefined})
			const e1 = events.tick
			const e2 = events.tick
			expect(e1).not.toBe(e2)
		})
	})
})
