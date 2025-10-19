import {describe, it, expect} from 'vitest'
import {Parser} from './Parser'
import {Markup} from './types'

describe('ParserV2 Performance Benchmark', () => {
	const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']

	it('should benchmark simple parsing (100 marks)', () => {
		const parser = new Parser(markups)

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
		console.log(`   Input length: ${input.length} chars, marks found: ${result.filter(t => t.type === 'mark').length}`)

		expect(result.filter(t => t.type === 'mark')).toHaveLength(100)

		// Performance check: should complete in reasonable time (less than 1 second on modern hardware)
		// This is a soft check to avoid flaky tests on slower machines
		if (duration > 1000) {
			console.warn(`⚠️  Parsing took longer than expected: ${duration.toFixed(2)}ms`)
		}
	})

	it('should benchmark nested parsing', () => {
		const parser = new Parser(markups)

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

		// Performance check: should be reasonably fast (less than 10ms per iteration on modern hardware)
		// This is a soft check to avoid flaky tests on slower machines
		if (avgDuration > 50) {
			console.warn(`⚠️  Nested parsing took longer than expected: ${avgDuration.toFixed(3)}ms per iteration`)
		}
	})

	it('should benchmark parser instance creation', () => {
		const iterations = 1000
		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			new Parser(markups as any)
		}

		const end = performance.now()
		const duration = end - start
		const avgDuration = duration / iterations

		console.log(`\n📊 Parser creation (${iterations} iterations): ${avgDuration.toFixed(3)}ms per instance`)

		// Performance check: should be very fast to create (less than 1ms per instance on modern hardware)
		// This is a soft check to avoid flaky tests on slower machines
		if (avgDuration > 5) {
			console.warn(`⚠️  Parser creation took longer than expected: ${avgDuration.toFixed(3)}ms per instance`)
		}
	})

	it('should benchmark mixed patterns', () => {
		const parser = new Parser(markups)

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

		// Performance check: should be fast (less than 5ms per iteration on modern hardware)
		// This is a soft check to avoid flaky tests on slower machines
		if (avgDuration > 20) {
			console.warn(`⚠️  Mixed patterns parsing took longer than expected: ${avgDuration.toFixed(3)}ms per iteration`)
		}
	})

	it('should benchmark long text with sparse marks', () => {
		const parser = new Parser(markups)

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

		// Performance check: should handle long texts reasonably well (less than 50ms per iteration on modern hardware)
		// This is a soft check to avoid flaky tests on slower machines
		if (avgDuration > 100) {
			console.warn(`⚠️  Long text parsing took longer than expected: ${avgDuration.toFixed(3)}ms per iteration`)
		}
	})
})
