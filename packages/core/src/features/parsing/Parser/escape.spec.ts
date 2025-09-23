import {describe, it, expect} from 'vitest'
import {escape} from './escape'

describe(`Utility: ${escape.name}`, () => {
	it('should escape all regex special characters', () => {
		const specialChars = '.*+?^${}()|[]\\'
		const escaped = escape(specialChars)

		expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
	})

	it('should escape individual special characters', () => {
		expect(escape('.')).toBe('\\.')
		expect(escape('*')).toBe('\\*')
		expect(escape('+')).toBe('\\+')
		expect(escape('?')).toBe('\\?')
		expect(escape('^')).toBe('\\^')
		expect(escape('$')).toBe('\\$')
		expect(escape('{')).toBe('\\{')
		expect(escape('}')).toBe('\\}')
		expect(escape('(')).toBe('\\(')
		expect(escape(')')).toBe('\\)')
		expect(escape('|')).toBe('\\|')
		expect(escape('[')).toBe('\\[')
		expect(escape(']')).toBe('\\]')
		expect(escape('\\')).toBe('\\\\')
	})

	it('should escape hyphen in character classes', () => {
		expect(escape('-')).toBe('\\-')
		expect(escape('#')).toBe('\\#')
		expect(escape(' ')).toBe('\\ ')
		expect(escape('\t')).toBe('\\\t')
		expect(escape('\n')).toBe('\\\n')
	})

	it('should not escape normal characters', () => {
		expect(escape('abc')).toBe('abc')
		expect(escape('123')).toBe('123')
		expect(escape('ABC')).toBe('ABC')
		expect(escape('normal_string')).toBe('normal_string')
	})

	it('should handle empty string', () => {
		expect(escape('')).toBe('')
	})

	it('should handle strings with mixed special and normal characters', () => {
		expect(escape('test.*+')).toBe('test\\.\\*\\+')
		expect(escape('^start$')).toBe('\\^start\\$')
		expect(escape('(group)|[set]')).toBe('\\(group\\)\\|\\[set\\]')
	})

	it('should be usable in regex construction', () => {
		const pattern = escape('test.*')
		const regex = new RegExp(pattern)

		expect(regex.test('test.*')).toBe(true)
		expect(regex.test('testX*')).toBe(false)
	})

	it('should handle unicode characters', () => {
		expect(escape('🚀')).toBe('🚀')
		expect(escape('测试')).toBe('测试')
		expect(escape('🚀.*')).toBe('🚀\\.\\*')
	})

	it('should handle repeated special characters', () => {
		expect(escape('..')).toBe('\\.\\.')
		expect(escape('**')).toBe('\\*\\*')
		expect(escape('++')).toBe('\\+\\+')
	})

	it('should handle complex regex patterns as input', () => {
		const complexPattern = '^test.*(group1|group2)[0-9]+$'
		const escaped = escape(complexPattern)

		expect(escaped).toBe('\\^test\\.\\*\\(group1\\|group2\\)\\[0\\-9\\]\\+\\$')

		// Verify the escaped pattern works as a literal match
		const regex = new RegExp(escaped)
		expect(regex.test(complexPattern)).toBe(true)
	})

	it('should handle edge cases', () => {
		// Single character strings
		expect(escape('a')).toBe('a')
		expect(escape('.')).toBe('\\.')

		// All special characters
		const allSpecial = '-[]{}()*+?.\\^$|# \t\n'
		const escaped = escape(allSpecial)
		expect(escaped).toBe('\\-\\[\\]\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|\\#\\ \\\t\\\n')
	})
})
