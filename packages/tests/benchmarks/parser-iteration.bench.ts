import {bench, describe} from 'vitest'
import {Parser as ParserV2} from '../../core/src/features/parsing/ParserV2/'
import {performance} from 'perf_hooks'

// Test data generators
function generateIncrementalText(baseSize: number, increments: number): string[] {
	const inputs: string[] = []
	let currentText = 'Start: '

	for (let i = 0; i < increments; i++) {
		currentText += ` @[user${i}](User ${i}) some text and #[tag${i}] more content. `
		if (i % 5 === 0) { // Add some nested content every 5 iterations
			currentText += ` @[nested${i}](@[inner${i}](Inner ${i})) `
		}
		inputs.push(currentText)
	}

	return inputs
}

function generateComplexIncrementalText(baseSize: number, increments: number): string[] {
	const inputs: string[] = []
	let currentText = 'Complex document: '

	for (let i = 0; i < increments; i++) {
		// Add different types of markup
		currentText += ` @[user${i}](User ${i}) `
		currentText += `#[tag${i}] `
		currentText += `**[bold${i}]** `
		currentText += `"quote${i}" `

		if (i % 3 === 0) {
			currentText += ` @[complex${i}](@[nested${i}](Nested ${i}) with #[innerTag${i}]) `
		}

		inputs.push(currentText)
	}

	return inputs
}

// Performance measurement utilities
class PerformanceTracker {
	private measurements: number[] = []
	private startTime: number = 0

	start() {
		this.startTime = performance.now()
	}

	end(): number {
		const duration = performance.now() - this.startTime
		this.measurements.push(duration)
		return duration
	}

	getMeasurements(): number[] {
		return [...this.measurements]
	}

	getAverage(): number {
		return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length
	}

	getMin(): number {
		return Math.min(...this.measurements)
	}

	getMax(): number {
		return Math.max(...this.measurements)
	}

	getPercentile(p: number): number {
		const sorted = [...this.measurements].sort((a, b) => a - b)
		const index = Math.ceil((p / 100) * sorted.length) - 1
		return sorted[Math.max(0, index)]
	}

	reset() {
		this.measurements = []
		this.startTime = 0
	}
}

// Parser configurations
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
	},
	{
		markup: '"__label__"',
		trigger: '"',
		data: []
	}
]

describe('ParserV2 Iteration Performance Analysis', () => {
	const parser = new ParserV2(parserOptions.map(opt => opt.markup))

	describe('Incremental Parsing Performance', () => {
		const inputs = generateIncrementalText(20, 10) // 10 increments of growing text

		inputs.forEach((input, index) => {
			const markCount = (input.match(/@\[/g) || []).length +
			                 (input.match(/#\[/g) || []).length +
			                 (input.match(/\*\*\[/g) || []).length

			bench(`iteration ${index + 1} (${markCount} marks, ${input.length} chars)`, () => {
				parser.split(input)
			}, {
				time: 1000,
				iterations: Math.max(5, 50 - index * 2) // More iterations for smaller inputs
			})
		})
	})

	describe('Complex Incremental Parsing', () => {
		const inputs = generateComplexIncrementalText(15, 8) // 8 increments of complex text

		inputs.forEach((input, index) => {
			const markCount = (input.match(/@\[/g) || []).length +
			                 (input.match(/#\[/g) || []).length +
			                 (input.match(/\*\*\[/g) || []).length +
			                 (input.match(/"\[/g) || []).length

			bench(`complex iteration ${index + 1} (${markCount} marks, ${input.length} chars)`, () => {
				parser.split(input)
			}, {
				time: 1000,
				iterations: Math.max(3, 30 - index * 3) // Fewer iterations for complex inputs
			})
		})
	})

	describe('Per-Token Performance Analysis', () => {
		const testInput = generateIncrementalText(10, 15)[14] // Use the largest input

		bench('detailed token-by-token analysis', () => {
			const tracker = new PerformanceTracker()

			// Parse and measure each token extraction
			const parserInstance = new ParserV2(parserOptions.map(opt => opt.markup))
			const matches = parserInstance['createMatches'](testInput, parserOptions.map(opt => opt.markup))

			let tokenCount = 0
			for (const token of matches) {
				tokenCount++
				if (tokenCount > 100) break // Limit for benchmark
			}

			return tokenCount // Return to avoid dead code elimination
		}, {
			time: 2000,
			iterations: 5
		})
	})

	describe('Memory Scaling Analysis', () => {
		const sizes = [50, 100, 200, 500, 1000]

		sizes.forEach(size => {
			const input = generateIncrementalText(size, 1)[0]

			bench(`memory scaling (${size} marks)`, () => {
				const result = parser.split(input)
				// Force some memory pressure
				const json = JSON.stringify(result)
				return json.length
			}, {
				time: 1500,
				iterations: size <= 200 ? 10 : 3
			})
		})
	})

	describe('Parser State Performance', () => {
		const baseInput = generateIncrementalText(50, 1)[0]

		bench('parser instance reuse', () => {
			// Reuse the same parser instance
			let result = parser.split(baseInput)
			result = parser.split(baseInput + ' additional text @[extra](Extra)')
			result = parser.split(baseInput + ' @[modified](Modified)')

			return result.length
		}, {
			time: 1000,
			iterations: 20
		})

		bench('parser instance creation overhead', () => {
			// Create new parser instance each time
			const newParser = new ParserV2(parserOptions.map(opt => opt.markup))
			const result = newParser.split(baseInput)

			return result.length
		}, {
			time: 1000,
			iterations: 20
		})
	})

	describe('Real-time Editing Simulation', () => {
		const baseText = 'Start editing: @[user1](User 1) some text #[tag1]'

		bench('typing simulation (character by character)', () => {
			let currentText = baseText

			// Simulate typing 10 characters
			for (let i = 0; i < 10; i++) {
				currentText += 'a'
				parser.split(currentText)
			}

			return currentText.length
		}, {
			time: 1000,
			iterations: 15
		})

		bench('bulk editing simulation', () => {
			let currentText = baseText

			// Simulate bulk insertions
			const insertions = [
				' @[user2](User 2)',
				' and #[tag2]',
				' with **[bold]** text',
				' and @[user3](User 3)'
			]

			insertions.forEach(insert => {
				currentText += insert
				parser.split(currentText)
			})

			return currentText.length
		}, {
			time: 1000,
			iterations: 15
		})
	})
})
