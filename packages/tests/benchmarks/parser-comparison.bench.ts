import {bench, describe} from 'vitest'
import {Parser} from '../../core/src/features/parsing/ParserV1/Parser'
import {Parser as ParserV2} from '../../core/src/features/parsing/ParserV2/index'
import {Markup} from '../../core/src/shared/types'

// Test data generators
function generateComparisonText(marks: number): string {
	let result = 'Text with marks:'
	for (let i = 0; i < marks; i++) {
		result += ` @[user${i}](User ${i}) and #[tag${i}]`
	}
	result += ' end of text.'
	return result
}

// Test cases
const sizes = [10, 50, 100, 500]

describe('Parser Comparison: v1 vs v2', () => {
	sizes.forEach(size => {
		const input = generateComparisonText(size)
		const parserV1 = new Parser(['@[__label__](__value__)', '#[__label__]'])
		const parserV2 = new ParserV2(['@[__value__](__meta__)', '#[__value__]'])

		describe(`Input size: ${size} marks`, () => {
			bench(`Parser v1 (flat)`, () => {
				parserV1.split(input)
			}, {
				time: 1000,
				iterations: size <= 100 ? 20 : 5
			})

			bench(`Parser v2 (nested)`, () => {
				parserV2.split(input)
			}, {
				time: 1000,
				iterations: size <= 100 ? 20 : 5
			})
		})
	})
})

describe('Parser v2 Features Benchmark', () => {
	const parser = new ParserV2(['@[__value__](__meta__)', '#[__value__]'])

	describe('Memory Efficiency', () => {
		const inputs = [
			{ name: 'small', text: generateComparisonText(10) },
			{ name: 'medium', text: generateComparisonText(100) },
			{ name: 'large', text: generateComparisonText(500) }
		]

		inputs.forEach(({ name, text }) => {
			bench(`memory: ${name}`, () => {
				const result = parser.split(text)
				// Simulate garbage collection pressure
				if (global.gc) {
					global.gc()
				}
				// Just execute, don't return
			}, {
				time: 2000,
				iterations: 10
			})
		})
	})


	describe('Scalability Test', () => {
		// Test how performance degrades with input size
		const sizes = [10, 25, 50, 100, 250, 500]
		const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']
		const parser = new ParserV2(markups)

		sizes.forEach(size => {
			const input = generateComparisonText(size)

			bench(`scalability: ${size} marks`, () => {
				parser.split(input)
			}, {
				time: 1000,
				iterations: size <= 50 ? 10 : 3
			})
		})
	})

	describe('Real-world Scenarios', () => {
		const scenarios = [
			{
				name: 'social media post',
				text: 'Hey @[john](John Doe)! Check out #[react] and #[javascript] for #[webdev] projects. What do you think @[jane](Jane Smith)? #coding #programming'
			},
			{
				name: 'markdown-like text',
				text: 'This is **[bold text]** with *emphasis* and @[links](https://example.com) and #[hashtags] everywhere!'
			},
			{
				name: 'code comments',
				text: 'TODO: Fix @[bug123](null pointer) in #[authentication] module. CC @[developer](dev@example.com) #[urgent]'
			},
			{
				name: 'mixed content',
				text: 'User @[alice](Alice Johnson) shared: "Check **[this amazing article]** about #[AI] and #[machine-learning]!" #[tech] #[news]'
			}
		]
		const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']
		const parser = new ParserV2(markups)

		scenarios.forEach(({ name, text }) => {
			bench(`scenario: ${name}`, () => {
				parser.split(text)
			}, {
				time: 1000,
				iterations: 50
			})
		})
	})
})
