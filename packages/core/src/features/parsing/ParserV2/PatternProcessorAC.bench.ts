/**
 * Benchmark for AC-based pattern processors
 * Compares AC1, AC2, AC3 with current V2 implementation
 */

import {bench, describe} from 'vitest'
import {Parser as ParserV2} from './Parser'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {AhoCorasick} from './utils/AhoCorasick'
import {PatternProcessorAC1} from './core/PatternProcessorAC1'
import {PatternProcessorAC2} from './core/PatternProcessorAC2'
import {PatternProcessorAC3} from './core/PatternProcessorAC3'
import {Markup} from './types'

// Test data
const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']

function generateText(marks: number): string {
	let result = 'Text with marks:'
	for (let i = 0; i < marks; i++) {
		result += ` @[user${i}](User ${i}) and #[tag${i}]`
	}
	result += ' end of text.'
	return result
}

const testCases = [
	{name: '10 marks', text: generateText(10)},
	{name: '50 marks', text: generateText(50)},
	{name: '100 marks', text: generateText(100)},
]

describe('AC Pattern Processor Benchmarks', () => {
	for (const {name, text} of testCases) {
		describe(name, () => {
			// Current V2 implementation
			bench('V2 (current PatternProcessor)', () => {
				const parser = new ParserV2(markups)
				parser.split(text)
			})

			// AC1: Pattern-Level AC
			bench('AC1 (Pattern-Level)', () => {
				const registry = new MarkupRegistry(markups)
				const ac = new AhoCorasick(registry.segments)
				const processor = new PatternProcessorAC1(registry)
				
				const segments = ac.search(text)
				processor.processSegments(segments, text)
			})

			// AC2: Two-Level AC
			bench('AC2 (Two-Level)', () => {
				const registry = new MarkupRegistry(markups)
				const ac = new AhoCorasick(registry.segments)
				const processor = new PatternProcessorAC2(registry)
				
				const segments = ac.search(text)
				processor.processSegments(segments, text)
			})

			// AC3: Extended AC with gaps
			bench('AC3 (Extended with gaps)', () => {
				const registry = new MarkupRegistry(markups)
				const ac = new AhoCorasick(registry.segments)
				const processor = new PatternProcessorAC3(registry)
				
				const segments = ac.search(text)
				processor.processSegments(segments, text)
			})
		})
	}
})

