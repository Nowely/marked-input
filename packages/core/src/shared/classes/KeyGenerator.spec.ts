import {beforeEach, describe, expect, it} from 'vitest'

import {KeyGenerator} from './KeyGenerator'

describe(`Utility: ${KeyGenerator.name}`, () => {
	let keyGenerator: KeyGenerator

	beforeEach(() => {
		keyGenerator = new KeyGenerator()
	})

	describe('constructor', () => {
		it('should create a KeyGenerator instance', () => {
			expect(keyGenerator).toBeInstanceOf(KeyGenerator)
		})
	})

	describe('get', () => {
		it('should return 1 for the first object', () => {
			const obj = {}
			const key = keyGenerator.get(obj)

			expect(key).toBe(1)
		})

		it('should return the same key for the same object', () => {
			const obj = {test: 'value'}
			const key1 = keyGenerator.get(obj)
			const key2 = keyGenerator.get(obj)

			expect(key1).toBe(1)
			expect(key2).toBe(1)
			expect(key1).toBe(key2)
		})

		it('should return different keys for different objects', () => {
			const obj1 = {id: 1}
			const obj2 = {id: 2}
			const obj3 = {id: 3}

			const key1 = keyGenerator.get(obj1)
			const key2 = keyGenerator.get(obj2)
			const key3 = keyGenerator.get(obj3)

			expect(key1).toBe(1)
			expect(key2).toBe(2)
			expect(key3).toBe(3)
		})

		it('should handle various object types', () => {
			const plainObject = {}
			const array = [1, 2, 3]
			const date = new Date()
			const regex = /test/
			const func = () => {}

			const key1 = keyGenerator.get(plainObject)
			const key2 = keyGenerator.get(array)
			const key3 = keyGenerator.get(date)
			const key4 = keyGenerator.get(regex)
			const key5 = keyGenerator.get(func)

			expect(key1).toBe(1)
			expect(key2).toBe(2)
			expect(key3).toBe(3)
			expect(key4).toBe(4)
			expect(key5).toBe(5)
		})

		it('should handle complex nested objects', () => {
			const nested = {
				level1: {
					level2: {
						array: [1, 2, {deep: 'value'}],
					},
				},
			}

			const key = keyGenerator.get(nested)
			expect(key).toBe(1)
		})

		it('should handle the same object passed multiple times', () => {
			const obj = {persistent: true}

			// Get key multiple times
			for (let i = 0; i < 10; i++) {
				const key = keyGenerator.get(obj)
				expect(key).toBe(1)
			}
		})

		it('should maintain separate keys across different KeyGenerator instances', () => {
			const generator2 = new KeyGenerator()
			const obj = {}

			const key1 = keyGenerator.get(obj)
			const key2 = generator2.get(obj)

			expect(key1).toBe(1)
			expect(key2).toBe(1) // Both start from 1
		})

		it('should increment counter for each new object', () => {
			const objects = Array.from({length: 100}, (_, i) => ({index: i}))

			objects.forEach((obj, index) => {
				const key = keyGenerator.get(obj)
				expect(key).toBe(index + 1)
			})
		})
	})

	describe('WeakMap behavior', () => {
		it('should not prevent garbage collection of objects', () => {
			let obj: {temporary: boolean} | null = {temporary: true}
			const key = keyGenerator.get(obj)

			expect(key).toBe(1)

			// Simulate object going out of scope
			// Note: In a real environment, this would allow GC, but we can't test GC directly
			obj = null

			// The WeakMap should still work for new objects
			const newObj = {new: true}
			const newKey = keyGenerator.get(newObj)
			expect(newKey).toBe(2)
		})

		it('should handle object keys that are equal but not the same reference', () => {
			const obj1 = {value: 42}
			const obj2 = {value: 42} // Equal but different object

			const key1 = keyGenerator.get(obj1)
			const key2 = keyGenerator.get(obj2)

			expect(key1).toBe(1)
			expect(key2).toBe(2) // Different key because different object
		})
	})

	describe('edge cases', () => {
		it('should handle empty objects', () => {
			const empty1 = {}
			const empty2 = {}

			const key1 = keyGenerator.get(empty1)
			const key2 = keyGenerator.get(empty2)

			expect(key1).toBe(1)
			expect(key2).toBe(2)
		})

		it('should handle null prototype objects', () => {
			const nullProtoObj = Object.create(null)
			nullProtoObj.test = 'value'

			const key = keyGenerator.get(nullProtoObj)
			expect(key).toBe(1)
		})

		it('should handle frozen objects', () => {
			const frozenObj = Object.freeze({frozen: true})

			const key = keyGenerator.get(frozenObj)
			expect(key).toBe(1)
		})

		it('should handle sealed objects', () => {
			const sealedObj = Object.seal({sealed: true})

			const key = keyGenerator.get(sealedObj)
			expect(key).toBe(1)
		})
	})

	describe('large scale usage', () => {
		it('should handle a large number of objects efficiently', () => {
			const objects: object[] = []

			// Create many objects
			for (let i = 0; i < 1000; i++) {
				objects.push({id: i})
			}

			// Get keys for all objects
			const startTime = Date.now()
			const keys = objects.map(obj => keyGenerator.get(obj))
			const endTime = Date.now()

			// Verify keys are sequential
			keys.forEach((key, index) => {
				expect(key).toBe(index + 1)
			})

			// Verify it completes in reasonable time (less than 100ms for 1000 objects)
			expect(endTime - startTime).toBeLessThan(100)
		})

		it('should reuse keys correctly after many operations', () => {
			const objects: object[] = []

			// Create objects and get keys
			for (let i = 0; i < 50; i++) {
				const obj = {round: 1, index: i}
				objects.push(obj)
				keyGenerator.get(obj)
			}

			// Verify first batch
			objects.forEach((obj, index) => {
				const key = keyGenerator.get(obj)
				expect(key).toBe(index + 1)
			})

			// Create second batch
			const moreObjects: object[] = []
			for (let i = 0; i < 50; i++) {
				const obj = {round: 2, index: i}
				moreObjects.push(obj)
				keyGenerator.get(obj)
			}

			// Verify second batch
			moreObjects.forEach((obj, index) => {
				const key = keyGenerator.get(obj)
				expect(key).toBe(51 + index)
			})
		})
	})

	describe('isolation', () => {
		it('should not share state between instances', () => {
			const gen1 = new KeyGenerator()
			const gen2 = new KeyGenerator()
			const gen3 = new KeyGenerator()

			const obj = {}

			const key1 = gen1.get(obj)
			const key2 = gen2.get(obj)
			const key3 = gen3.get(obj)

			expect(key1).toBe(1)
			expect(key2).toBe(1)
			expect(key3).toBe(1)

			// Each generator should maintain its own counter
			const obj2 = {}
			expect(gen1.get(obj2)).toBe(2)
			expect(gen2.get(obj2)).toBe(2)
			expect(gen3.get(obj2)).toBe(2)
		})
	})
})