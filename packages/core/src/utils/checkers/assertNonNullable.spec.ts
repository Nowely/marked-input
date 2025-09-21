import {describe, it, expect} from 'vitest'
import {assertNonNullable} from './assertNonNullable'

describe(`Utility: ${assertNonNullable.name}`, () => {
	it('should not throw for truthy values', () => {
		expect(() => assertNonNullable('string')).not.toThrow()
		expect(() => assertNonNullable(42)).not.toThrow()
		expect(() => assertNonNullable(true)).not.toThrow()
		expect(() => assertNonNullable([])).not.toThrow()
		expect(() => assertNonNullable({})).not.toThrow()
		expect(() => assertNonNullable(() => {})).not.toThrow()
	})

	it('should not throw for zero', () => {
		expect(() => assertNonNullable(0)).not.toThrow()
	})

	it('should not throw for empty string', () => {
		expect(() => assertNonNullable('')).not.toThrow()
	})

	it('should not throw for false', () => {
		expect(() => assertNonNullable(false)).not.toThrow()
	})

	it('should throw for null', () => {
		expect(() => assertNonNullable(null)).toThrow('Value must be a non nullable!')
	})

	it('should throw for undefined', () => {
		expect(() => assertNonNullable(undefined)).toThrow('Value must be a non nullable!')
	})

	it('should work with generic types', () => {
		const value: string | null = 'test'
		assertNonNullable(value)
		// TypeScript should infer that value is now string
		expect(typeof value).toBe('string')

		const nullableValue: number | undefined = undefined
		expect(() => assertNonNullable(nullableValue)).toThrow('Value must be a non nullable!')
	})

	it('should handle complex objects', () => {
		const validObject = {nested: {value: 'test'}}
		expect(() => assertNonNullable(validObject)).not.toThrow()

		const nullObject: {nested: {value: string}} | null = null
		expect(() => assertNonNullable(nullObject)).toThrow('Value must be a non nullable!')
	})
})
