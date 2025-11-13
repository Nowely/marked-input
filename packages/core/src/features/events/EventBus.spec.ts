import {beforeEach, describe, expect, it, vi} from 'vitest'
import {EventBus} from '.'
import {EventKey} from '../../shared/types'

describe(`Utility: ${EventBus.name}`, () => {
	let eventBus: EventBus
	let mockListener1: ReturnType<typeof vi.fn<(e: string) => void>>
	let mockListener2: ReturnType<typeof vi.fn<(e: number) => void>>

	// Create mock event keys
	const EVENT_A = Symbol('EVENT_A') as EventKey<string>
	const EVENT_B = Symbol('EVENT_B') as EventKey<number>
	const EVENT_C = Symbol('EVENT_C') as EventKey<string | void>

	beforeEach(() => {
		eventBus = new EventBus()
		mockListener1 = vi.fn<(e: string) => void>()
		mockListener2 = vi.fn<(e: number) => void>()
	})

	describe('constructor', () => {
		it('should create an EventBus instance', () => {
			expect(eventBus).toBeInstanceOf(EventBus)
		})
	})

	describe('on', () => {
		it('should add a listener for an event key', () => {
			const unsubscribe = eventBus.on(EVENT_A, mockListener1)

			expect(typeof unsubscribe).toBe('function')

			eventBus.send(EVENT_A, 'test')
			expect(mockListener1).toHaveBeenCalledWith('test')
			expect(mockListener1).toHaveBeenCalledTimes(1)
		})

		it('should allow multiple listeners for the same event key', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_A, mockListener2)

			eventBus.send(EVENT_A, 'test')

			expect(mockListener1).toHaveBeenCalledWith('test')
			expect(mockListener2).toHaveBeenCalledWith('test')
		})

		it('should allow listeners for different event keys', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_B, mockListener2)

			eventBus.send(EVENT_A, 'hello')
			eventBus.send(EVENT_B, 42)

			expect(mockListener1).toHaveBeenCalledWith('hello')
			expect(mockListener2).toHaveBeenCalledWith(42)
		})

		it('should handle listeners that expect no arguments', () => {
			eventBus.on(EVENT_C, mockListener1)

			eventBus.send(EVENT_C)
			expect(mockListener1).toHaveBeenCalledWith(undefined)

			eventBus.send(EVENT_C, 'ignored')
			expect(mockListener1).toHaveBeenCalledWith('ignored')
		})
	})

	describe('send', () => {
		it('should call all listeners for the event key with the provided value', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_A, mockListener2)

			eventBus.send(EVENT_A, 'test value')

			expect(mockListener1).toHaveBeenCalledWith('test value')
			expect(mockListener2).toHaveBeenCalledWith('test value')
		})

		it('should not call listeners for different event keys', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_B, mockListener2)

			eventBus.send(EVENT_A, 'test')

			expect(mockListener1).toHaveBeenCalledWith('test')
			expect(mockListener2).not.toHaveBeenCalled()
		})

		it('should handle sending without a value', () => {
			eventBus.on(EVENT_A, mockListener1)

			eventBus.send(EVENT_A)

			expect(mockListener1).toHaveBeenCalledWith(undefined)
		})

		it('should handle sending undefined as value', () => {
			eventBus.on(EVENT_A, mockListener1)

			eventBus.send(EVENT_A, undefined)

			expect(mockListener1).toHaveBeenCalledWith(undefined)
		})

		it('should handle multiple send calls', () => {
			eventBus.on(EVENT_A, mockListener1)

			eventBus.send(EVENT_A, 'first')
			eventBus.send(EVENT_A, 'second')
			eventBus.send(EVENT_A, 'third')

			expect(mockListener1).toHaveBeenCalledTimes(3)
			expect(mockListener1).toHaveBeenNthCalledWith(1, 'first')
			expect(mockListener1).toHaveBeenNthCalledWith(2, 'second')
			expect(mockListener1).toHaveBeenNthCalledWith(3, 'third')
		})

	})

	describe('unsubscribe functionality', () => {
		it('should return an unsubscribe function that removes the listener', () => {
			const unsubscribe = eventBus.on(EVENT_A, mockListener1)

			eventBus.send(EVENT_A, 'before')
			expect(mockListener1).toHaveBeenCalledTimes(1)

			unsubscribe()

			eventBus.send(EVENT_A, 'after')
			expect(mockListener1).toHaveBeenCalledTimes(1) // Should not be called again
		})

		it('should allow unsubscribing specific listeners while keeping others', () => {
			const unsubscribe1 = eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_A, mockListener2)

			eventBus.send(EVENT_A, 'both')
			expect(mockListener1).toHaveBeenCalledTimes(1)
			expect(mockListener2).toHaveBeenCalledTimes(1)

			unsubscribe1()

			eventBus.send(EVENT_A, 'only second')
			expect(mockListener1).toHaveBeenCalledTimes(1) // Not called again
			expect(mockListener2).toHaveBeenCalledTimes(2) // Called again
		})

		it('should handle multiple unsubscribes safely', () => {
			const unsubscribe = eventBus.on(EVENT_A, mockListener1)

			unsubscribe()
			unsubscribe() // Should not throw

			eventBus.send(EVENT_A, 'test')
			expect(mockListener1).not.toHaveBeenCalled()
		})
	})

	describe('listener management', () => {
		it('should create separate listener sets for different event keys', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_B, mockListener2)

			eventBus.send(EVENT_A, 'a')
			eventBus.send(EVENT_B, 2)

			expect(mockListener1).toHaveBeenCalledWith('a')
			expect(mockListener2).toHaveBeenCalledWith(2)
		})

		it('should propagate errors thrown by listeners', () => {
			const errorListener = vi.fn(() => {
				throw new Error('Test error')
			})

			eventBus.on(EVENT_A, errorListener)

			expect(() => eventBus.send(EVENT_A, 'test')).toThrow('Test error')
		})

		it('should handle listeners that are added and removed dynamically', () => {
			let callCount = 0
			const dynamicListener = vi.fn(() => {
				callCount++
				if (callCount === 1) {
					eventBus.on(EVENT_A, mockListener2)
				} else if (callCount === 2) {
					eventBus.send(EVENT_A, 'recursive')
				}
			})

			eventBus.on(EVENT_A, dynamicListener)

			eventBus.send(EVENT_A, 'first')

			expect(dynamicListener).toHaveBeenCalledTimes(1)
			expect(mockListener2).toHaveBeenCalledTimes(1)
		})
	})

	describe('edge cases', () => {
		it('should handle Symbol event keys', () => {
			const symbolKey1 = Symbol('test1')
			const symbolKey2 = Symbol('test2')

			eventBus.on(symbolKey1, mockListener1)
			eventBus.on(symbolKey2, mockListener2)

			eventBus.send(symbolKey1, 'value1')
			eventBus.send(symbolKey2, 'value2')

			expect(mockListener1).toHaveBeenCalledWith('value1')
			expect(mockListener2).toHaveBeenCalledWith('value2')
		})

		it('should handle the same listener added multiple times', () => {
			eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_A, mockListener1) // Add the same listener again

			eventBus.send(EVENT_A, 'test')

			// Should still only be called once since it's a Set
			expect(mockListener1).toHaveBeenCalledTimes(1)
		})

		it('should handle unsubscribing a listener that was added multiple times', () => {
			const unsubscribe1 = eventBus.on(EVENT_A, mockListener1)
			eventBus.on(EVENT_A, mockListener1) // Add again (but Set prevents duplicates)

			unsubscribe1() // Should remove the listener completely

			eventBus.send(EVENT_A, 'test')

			// Should not be called since it was completely removed
			expect(mockListener1).not.toHaveBeenCalled()
		})
	})

	describe('isolation between instances', () => {
		it('should not share listeners between different EventBus instances', () => {
			const eventBus2 = new EventBus()

			eventBus.on(EVENT_A, mockListener1)
			eventBus2.on(EVENT_A, mockListener2)

			eventBus.send(EVENT_A, 'bus1')
			eventBus2.send(EVENT_A, 'bus2')

			expect(mockListener1).toHaveBeenCalledWith('bus1')
			expect(mockListener2).toHaveBeenCalledWith('bus2')
		})
	})
})
