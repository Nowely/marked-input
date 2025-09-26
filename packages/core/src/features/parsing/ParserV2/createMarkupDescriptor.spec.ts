import {describe, it, expect} from 'vitest'
import {createMarkupDescriptor} from './createMarkupDescriptor'

describe('createMarkupDescriptor', () => {
	describe('basic markup parsing', () => {
		it('should parse simple markup with one label', () => {
			const markup = '@[__label__]'
			const result = createMarkupDescriptor(markup as any, 0)

			expect(result).toEqual({
				markup,
				index: 0,
				trigger: '@',
				startPattern: '@[',
				endPattern: ']',
				middlePatterns: undefined,
				hasValue: false,
				hasTwoLabels: false
			})
		})

		it('should parse markup with value', () => {
			const markup = '@[__label__](__value__)'
			const result = createMarkupDescriptor(markup as any, 1)

			expect(result).toEqual({
				markup,
				index: 1,
				trigger: '@',
				startPattern: '@[',
				endPattern: ')',
				middlePatterns: [']('],
				hasValue: true,
				hasTwoLabels: false
			})
		})

		it('should parse different trigger characters', () => {
			const testCases = [
				{ markup: '#[__label__]', trigger: '#', startPattern: '#[' },
				{ markup: '*__[__label__]__', trigger: '*', startPattern: '*__[' },
				{ markup: '**[__label__]**', trigger: '*', startPattern: '**[' }
			]

			testCases.forEach(({ markup, trigger, startPattern }, index) => {
				const result = createMarkupDescriptor(markup as any, index)
				expect(result).toMatchObject({
                    trigger,
                    startPattern
                })
			})
		})
	})

	describe('validation', () => {
		it('should throw error for markup without __label__', () => {
			expect(() => createMarkupDescriptor('@[label]' as any, 0)).toThrow(
				'Expected 1 or 2 "__label__" placeholder'
			)
		})

		it('should throw error for markup with three __label__', () => {
			expect(() => createMarkupDescriptor('@[__label__](__label__)(__label__)' as any, 0)).toThrow(
				'Expected 1 or 2 "__label__" placeholder'
			)
		})

		it('should throw error for markup with two __value__', () => {
			expect(() => createMarkupDescriptor('@[__label__](__value__)(__value__)' as any, 0)).toThrow(
				'Expected 0 or 1 "__value__" placeholder'
			)
		})

		it('should throw error for __value__ before first __label__', () => {
			expect(() => createMarkupDescriptor('@[__value__](__label__)' as any, 0)).toThrow(
				'"__value__" cannot appear before "__label__"'
			)
		})

		it('should throw error for markup without prefix', () => {
			expect(() => createMarkupDescriptor('__label__' as any, 0)).toThrow(
				'Markup must start with a prefix before placeholders'
			)
		})
	})

	describe('complex patterns', () => {
		it('should handle nested brackets in startPattern', () => {
			const markup = '{{__[__label__]__}}'
			const result = createMarkupDescriptor(markup as any, 0)

			expect(result).toMatchObject({
				trigger: '{',
				startPattern: '{{__[',
				endPattern: ']__}}'
			})
		})

		it('should handle multiple middle patterns', () => {
			const markup = '<__label__>content<__label__>'
			const result = createMarkupDescriptor(markup as any, 0)

			expect(result).toMatchObject({
				hasTwoLabels: true,
				middlePatterns: ['>content<']
			})
		})
	})

	describe('edge cases', () => {
		it('should handle markup ending with label', () => {
			const markup = 'prefix__label__'
			const result = createMarkupDescriptor(markup as any, 0)

			expect(result).toMatchObject({
				startPattern: 'prefix',
				endPattern: ''
			})
		})

		it('should preserve index correctly', () => {
			const markup = '@[__label__]'
			const result = createMarkupDescriptor(markup as any, 42)

			expect(result.index).toBe(42)
		})
	})
})
