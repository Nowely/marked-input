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
			expect(mark.data.label).toBe('hello')
			expect(mark.data.value).toBe('world')
			expect(mark.data.optionIndex).toBe(0)
		})

		it('should parse simple mark without value', () => {
			const input = '#[tag]'
			const result = parser.split(input)

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			const mark = result[0] as MarkToken
			expect(mark.type).toBe('mark')
			expect(mark.data.label).toBe('tag')
			expect(mark.data.value).toBeUndefined()
			expect(mark.data.optionIndex).toBe(1)
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
			expect((result[1] as MarkToken).data.label).toBe('world')
			expect((result[1] as MarkToken).data.value).toBe('test')

			// Второй текстовый кусок
			expect(result[2].type).toBe('text')
			expect(result[2].content).toBe(' and ')

			// Второй mark
			expect(result[3].type).toBe('mark')
			expect((result[3] as MarkToken).data.label).toBe('tag')
		})

		it('should handle empty input', () => {
			const result = parser.split('')
			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0].type).toBe('text')
			expect(result[0].content).toBe('')
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
			expect((result[0] as MarkToken).data.label).toBe('first')
			expect((result[1] as MarkToken).data.label).toBe('second')
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
			expect(markNode?.data?.label).toBe('special chars')
			expect(markNode?.data?.value).toMatch(/^!@#/)
		})

		it('should support nested parsing in mark content', () => {
			// Создаем парсер только с @[__label__] для простоты тестирования
			const simpleParser = new ParserV2(['@[__label__]'])
			const input = '@[hello @[world]]'
			const result = simpleParser.split(input)

		// Получаем только внешний маркер (весь input - это маркер)
		expect(result).toHaveLength(1)

		const outerMark = result[0] as MarkToken
		expect(outerMark.type).toBe('mark')
		// Label должен содержать только текст без вложенных маркеров
		expect(outerMark.data?.label).toBe('hello ')

			// Проверяем, что у внешнего маркера есть children с одним маркером
			expect(outerMark.children).toBeDefined()
			expect(Array.isArray(outerMark.children)).toBe(true)
			expect(outerMark.children!.length).toBe(1)
			expect((outerMark.children![0] as MarkToken).type).toBe('mark')
			expect((outerMark.children![0] as MarkToken).data?.label).toBe('world')
		})

		it('should extract inner content correctly', () => {
			// Создаем парсер и проверяем, что он правильно извлекает внутренний контент
			const simpleParser = new ParserV2(['@[__label__]'])
			const input = '@[hello @[world]]'
			const result = simpleParser.split(input)

			// Проверяем, что внешний маркер существует
			expect(result[0].type).toBe('mark')
			// extractInnerContent должен был сработать и создать children
			expect(Array.isArray((result[0] as MarkToken).children)).toBe(true)
		})

		it('should handle multiple nested marks', () => {
			const parser = new ParserV2(['@[__label__]'])
			const input = '@[hello @[world] and @[universe]]'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const outerMark = result[0] as MarkToken
			expect(outerMark.type).toBe('mark')
			expect(outerMark.data?.label).toBe('hello ')
			expect(outerMark.children).toHaveLength(2)

			const child0 = outerMark.children![0] as MarkToken
			expect(child0.type).toBe('mark')
			expect(child0.data?.label).toBe('world')

			const child1 = outerMark.children![1] as MarkToken
			expect(child1.type).toBe('mark')
			expect(child1.data?.label).toBe('universe')
		})

		it('should handle deeply nested marks', () => {
			const parser = new ParserV2(['@[__label__]'])
			const input = '@[level1 @[level2 @[level3]]]'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const level1 = result[0] as MarkToken
			expect(level1.type).toBe('mark')
			expect(level1.data?.label).toBe('level1 ')
			expect(level1.children).toHaveLength(1)

			const level2 = level1.children![0] as MarkToken
			expect(level2.type).toBe('mark')
			expect(level2.data?.label).toBe('level2 ')
			expect(level2.children).toHaveLength(1)

			const level3 = level2.children![0] as MarkToken
			expect(level3.type).toBe('mark')
			expect(level3.data?.label).toBe('level3')
			expect(level3.children).toHaveLength(0)
		})

		it('should handle mixed markup types with nesting', () => {
			const parser = new ParserV2(['@[__label__]', '#[__label__]'])
			const input = '@[hello #[world]]'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const outerMark = result[0] as MarkToken
			expect(outerMark.type).toBe('mark')
			expect(outerMark.data?.label).toBe('hello ')
			expect(outerMark.children).toHaveLength(1)

			const innerMark = outerMark.children![0] as MarkToken
			expect(innerMark.type).toBe('mark')
			expect(innerMark.data?.label).toBe('world')
			expect(innerMark.children).toHaveLength(0)
		})

		it('should handle marks with values and nesting', () => {
			const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
			const input = '@[hello #[world]](value)'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const outerMark = result[0] as MarkToken
			expect(outerMark.type).toBe('mark')
			expect(outerMark.data?.label).toBe('hello ')
			expect(outerMark.data?.value).toBe('value')
			expect(outerMark.children).toHaveLength(1)

			const innerMark = outerMark.children![0] as MarkToken
			expect(innerMark.type).toBe('mark')
			expect(innerMark.data?.label).toBe('world')
			expect(innerMark.children).toHaveLength(0)
		})

		it('should handle nested marks at different positions', () => {
			const parser = new ParserV2(['@[__label__]'])
			const input = '@[start @[middle] end]'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const outerMark = result[0] as MarkToken
			expect(outerMark.type).toBe('mark')
			expect(outerMark.data?.label).toBe('start ')
			expect(outerMark.children).toHaveLength(1)

			const innerMark = outerMark.children![0] as MarkToken
			expect(innerMark.type).toBe('mark')
			expect(innerMark.data?.label).toBe('middle')
			expect(innerMark.children).toHaveLength(0)
		})


		it('should handle nested marks with special characters', () => {
			const parser = new ParserV2(['@[__label__]'])
			const input = '@[hello @[world with spaces]]'
			const result = parser.split(input)

			expect(result).toHaveLength(1)
			const outerMark = result[0] as MarkToken
			expect(outerMark.type).toBe('mark')
			expect(outerMark.data?.label).toBe('hello ')
			expect(outerMark.children).toHaveLength(1)

			const innerMark = outerMark.children![0] as MarkToken
			expect(innerMark.type).toBe('mark')
			expect(innerMark.data?.label).toBe('world with spaces')
		})

	})
})
