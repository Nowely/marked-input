import {describe, it, expect} from 'vitest'
import {isAnnotated} from './isAnnotated'

describe(`Utility: ${isAnnotated.name}`, () => {
	it('should return true for valid MarkMatch objects', () => {
		const validMarkMatch = {
			label: 'test',
			value: 'test value',
			annotation: 'annotated text',
			input: 'input text',
			index: 5,
			optionIndex: 1
		}

		expect(isAnnotated(validMarkMatch)).toBe(true)
	})

	it('should return true for minimal MarkMatch objects', () => {
		const minimalMarkMatch = {
			label: 'test',
			annotation: 'annotated',
			input: 'input',
			index: 0,
			optionIndex: 0
		}

		expect(isAnnotated(minimalMarkMatch)).toBe(true)
	})

	it('should return false for objects without annotation property', () => {
		const invalidObject = {
			label: 'test',
			input: 'input',
			index: 0,
			optionIndex: 0
		}

		expect(isAnnotated(invalidObject)).toBe(false)
	})

	it('should return false for null', () => {
		expect(isAnnotated(null)).toBe(false)
	})

	it('should return false for undefined', () => {
		expect(isAnnotated(undefined)).toBe(false)
	})

	it('should return false for primitives', () => {
		expect(isAnnotated('string')).toBe(false)
		expect(isAnnotated(42)).toBe(false)
		expect(isAnnotated(true)).toBe(false)
		expect(isAnnotated(Symbol('test'))).toBe(false)
		expect(isAnnotated(BigInt(123))).toBe(false)
	})

	it('should return false for arrays', () => {
		expect(isAnnotated([])).toBe(false)
		expect(isAnnotated([1, 2, 3])).toBe(false)
	})

	it('should return false for functions', () => {
		expect(isAnnotated(() => {})).toBe(false)
		expect(isAnnotated(function() {})).toBe(false)
	})

	it('should return true for objects with annotation property', () => {
		const partialObject = {
			annotation: 'test'
		}

		expect(isAnnotated(partialObject)).toBe(true)
	})

	it('should return true for objects with annotation property set to falsy values', () => {
		const falsyAnnotation = {
			annotation: '',
			input: 'test',
			index: 0,
			optionIndex: 0
		}

		expect(isAnnotated(falsyAnnotation)).toBe(true)
	})

	it('should return false for objects where annotation is inherited', () => {
		function TestObject() {
			this.otherProp = 'value'
		}
		TestObject.prototype.annotation = 'inherited'

		const obj = new TestObject()

		// 'in' operator checks prototype chain, so this should return true
		expect(isAnnotated(obj)).toBe(true)
	})

	it('should handle edge cases', () => {
		// Object with annotation as a symbol
		const symbolAnnotation = {
			[Symbol('annotation')]: 'value'
		}
		expect(isAnnotated(symbolAnnotation)).toBe(false)

		// Object with annotation as a getter
		const getterObject = {}
		Object.defineProperty(getterObject, 'annotation', {
			get: () => 'value',
			enumerable: true
		})
		expect(isAnnotated(getterObject)).toBe(true)
	})
})
