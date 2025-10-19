import {bench, describe} from 'vitest'
import {ParserV2} from '../../core/src/features/parsing/ParserV2/'
import {MarkputToken, MarkToken} from '../../core/src/features/parsing/ParserV2/types'

/**
 * Type guard to check if token is a MarkToken with children
 */
const isMarkToken = (token: MarkputToken): token is MarkToken => {
	return token.type === 'mark'
}

/**
 * Подсчитывает общее количество marks в дереве
 */
const countMarks = (tokens: MarkputToken[]): number => {
	// Рекурсивно считаем только mark типы
	const countInNode = (node: MarkputToken): number => {
		let nodeCount = node.type === 'mark' ? 1 : 0

		if (isMarkToken(node) && node.children) {
			nodeCount += node.children.reduce((sum, child) => sum + countInNode(child), 0)
		}

		return nodeCount
	}

	return tokens.reduce((sum, token) => sum + countInNode(token), 0)
}

/**
 * Находит максимальную глубину вложенности
 */
const findMaxDepth = (tokens: MarkputToken[]): number => {
	// Находим максимальную глубину среди всех токенов
	const findDepth = (node: MarkputToken): number => {
		if (node.type === 'text') {
			return 0
		}

		if (!isMarkToken(node) || !node.children || node.children.length === 0) {
			return 1 // mark без детей имеет глубину 1
		}

		const childrenDepths = node.children.map(child => findDepth(child))
		const maxChildDepth = childrenDepths.length > 0 ? Math.max(...childrenDepths) : 0

		return maxChildDepth + 1
	}

	if (tokens.length === 0) {
		return 0
	}

	const depths = tokens.map(token => findDepth(token))
	return Math.max(...depths)
}

// Test data generators
function generateSimpleText(size: number): string {
	let result = 'Hello world'
	for (let i = 0; i < size; i++) {
		result += ` @[user${i}](User ${i}) some text `
	}
	return result
}

function generateNestedText(size: number, depth: number = 1): string {
	let result = 'Text'
	for (let i = 0; i < size; i++) {
		result += ` @[item${i}](value${i})`
	}
	return result
}

function generateComplexText(size: number): string {
	let result = 'Complex text with multiple markups: '
	for (let i = 0; i < size; i++) {
		if (i % 3 === 0) {
			result += `@[user${i}](User ${i}) `
		} else if (i % 3 === 1) {
			result += `#[tag${i}] `
		} else {
			result += `**[bold${i}]** `
		}
	}
	return result
}

// Benchmark configurations
const parserOptions = [
	{
		markup: '@[__label__](__value__)',
		trigger: '@',
		data: []
	},
	{
		markup: '#[__label__]',
		trigger: '#',
		data: []
	},
	{
		markup: '**__[__label__]__**',
		trigger: '**',
		data: []
	}
]

// Test cases with different input sizes
const testCases = [
	{ name: 'small', size: 10, generator: generateSimpleText },
	{ name: 'medium', size: 100, generator: generateSimpleText },
	{ name: 'large', size: 1000, generator: generateSimpleText },
	{ name: 'complex-small', size: 10, generator: generateComplexText },
	{ name: 'complex-medium', size: 100, generator: generateComplexText },
	{ name: 'complex-large', size: 500, generator: generateComplexText },
]

describe('ParserV2 Benchmarks', () => {
	const parser = new ParserV2(parserOptions.map(opt => opt.markup))

	describe('Parsing Performance', () => {
		testCases.forEach(({ name, size, generator }) => {
			const input = generator(size)

			bench(`parse ${name} (${size} marks)`, () => {
				parser.split(input)
			}, {
				time: 1000,
				iterations: 10
			})
		})
	})

	describe('Parsing with Analysis', () => {
		testCases.slice(0, 3).forEach(({ name, size, generator }) => {
			const input = generator(size)

			bench(`parse with analysis ${name} (${size} marks)`, () => {
				const result = parser.split(input)
				countMarks(result)
				findMaxDepth(result)
			}, {
				time: 1000,
				iterations: 5
			})
		})
	})

	describe('Memory Usage', () => {
		const largeInput = generateSimpleText(1000)

		bench('memory usage for large document', () => {
			const result = parser.split(largeInput)
			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}
			return result
		}, {
			time: 2000,
			iterations: 5
		})
	})

	describe('Concurrent Parsing', () => {
		const inputs = [
			generateSimpleText(50),
			generateSimpleText(50),
			generateComplexText(25),
			generateComplexText(25)
		]

		bench('concurrent parsing (4 documents)', async () => {
			const promises = inputs.map(input => {
				return new Promise(resolve => {
					resolve(parser.split(input))
				})
			})
			await Promise.all(promises)
		}, {
			time: 1000,
			iterations: 10
		})
	})

	describe('Incremental Updates', () => {
		const baseInput = generateSimpleText(100)
		const updateText = ' @[newuser](New User)'

		bench('incremental parsing simulation', () => {
			let currentInput = baseInput

			// Simulate incremental updates
			for (let i = 0; i < 10; i++) {
				currentInput += updateText
				parser.split(currentInput)
			}
		}, {
			time: 1000,
			iterations: 5
		})
	})

	describe('Edge Cases', () => {
		const edgeCases = [
			{ name: 'empty', input: '' },
			{ name: 'no marks', input: 'Plain text without any marks' },
			{ name: 'single char', input: 'A' },
			{ name: 'special chars', input: '@[test](!@#$%^&*())' },
			{ name: 'unicode', input: '@[тест](значение) with unicode 🚀' },
			{ name: 'long label', input: `@[${'a'.repeat(100)}](value)` },
			{ name: 'long value', input: `@[label](${'b'.repeat(100)})` }
		]

		edgeCases.forEach(({ name, input }) => {
			bench(`edge case: ${name}`, () => {
				parser.split(input)
			}, {
				time: 500,
				iterations: 20
			})
		})
	})

})
