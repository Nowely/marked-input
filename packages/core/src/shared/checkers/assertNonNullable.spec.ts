import {describe, expect, it} from 'vitest'

import {assertNonNullable} from './assertNonNullable'

describe(`Utility: ${assertNonNullable.name}`, () => {
	it('not throw for truthy values', () => {
		expect(() => assertNonNullable('string')).not.toThrow()
		expect(() => assertNonNullable(42)).not.toThrow()
		expect(() => assertNonNullable(true)).not.toThrow()
		expect(() => assertNonNullable([])).not.toThrow()
		expect(() => assertNonNullable({})).not.toThrow()
		expect(() => assertNonNullable(() => {})).not.toThrow()
	})

	it('not throw for zero', () => {
		expect(() => assertNonNullable(0)).not.toThrow()
	})

	it('not throw for empty string', () => {
		expect(() => assertNonNullable('')).not.toThrow()
	})

	it('not throw for false', () => {
		expect(() => assertNonNullable(false)).not.toThrow()
	})

	it('throw for null', () => {
		expect(() => assertNonNullable(null)).toThrow('Value must be a non nullable!')
	})

	it('throw for undefined', () => {
		expect(() => assertNonNullable(undefined)).toThrow('Value must be a non nullable!')
	})

	it('work with generic types', () => {
		const value: string | null = 'test'
		assertNonNullable(value)
		// TypeScript should infer that value is now string
		expect(typeof value).toBe('string')

		const nullableValue: number | undefined = undefined
		expect(() => assertNonNullable(nullableValue)).toThrow('Value must be a non nullable!')
	})

	it('handle complex objects', () => {
		const validObject = {nested: {value: 'test'}}
		expect(() => assertNonNullable(validObject)).not.toThrow()

		const nullObject: {nested: {value: string}} | null = null
		expect(() => assertNonNullable(nullObject)).toThrow('Value must be a non nullable!')
	})
})