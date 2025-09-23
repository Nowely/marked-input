import {describe, it, expect} from 'vitest'
import {assertAnnotated} from './assertAnnotated'

describe(`Utility: ${assertAnnotated.name}`, () => {
	it('should not throw for valid MarkMatch objects', () => {
		const validMarkMatch = {
			label: 'test',
			value: 'test value',
			annotation: 'annotated text',
			input: 'input text',
			index: 5,
			optionIndex: 1,
		}

		expect(() => assertAnnotated(validMarkMatch)).not.toThrow()
	})

	it('should not throw for minimal MarkMatch objects', () => {
		const minimalMarkMatch = {
			label: 'test',
			annotation: 'annotated',
			input: 'input',
			index: 0,
			optionIndex: 0,
		}

		expect(() => assertAnnotated(minimalMarkMatch)).not.toThrow()
	})

	it('should throw for objects without annotation property', () => {
		const invalidObject = {
			label: 'test',
			input: 'input',
			index: 0,
			optionIndex: 0,
		}

		expect(() => assertAnnotated(invalidObject)).toThrow('Value is not annotated mark!')
	})

	it('should throw for null', () => {
		expect(() => assertAnnotated(null)).toThrow('Value is not annotated mark!')
	})

	it('should throw for undefined', () => {
		expect(() => assertAnnotated(undefined)).toThrow('Value is not annotated mark!')
	})

	it('should throw for primitives', () => {
		expect(() => assertAnnotated('string')).toThrow('Value is not annotated mark!')
		expect(() => assertAnnotated(42)).toThrow('Value is not annotated mark!')
		expect(() => assertAnnotated(true)).toThrow('Value is not annotated mark!')
	})

	it('should throw for arrays', () => {
		expect(() => assertAnnotated([])).toThrow('Value is not annotated mark!')
		expect(() => assertAnnotated([1, 2, 3])).toThrow('Value is not annotated mark!')
	})

	it('should throw for functions', () => {
		expect(() => assertAnnotated(() => {})).toThrow('Value is not annotated mark!')
	})

	it('should handle objects with annotation property but missing other properties', () => {
		const partialObject = {
			annotation: 'test',
		}

		expect(() => assertAnnotated(partialObject)).not.toThrow()
	})

	it('should handle objects with annotation property set to falsy values', () => {
		const falsyAnnotation = {
			annotation: '',
			input: 'test',
			index: 0,
			optionIndex: 0,
		}

		expect(() => assertAnnotated(falsyAnnotation)).not.toThrow()
	})
})
