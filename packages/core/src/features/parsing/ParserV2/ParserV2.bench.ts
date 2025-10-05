import {describe, it, expect} from 'vitest'
import {ParserV2} from './ParserV2'
import {Markup} from '../../../shared/types'

describe('ParserV2 Performance Benchmark', () => {
	const markups: Markup[] = ['@[__label__](__value__)', '#[__label__]']

	it('should benchmark simple parsing (100 marks)', () => {
		const parser = new ParserV2(markups)

		// Generate input with 100 marks
		let input = 'Start '
		for (let i = 0; i < 100; i++) {
			input += `@[user${i}](User ${i}) text `
		}
		input += 'end'

		const start = performance.now()
		const result = parser.split(input)
		const end = performance.now()

		const duration = end - start
		console.log(`\n📊 Simple parsing (100 marks): ${duration.toFixed(2)}ms`)

		expect(result.filter(t => t.type === 'mark')).toHaveLength(100)
		expect(duration).toBeLessThan(100) // Should be fast
	})

	it('should benchmark nested parsing', () => {
		const parser = new ParserV2(markups)

		// Generate input with nested marks
		const input = '@[outer1 #[inner1] text] and @[outer2 #[inner2] #[inner3] more] end'

		const iterations = 100
		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			parser.split(input)
		}

		const end = performance.now()
		const duration = end - start
		const avgDuration = duration / iterations

		console.log(`\n📊 Nested parsing (${iterations} iterations): ${avgDuration.toFixed(3)}ms per iteration`)

		expect(avgDuration).toBeLessThan(5) // Should be very fast per iteration
	})

	it('should benchmark parser instance creation', () => {
		const iterations = 1000
		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			new ParserV2(markups as any)
		}

		const end = performance.now()
		const duration = end - start
		const avgDuration = duration / iterations

		console.log(`\n📊 Parser creation (${iterations} iterations): ${avgDuration.toFixed(3)}ms per instance`)

		expect(avgDuration).toBeLessThan(1) // Should be fast to create
	})

	it('should benchmark mixed patterns', () => {
		const parser = new ParserV2(markups)

		const input = 'Text @[user1](val1) #[tag1] more @[user2](val2) #[tag2] and @[user3](val3) end'

		const iterations = 1000
		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			parser.split(input)
		}

		const end = performance.now()
		const duration = end - start
		const avgDuration = duration / iterations

		console.log(`\n📊 Mixed patterns (${iterations} iterations): ${avgDuration.toFixed(3)}ms per iteration`)

		expect(avgDuration).toBeLessThan(2)
	})

	it('should benchmark long text with sparse marks', () => {
		const parser = new ParserV2(markups)

		// Long text with only 5 marks
		const longText = 'Lorem ipsum '.repeat(100)
		const input = `${longText}@[user1](val1) ${longText}#[tag] ${longText}@[user2](val2) ${longText}#[tag2] ${longText}@[user3](val3)`

		const iterations = 100
		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			parser.split(input)
		}

		const end = performance.now()
		const duration = end - start
		const avgDuration = duration / iterations

		console.log(`\n📊 Long sparse text (${iterations} iterations): ${avgDuration.toFixed(3)}ms per iteration`)
		console.log(`   Text length: ${input.length} chars, marks: 5`)

		expect(avgDuration).toBeLessThan(10)
	})
})
