import {describe, it, expect} from 'vitest'
import {toString} from './toString'
import {MarkStruct, MarkMatch, Markup} from '../../shared/types'

describe(`Utility: ${toString.name}`, () => {
	it('should return empty string for empty marks array', () => {
		const marks: MarkStruct[] = []
		const options: any[] = []

		const result = toString(marks, options)

		expect(result).toBe('')
	})

	it('should handle plain text marks', () => {
		const marks: MarkStruct[] = [{label: 'Hello'}, {label: ' '}, {label: 'world'}]
		const options: any[] = []

		const result = toString(marks, options)

		expect(result).toBe('Hello world')
	})

	it('should handle annotated marks', () => {
		const marks: MarkMatch[] = [
			{
				label: 'Hello',
				value: 'greeting',
				annotation: '@[Hello](greeting)',
				input: 'text',
				index: 0,
				optionIndex: 0,
			},
		]
		const options = [{markup: '@[__label__](__value__)' as Markup, trigger: '@', data: [] as string[] as string[]}]

		const result = toString(marks, options)

		expect(result).toBe('@[Hello](greeting)')
	})

	it('should handle mix of plain and annotated marks', () => {
		const marks: (MarkStruct | MarkMatch)[] = [
			{label: 'Start '},
			{
				label: 'bold',
				value: 'strong',
				annotation: '**bold**(strong)',
				input: 'text',
				index: 6,
				optionIndex: 0,
			},
			{label: ' and '},
			{
				label: 'italic',
				annotation: '*italic*',
				input: 'text',
				index: 15,
				optionIndex: 1,
			},
			{label: ' end'},
		]
		const options = [
			{markup: '**__label__**(__value__)' as Markup, trigger: '**', data: [] as string[]},
			{markup: '*__label__*' as Markup, trigger: '*', data: [] as string[]},
		]

		const result = toString(marks, options)

		expect(result).toBe('Start **bold**(strong) and *italic* end')
	})

	it('should handle marks with undefined value', () => {
		const marks: MarkMatch[] = [
			{
				label: 'hashtag',
				annotation: '#hashtag',
				input: 'text',
				index: 0,
				optionIndex: 0,
			},
		]
		const options = [{markup: '#__label__' as Markup, trigger: '#', data: [] as string[]}]

		const result = toString(marks, options)

		expect(result).toBe('#hashtag')
	})

	it('should use correct markup based on optionIndex', () => {
		const marks: MarkMatch[] = [
			{
				label: 'mention',
				value: 'user',
				annotation: '@[mention](user)',
				input: 'text',
				index: 0,
				optionIndex: 1, // Uses second option
			},
		]
		const options = [
			{markup: '#__label__' as Markup, trigger: '#', data: [] as string[]},
			{markup: '@[__label__](__value__)' as Markup, trigger: '@', data: [] as string[]},
		]

		const result = toString(marks, options)

		expect(result).toBe('@[mention](user)')
	})

	it('should handle multiple marks with different optionIndexes', () => {
		const marks: MarkMatch[] = [
			{
				label: 'bold',
				value: 'strong',
				annotation: '**bold**(strong)',
				input: 'text',
				index: 0,
				optionIndex: 0,
			},
			{
				label: 'link',
				value: 'url',
				annotation: '[link](url)',
				input: 'text',
				index: 15,
				optionIndex: 1,
			},
		]
		const options = [
			{markup: '**__label__**(__value__)' as Markup, trigger: '**', data: [] as string[]},
			{markup: '[__label__](__value__)' as Markup, trigger: '[', data: [] as string[]},
		]

		const result = toString(marks, options)

		expect(result).toBe('**bold**(strong)[link](url)')
	})

	it('should handle marks with special characters', () => {
		const marks: (MarkStruct | MarkMatch)[] = [
			{label: 'User '},
			{
				label: 'user@domain.com',
				value: 'click here',
				annotation: '[user@domain.com](click here)',
				input: 'text',
				index: 5,
				optionIndex: 0,
			},
			{label: ' says hello'},
		]
		const options = [{markup: '[__label__](__value__)' as Markup, trigger: '[', data: [] as string[]}]

		const result = toString(marks, options)

		expect(result).toBe('User [user@domain.com](click here) says hello')
	})

	it('should handle empty label and value', () => {
		const marks: MarkMatch[] = [
			{
				label: '',
				value: '',
				annotation: '@[]()',
				input: 'text',
				index: 0,
				optionIndex: 0,
			},
		]
		const options = [{markup: '@[__label__](__value__)' as Markup, trigger: '@', data: [] as string[] as string[]}]

		const result = toString(marks, options)

		// annotate('@[__label__](__value__)', '', '') should give '@[](__value__)'
		// because empty string is truthy, so it replaces __value__ with empty string
		expect(result).toBe('@[](__value__)')
	})

	it('should concatenate all marks in order', () => {
		const marks: (MarkStruct | MarkMatch)[] = [
			{label: 'A'},
			{label: 'B'},
			{
				label: 'C',
				annotation: '*C*',
				input: 'text',
				index: 2,
				optionIndex: 0,
			},
			{label: 'D'},
		]
		const options = [{markup: '*__label__*' as Markup, trigger: '*', data: [] as string[]}]

		const result = toString(marks, options)

		expect(result).toBe('AB*C*D')
	})

	it('should handle large arrays of marks', () => {
		const marks: MarkStruct[] = Array.from({length: 1000}, (_, i) => ({label: `part${i}`}))
		const options: any[] = []

		const result = toString(marks, options)

		expect(result).toBe(marks.map(m => m.label).join(''))
		// Length varies: part0-part9 (5 chars), part10-part99 (6 chars), part100-part999 (7 chars)
		// 10 * 5 + 90 * 6 + 900 * 7 = 50 + 540 + 6300 = 6890
		expect(result.length).toBe(6890)
	})

	it('should handle marks with unicode characters', () => {
		const marks: (MarkStruct | MarkMatch)[] = [
			{label: 'Hello 🌍 '},
			{
				label: '🚀',
				value: 'launch',
				annotation: '[🚀](launch)',
				input: 'text',
				index: 9,
				optionIndex: 0,
			},
		]
		const options = [{markup: '[__label__](__value__)' as Markup, trigger: '[', data: [] as string[]}]

		const result = toString(marks, options)

		expect(result).toBe('Hello 🌍 [🚀](launch)')
	})
})
