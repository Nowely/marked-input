import {describe, it, expect} from 'vitest'
import {normalizeMark} from './normalizeMark'
import {Markup} from '../../../types'

describe(`Utility: ${normalizeMark.name}`, () => {
	it('should return mark unchanged when annotation matches expected format', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[hello](world)',
			label: 'hello',
			value: 'world',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return the same object
		expect(result).toEqual(mark)
	})

	it('should swap label and value when annotation does not match expected format', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[hello](world)', // annotation matches expected
			label: 'world', // but label and value are swapped in the mark object
			value: 'hello',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).not.toBe(mark) // Should return a new object
		expect(result).toEqual({
			annotation: '@[hello](world)',
			label: 'hello', // swapped back
			value: 'world', // swapped back
			input: 'text',
			index: 0,
			optionIndex: 0
		})
	})

	it('should handle markup with only label placeholder', () => {
		const markup: Markup = '#[__label__]'
		const mark = {
			annotation: '#[test]',
			label: 'test',
			value: undefined,
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return unchanged
	})

	it('should handle markup with value before label', () => {
		const markup: Markup = '@(__value__)[__label__]'
		const mark = {
			annotation: '@(world)[hello]',
			label: 'hello',
			value: 'world',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return unchanged since it matches
	})

	it('should swap label and value for markup with value before label when annotation is wrong', () => {
		const markup: Markup = '@(__value__)[__label__]'
		const mark = {
			annotation: '@(hello)[world]', // annotation doesn't match annotate(markup, 'hello', 'world')
			label: 'hello',
			value: 'world',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		// annotate('@(__value__)[__label__]', 'hello', 'world') = '@(world)[hello]'
		// Since '@(hello)[world]' !== '@(world)[hello]', function should swap
		const result = normalizeMark(mark, markup)

		expect(result).toEqual({
			annotation: '@(hello)[world]',
			label: 'world', // swapped
			value: 'hello', // swapped
			input: 'text',
			index: 0,
			optionIndex: 0
		})
	})

	it('should handle markup with complex patterns', () => {
		const markup: Markup = '**__label__**(__value__)'
		const mark = {
			annotation: '**bold**(italic)',
			label: 'bold',
			value: 'italic',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return unchanged
	})

	it('should handle markup with swapped complex patterns', () => {
		const markup: Markup = '**__label__**(__value__)'
		const mark = {
			annotation: '**bold**(italic)', // matches annotate(markup, 'bold', 'italic')
			label: 'italic', // but these are swapped in the object
			value: 'bold',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toEqual({
			annotation: '**bold**(italic)',
			label: 'bold', // swapped back
			value: 'italic', // swapped back
			input: 'text',
			index: 0,
			optionIndex: 0
		})
	})

	it('should preserve all other properties when swapping', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[hello](world)', // matches annotate(markup, 'hello', 'world')
			label: 'world', // but these are swapped
			value: 'hello',
			input: 'some input text',
			index: 5,
			optionIndex: 2
		}

		const result = normalizeMark(mark, markup)

		expect(result.annotation).toBe(mark.annotation)
		expect(result.input).toBe(mark.input)
		expect(result.index).toBe(mark.index)
		expect(result.optionIndex).toBe(mark.optionIndex)
		expect(result.label).toBe('hello') // swapped back
		expect(result.value).toBe('world') // swapped back
	})

	it('should handle empty strings', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[](empty)',
			label: '',
			value: 'empty',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return unchanged
	})

	it('should handle special characters in label and value', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[user@domain.com](special-value)',
			label: 'user@domain.com',
			value: 'special-value',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toBe(mark) // Should return unchanged
	})

	it('should handle swapped special characters', () => {
		const markup: Markup = '@[__label__](__value__)'
		const mark = {
			annotation: '@[user@domain.com](special-value)', // matches annotate(markup, 'user@domain.com', 'special-value')
			label: 'special-value', // but these are swapped
			value: 'user@domain.com',
			input: 'text',
			index: 0,
			optionIndex: 0
		}

		const result = normalizeMark(mark, markup)

		expect(result).toEqual({
			annotation: '@[user@domain.com](special-value)',
			label: 'user@domain.com', // swapped back
			value: 'special-value', // swapped back
			input: 'text',
			index: 0,
			optionIndex: 0
		})
	})
})
