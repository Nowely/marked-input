import {bench, describe} from 'vitest'
import {Parser} from '../../core/src/features/parsing/Parser/Parser'
import {ParserV2} from '../../core/src/features/parsing/ParserV2/index'
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

// Parser configurations
const markups: Markup[] = ['@[__label__](__value__)', '#[__label__]']
const parserV1 = new Parser(markups)
const parserV2 = new ParserV2(markups)

describe('Comprehensive Parser Comparison: Memory, Scalability & Real-world', () => {

	describe('Memory Usage Comparison', () => {
		const inputs = [
			{ name: 'small', marks: 10 },
			{ name: 'medium', marks: 50 },
			{ name: 'large', marks: 100 }
		]

		inputs.forEach(({ name, marks }) => {
			const text = generateComparisonText(marks)

			describe(`${name} input (${marks} marks)`, () => {
				bench(`Parser v1 memory: ${name}`, () => {
					const result = parserV1.split(text)
					// Force garbage collection if available
					if (global.gc) {
						global.gc()
					}
				}, {
					time: 2000,
					iterations: 20
				})

				bench(`Parser v2 memory: ${name}`, () => {
					const result = parserV2.split(text)
					// Force garbage collection if available
					if (global.gc) {
						global.gc()
					}
				}, {
					time: 2000,
					iterations: 20
				})
			})
		})
	})

	describe('Scalability Comparison', () => {
		const sizes = [10, 25, 50, 100, 250]

		sizes.forEach(size => {
			const input = generateComparisonText(size)

			describe(`${size} marks scalability`, () => {
				bench(`Parser v1: ${size} marks`, () => {
					parserV1.split(input)
				}, {
					time: 1000,
					iterations: size <= 50 ? 20 : 5
				})

				bench(`Parser v2: ${size} marks`, () => {
					parserV2.split(input)
				}, {
					time: 1000,
					iterations: size <= 50 ? 20 : 5
				})
			})
		})
	})

	describe('Real-world Scenarios Comparison', () => {
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
			},
			{
				name: 'complex nested',
				text: '#[project #[react] @[alice](Alice) created **[amazing dashboard]** with #[typescript] #[tailwind] #[vercel]]'
			}
		]

		scenarios.forEach(({ name, text }) => {
			describe(`${name} scenario`, () => {
				bench(`Parser v1: ${name}`, () => {
					parserV1.split(text)
				}, {
					time: 1000,
					iterations: 100
				})

				bench(`Parser v2: ${name}`, () => {
					parserV2.split(text)
				}, {
					time: 1000,
					iterations: 100
				})
			})
		})
	})

	describe('Memory Allocation Analysis', () => {
		const testText = generateComparisonText(50)

		describe('Detailed memory metrics', () => {
			bench('Parser v1: memory allocation', () => {
				// Multiple runs to see memory patterns
				for (let i = 0; i < 10; i++) {
					const result = parserV1.split(testText)
				}
			}, {
				time: 3000,
				iterations: 5
			})

			bench('Parser v2: memory allocation', () => {
				// Multiple runs to see memory patterns
				for (let i = 0; i < 10; i++) {
					const result = parserV2.split(testText)
				}
			}, {
				time: 3000,
				iterations: 5
			})
		})
	})
})
