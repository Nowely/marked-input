import {describe, expect, it} from 'vitest'

import {shallow} from './shallow'

describe(`Utility: ${shallow.name}`, () => {
	describe('primitive values', () => {
		it('should return true for identical primitives', () => {
			expect(shallow(5, 5)).toBe(true)
			expect(shallow('hello', 'hello')).toBe(true)
			expect(shallow(true, true)).toBe(true)
			expect(shallow(null, null)).toBe(true)
			expect(shallow(undefined, undefined)).toBe(true)
		})

		it('should return false for different primitives', () => {
			expect(shallow(5, 6)).toBe(false)
			expect(shallow('hello', 'world')).toBe(false)
			expect(shallow(true, false)).toBe(false)
			expect(shallow(null, undefined)).toBe(false)
		})

		it('should handle special values', () => {
			expect(shallow(NaN, NaN)).toBe(true)
			expect(shallow(0, -0)).toBe(false)
			expect(shallow(-0, -0)).toBe(true)
		})
	})

	describe('same object reference', () => {
		it('should return true for the same object', () => {
			const obj = {a: 1}
			expect(shallow(obj, obj)).toBe(true)
		})

		it('should return true for the same array', () => {
			const arr = [1, 2, 3]
			expect(shallow(arr, arr)).toBe(true)
		})
	})

	describe('object comparison', () => {
		it('should return true for objects with same properties and values', () => {
			const obj1 = {a: 1, b: 2}
			const obj2 = {a: 1, b: 2}
			expect(shallow(obj1, obj2)).toBe(true)
		})

		it('should return false for objects with different property values', () => {
			const obj1 = {a: 1, b: 2}
			const obj2 = {a: 1, b: 3}
			expect(shallow(obj1, obj2)).toBe(false)
		})

		it('should return false for objects with different properties', () => {
			const obj1 = {a: 1, b: 2}
			const obj2 = {a: 1, c: 2} as Record<string, number>
			expect(shallow(obj1, obj2)).toBe(false)
		})

		it('should return false for objects with different number of properties', () => {
			const obj1 = {a: 1, b: 2}
			const obj2 = {a: 1, b: 2, c: 3}
			expect(shallow(obj1, obj2)).toBe(false)
		})

		it('should handle empty objects', () => {
			expect(shallow({}, {})).toBe(true)
			expect(shallow({}, {a: 1})).toBe(false)
		})

		it('should handle nested objects (shallow comparison)', () => {
			const nested = {deep: 'value'}
			const obj1 = {a: nested}
			const obj2 = {a: nested}
			expect(shallow(obj1, obj2)).toBe(true)
		})

		it('should return false when nested objects are different references', () => {
			const obj1 = {a: {deep: 'value'}}
			const obj2 = {a: {deep: 'value'}}
			expect(shallow(obj1, obj2)).toBe(false)
		})
	})

	describe('array comparison', () => {
		it('should return true for arrays with same elements', () => {
			expect(shallow([1, 2, 3], [1, 2, 3])).toBe(true)
		})

		it('should return false for arrays with different elements', () => {
			expect(shallow([1, 2, 3], [1, 2, 4])).toBe(false)
		})

		it('should return false for arrays with different lengths', () => {
			expect(shallow([1, 2], [1, 2, 3])).toBe(false)
		})

		it('should handle empty arrays', () => {
			expect(shallow([], [])).toBe(true)
		})
	})

	describe('mixed types', () => {
		it('should return false when comparing object to non-object', () => {
			expect(shallow({}, null as any)).toBe(false)
			expect(shallow({}, undefined as any)).toBe(false)
			expect(shallow({}, 5 as any)).toBe(false)
			expect(shallow({}, 'string' as any)).toBe(false)
		})

		it('should return true when comparing empty array and empty object', () => {
			// Both have no enumerable keys, so they're considered shallow equal
			expect(shallow([], {})).toBe(true)
			expect(shallow({}, [])).toBe(true)
		})
	})

	describe('property order', () => {
		it('should return true regardless of property order', () => {
			const obj1 = {a: 1, b: 2}
			const obj2 = {b: 2, a: 1}
			expect(shallow(obj1, obj2)).toBe(true)
		})
	})

	describe('prototype and inheritance', () => {
		it('should only compare own properties', () => {
			function Constructor(this: any) {
				this.ownProp = 'value'
			}
			Constructor.prototype.inheritedProp = 'inherited'

			const obj1 = new (Constructor as any)()
			const obj2 = {ownProp: 'value'}

			expect(shallow(obj1, obj2)).toBe(true)
		})

		it('should handle null prototype objects', () => {
			const obj1 = Object.create(null)
			obj1.a = 1
			const obj2 = Object.create(null)
			obj2.a = 1

			expect(shallow(obj1, obj2)).toBe(true)
		})
	})

	describe('special values', () => {
		it('should handle objects with undefined values', () => {
			expect(shallow({a: undefined}, {a: undefined})).toBe(true)
			expect(shallow({a: undefined}, {})).toBe(false)
		})

		it('should handle objects with NaN values', () => {
			expect(shallow({a: NaN}, {a: NaN})).toBe(true)
		})

		it('should handle objects with zero values', () => {
			expect(shallow({a: 0}, {a: -0})).toBe(false)
			expect(shallow({a: -0}, {a: -0})).toBe(true)
		})
	})

	describe('complex scenarios', () => {
		it('should handle large objects', () => {
			const obj1: Record<string, number> = {}
			const obj2: Record<string, number> = {}

			for (let i = 0; i < 100; i++) {
				obj1[`key${i}`] = i
				obj2[`key${i}`] = i
			}

			expect(shallow(obj1, obj2)).toBe(true)
		})

		it('should handle objects with symbol keys', () => {
			const sym = Symbol('test')
			const obj1 = {[sym]: 'value'}
			const obj2 = {[sym]: 'value'}

			// Symbol keys are not enumerable, so they don't affect shallow comparison
			expect(shallow(obj1, obj2)).toBe(true)
		})

		it('should handle objects with mixed property types', () => {
			const sharedArray = [1, 2, 3]
			const sharedObject = {nested: 'value'}

			const obj1 = {
				string: 'hello',
				number: 42,
				boolean: true,
				null: null,
				undefined: undefined,
				array: sharedArray,
				object: sharedObject,
			}

			const obj2 = {
				string: 'hello',
				number: 42,
				boolean: true,
				null: null,
				undefined: undefined,
				array: sharedArray,
				object: sharedObject,
			}

			expect(shallow(obj1, obj2)).toBe(true)
		})
	})

	describe('edge cases', () => {
		it('should handle functions (as objects)', () => {
			const func1 = () => {}
			const func2 = () => {}
			expect(shallow(func1, func2)).toBe(false)
		})

		it('should handle dates', () => {
			const date1 = new Date('2023-01-01')
			const date2 = new Date('2023-01-01')
			expect(shallow(date1, date2)).toBe(true) // Both have no enumerable keys
		})

		it('should handle regexes', () => {
			const regex1 = /test/g
			const regex2 = /test/g
			expect(shallow(regex1, regex2)).toBe(true) // Both have no enumerable keys
		})
	})
})