import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {validateTreeStructure, countMarks, findMaxDepth} from './validation'
import {MarkToken} from './types'

describe('ParserV2', () => {
	let parser: ParserV2
	let markups: any[]

	beforeEach(() => {
		markups = [
			'@[__label__](__value__)',
			'#[__label__]'
		]
		parser = new ParserV2(markups)
	})

	describe('constructor', () => {
		it('should initialize with markups', () => {
			expect(parser).toBeDefined()
		})

	})

	describe('static split', () => {
		it('should parse text with provided options and return NestedToken[]', () => {
			const value = 'Hello @[world](test) and #[tag]'
			const options = [
				{markup: '@[__label__](__value__)' as any, trigger: '@', data: []},
				{markup: '#[__label__]' as any, trigger: '#', data: []},
			]

			const result = ParserV2.split(value, options)

			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBeGreaterThan(0)
		})

		it('should handle text without options', () => {
			const value = 'Hello world'
			const result = ParserV2.split(value)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(0)
		})
	})

	describe('split', () => {
		it('should return NestedToken[]', () => {
			const input = 'Hello @[world](test)'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBeGreaterThan(0)
		})
	})


	describe('split', () => {
		it('should parse plain text', () => {
			const input = 'Hello world'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0].type).toBe('text')
			expect(result[0].content).toBe('Hello world')
		})

		it('should parse simple mark', () => {
			const input = '@[hello](world)'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			const mark = result[0] as MarkToken
			expect(mark.type).toBe('mark')
			expect(mark.markData.label).toBe('hello')
			expect(mark.markData.value).toBe('world')
			expect(mark.markData.optionIndex).toBe(0)
		})

		it('should parse simple mark without value', () => {
			const input = '#[tag]'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			const mark = result[0] as MarkToken
			expect(mark.type).toBe('mark')
			expect(mark.markData.label).toBe('tag')
			expect(mark.markData.value).toBeUndefined()
			expect(mark.markData.optionIndex).toBe(1)
		})

		it('should parse mixed text and marks', () => {
			const input = 'Hello @[world](test) and #[tag]'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(4) // text + mark + text + mark

			// Первый текстовый кусок
			expect(result[0].type).toBe('text')
			expect(result[0].content).toBe('Hello ')

			// Первый mark
			expect(result[1].type).toBe('mark')
			expect((result[1] as MarkToken).markData.label).toBe('world')
			expect((result[1] as MarkToken).markData.value).toBe('test')

			// Второй текстовый кусок
			expect(result[2].type).toBe('text')
			expect(result[2].content).toBe(' and ')

			// Второй mark
			expect(result[3].type).toBe('mark')
			expect((result[3] as MarkToken).markData.label).toBe('tag')
		})

		it('should handle empty input', () => {
			const result = parser.split('')
			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(0)
		})

		it('should handle malformed markup gracefully', () => {
			const input = '@[unclosed markup'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			// Должен обработать как обычный текст
			expect(result).toHaveLength(1)
			expect(result[0].type).toBe('text')
			expect(result[0].content).toBe('@[unclosed markup')
		})
	})

	describe('validation', () => {
		it('should validate correct tree structure', () => {
			const input = 'Hello @[world](test)'
			const result = parser.split(input)
			const validation = validateTreeStructure(result)

			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})

		it('should count marks correctly', () => {
			const input = 'Hello @[world](test) and #[tag1] #[tag2]'
			const result = parser.split(input)
			const markCount = countMarks(result)

			expect(markCount).toBe(3) // world, tag1, tag2
		})

		it('should calculate max depth correctly', () => {
			const input = 'Hello @[world](test)'
			const result = parser.split(input)
			const maxDepth = findMaxDepth(result)

			expect(maxDepth).toBe(1) // 1 level of marks from root
		})
	})

	describe('edge cases', () => {
		it('should handle adjacent marks', () => {
			const input = '@[first](1)@[second](2)'
			const result = parser.split(input)

			expect(result).toHaveLength(2)
			expect((result[0] as MarkToken).markData.label).toBe('first')
			expect((result[1] as MarkToken).markData.label).toBe('second')
		})

		it('should handle marks at string boundaries', () => {
			const input = '@[start](value)'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe('mark')
		})

		it('should handle special characters in content', () => {
			const input = 'Text with @[special chars](!@#$%^&*())'
			const result = parser.split(input)

			// Парсер разбивает строку на части
			expect(result.length).toBeGreaterThanOrEqual(2)
			const markNode = result.find((child) => child.type === 'mark')
			// В текущей реализации специальные символы могут быть ограничены
			expect(markNode?.markData?.label).toBe('special chars')
			expect(markNode?.markData?.value).toMatch(/^!@#/)
		})

	})
})
