import {describe, it, expect, beforeEach} from 'vitest'
import {ParserV2} from './ParserV2'
import {validateTreeStructure, validateNestedContent} from './validation'

describe('ParserV2 Integration', () => {
	let parser: ParserV2

	beforeEach(() => {
		const markups = [
			'@[__label__](__value__)',
			'#[__label__]',
			'**__[__label__]__**',
			'*_[__label__]_*'
		]
		parser = new ParserV2(markups as any)
	})

	describe('Rich text formatting', () => {
		it.skip('should parse nested formatting marks', () => {
			const input = 'This is **[bold text with *italic* inside]**'
			const result = parser.split(input)

			expect(result.children).toHaveLength(3) // text + bold mark + text

			const boldMark = result.children![1] as any
			expect(boldMark.type).toBe('mark')
			expect(boldMark.data?.label).toBe('bold text with *italic* inside')
			expect(boldMark.data?.optionIndex).toBe(2) // bold markup

			// В реальной реализации bold mark должен содержать вложенный italic mark
			// Но текущая простая реализация парсит как плоский текст
		})

		it('should handle complex nested structures', () => {
			const input = 'User @[john](John Doe) mentioned #[urgent] task'
			const result = parser.split(input)

			expect(result).toHaveLength(5) // text + mention + text + tag + text

			const mention = result[1]
			expect(mention.data?.label).toBe('john')
			expect(mention.data?.value).toBe('John Doe')
			expect(mention.data?.optionIndex).toBe(0)

			const tag = result[3]
			expect(tag.data?.label).toBe('urgent')
			expect(tag.data?.optionIndex).toBe(1)
		})
	})

	describe('Validation integration', () => {
		it('should validate safe content', () => {
			const safeContent = 'Hello @[user](normal text)'
			const isValid = validateNestedContent(safeContent)
			expect(isValid).toBe(true)
		})

		it('should detect dangerous content', () => {
			const dangerousContent = 'Hello <script>alert("xss")</script>'
			const isValid = validateNestedContent(dangerousContent)
			expect(isValid).toBe(false)
		})

		it.skip('should validate complex tree structures', () => {
			const input = 'Start @[mark1](value1) middle #[tag1] end'
			const result = parser.split(input)
			const validation = validateTreeStructure(result)

			expect(validation.isValid).toBe(true)

			// Проверяем структуру
			expect(result.children).toHaveLength(5)
			expect(result.children!.filter((c: any) => c.type === 'mark')).toHaveLength(2)
			expect(result.children!.filter((c: any) => c.type === 'text')).toHaveLength(3)
		})
	})

	describe('Performance benchmarks', () => {
		it('should parse large documents efficiently', () => {
			// Генерируем большой документ
			const generateLargeInput = (markCount: number): string => {
				let result = 'Start '
				for (let i = 0; i < markCount; i++) {
					result += `@[user${i}](User ${i}) text `
				}
				result += 'end'
				return result
			}

			const largeInput = generateLargeInput(100)

			const start = performance.now()
			const result = parser.split(largeInput)
			const end = performance.now()

			const duration = end - start

			// Парсинг должен быть быстрым (< 50ms для 100 marks)
			expect(duration).toBeLessThan(50)
    expect(result.filter((c) => c.type === 'mark')).toHaveLength(100)
		})

		it.skip('should handle rapid successive parses', () => {
			const inputs = [
				'Hello @[world](test)',
				'User #[tag] mentioned',
				'Complex **[bold *italic* text]** parsing',
				'Multiple @[user1](value1) @[user2](value2) marks'
			]

			const start = performance.now()
			const results = inputs.map(input => parser.split(input))
			const end = performance.now()

			const totalDuration = end - start

			// Все парсы должны быть быстрыми
			expect(totalDuration).toBeLessThan(20)
			expect(results).toHaveLength(4)
			results.forEach(result => {
				expect(validateTreeStructure(result).isValid).toBe(true)
			})
		})
	})

	describe('Error handling', () => {
		it('should handle incomplete markup gracefully', () => {
			const inputs = [
				'@[incomplete',
				'#[',
				'**['
			]

			inputs.forEach(input => {
				const result = parser.split(input)
				const validation = validateTreeStructure(result)
				expect(validation.isValid).toBe(true)
			})
		})

		it.skip('should handle nested brackets correctly', () => {
			const input = '@[test [with] brackets](value)'
			const result = parser.split(input)

			expect(result.children).toHaveLength(1)
			const mark = result.children![0] as any
			expect(mark.data?.label).toBe('test [with] brackets')
			expect(mark.data?.value).toBe('value')
		})

		it.skip('should handle escaped characters', () => {
			const input = 'Text with \\[escaped] @[normal](mark)'
			const result = parser.split(input)

			// В текущей реализации экранирование не обрабатывается
			// Это можно улучшить в будущих версиях
			expect(result.children).toHaveLength(3)
		})
	})

	describe('Real-world scenarios', () => {
		it.skip('should parse social media style mentions and hashtags', () => {
			const tweet = 'Hey @[john](John Smith), check out #[react] and #[typescript] for #[webdev]! What do you think @[jane](Jane Doe)?'
			const result = parser.split(tweet)

			const marks = result.children!.filter((c: any) => c.type === 'mark')
			expect(marks).toHaveLength(5)

			// Проверяем упоминания пользователей
			const mentions = marks.filter((m: any) => m.data?.optionIndex === 0)
			expect(mentions).toHaveLength(2)
			expect((mentions[0] as any).data?.label).toBe('john')
			expect((mentions[1] as any).data?.label).toBe('jane')

			// Проверяем хэштеги
			const hashtags = marks.filter((m: any) => m.data?.optionIndex === 1)
			expect(hashtags).toHaveLength(3)
			expect(hashtags.map((h: any) => h.data?.label)).toEqual(['react', 'typescript', 'webdev'])
		})

		it.skip('should parse markdown-style formatting', () => {
			const markdown = 'This is **[important]** text with *emphasis* and #[tags]'
			const result = parser.split(markdown)

			const marks = result.children!.filter((c: any) => c.type === 'mark')
			expect(marks).toHaveLength(3)

			const boldMark = marks.find((m: any) => m.data?.optionIndex === 2)
			expect((boldMark as any)?.data?.label).toBe('important')

			const italicMark = marks.find((m: any) => m.data?.optionIndex === 3)
			expect((italicMark as any)?.data?.label).toBe('emphasis')

			const tagMark = marks.find((m: any) => m.data?.optionIndex === 1)
			expect((tagMark as any)?.data?.label).toBe('tags')
		})
	})
})
