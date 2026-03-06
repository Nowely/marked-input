import {describe, expect, it} from 'vitest'

import {isFunction} from './isFunction'

describe(`Utility: ${isFunction.name}`, () => {
	it('should return true for function declarations', () => {
		function regularFunction() {}
		expect(isFunction(regularFunction)).toBe(true)
	})

	it('should return true for function expressions', () => {
		const functionExpression = function () {}
		expect(isFunction(functionExpression)).toBe(true)
	})

	it('should return true for arrow functions', () => {
		const arrowFunction = () => {}
		expect(isFunction(arrowFunction)).toBe(true)
	})

	it('should return true for async functions', () => {
		const asyncFunction = async () => {}
		async function asyncDeclaration() {}
		expect(isFunction(asyncFunction)).toBe(true)
		expect(isFunction(asyncDeclaration)).toBe(true)
	})

	it('should return true for generator functions', () => {
		function* generatorFunction() {}
		const generatorExpression = function* () {}
		expect(isFunction(generatorFunction)).toBe(true)
		expect(isFunction(generatorExpression)).toBe(true)
	})

	it('should return true for class constructors', () => {
		class TestClass {}
		expect(isFunction(TestClass)).toBe(true)
	})

	it('should return true for built-in functions', () => {
		expect(isFunction(console.log)).toBe(true)
		expect(isFunction(Math.max)).toBe(true)
		expect(isFunction(Array.prototype.push)).toBe(true)
	})

	it('should return false for primitives', () => {
		expect(isFunction('string')).toBe(false)
		expect(isFunction(42)).toBe(false)
		expect(isFunction(true)).toBe(false)
		expect(isFunction(Symbol('test'))).toBe(false)
		expect(isFunction(BigInt(123))).toBe(false)
	})

	it('should return false for null and undefined', () => {
		expect(isFunction(null)).toBe(false)
		expect(isFunction(undefined)).toBe(false)
	})

	it('should return false for objects', () => {
		expect(isFunction({})).toBe(false)
		expect(isFunction({func: () => {}})).toBe(false)
	})

	it('should return false for arrays', () => {
		expect(isFunction([])).toBe(false)
		expect(isFunction([1, 2, 3])).toBe(false)
	})

	it('should return false for regexes', () => {
		expect(isFunction(/test/)).toBe(false)
	})

	it('should return false for dates', () => {
		expect(isFunction(new Date())).toBe(false)
	})

	it('should handle edge cases', () => {
		// Function with properties
		const funcWithProps = () => {}
		funcWithProps.customProp = 'value'
		expect(isFunction(funcWithProps)).toBe(true)

		// Bound function
		const boundFunc = (() => {}).bind(null)
		expect(isFunction(boundFunc)).toBe(true)

		// Function from Function constructor
		const constructedFunc = new Function('return 1')
		expect(isFunction(constructedFunc)).toBe(true)
	})
})