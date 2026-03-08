import {describe, expect, it} from 'vitest'

import {Parser} from '../parsing/ParserV2/Parser'
import type {TextToken} from '../parsing/ParserV2/types'
import {reorderBlocks} from './reorderBlocks'
import type {Block} from './splitTokensIntoBlocks'
import {splitTokensIntoBlocks} from './splitTokensIntoBlocks'

function makeBlocks(...lines: string[]): {value: string; blocks: Block[]} {
	const value = lines.join('\n\n')
	let pos = 0
	const blocks: Block[] = lines.map(line => {
		const block: Block = {
			id: `block-${pos}`,
			tokens: [{type: 'text', content: line, position: {start: pos, end: pos + line.length}}],
			startPos: pos,
			endPos: pos + line.length,
		}
		pos += line.length + 2
		return block
	})
	return {value, blocks}
}

describe('reorderBlocks', () => {
	it('returns same value when source equals target', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		expect(reorderBlocks(value, blocks, 1, 1)).toBe(value)
	})

	it('returns same value when source is adjacent to target', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		expect(reorderBlocks(value, blocks, 1, 2)).toBe(value)
	})

	it('moves block forward', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		const result = reorderBlocks(value, blocks, 0, 2)
		expect(result).toBe('bbb\n\naaa\n\nccc')
	})

	it('moves block backward', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		const result = reorderBlocks(value, blocks, 2, 0)
		expect(result).toBe('ccc\n\naaa\n\nbbb')
	})

	it('moves block to end', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		const result = reorderBlocks(value, blocks, 0, 3)
		expect(result).toBe('bbb\n\nccc\n\naaa')
	})

	it('returns same value for single block', () => {
		const {value, blocks} = makeBlocks('only one')
		expect(reorderBlocks(value, blocks, 0, 0)).toBe(value)
	})

	it('returns same value for invalid indices', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb')
		expect(reorderBlocks(value, blocks, -1, 0)).toBe(value)
		expect(reorderBlocks(value, blocks, 5, 0)).toBe(value)
		expect(reorderBlocks(value, blocks, 0, -1)).toBe(value)
		expect(reorderBlocks(value, blocks, 0, 5)).toBe(value)
	})

	it('returns same value for empty string', () => {
		expect(reorderBlocks('', [], 0, 0)).toBe('')
	})

	it('moves first block to last position', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc', 'ddd')
		const result = reorderBlocks(value, blocks, 0, 4)
		expect(result).toBe('bbb\n\nccc\n\nddd\n\naaa')
	})

	it('moves last block to first position', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc', 'ddd')
		const result = reorderBlocks(value, blocks, 3, 0)
		expect(result).toBe('ddd\n\naaa\n\nbbb\n\nccc')
	})
})

describe('reorderBlocks round-trip (reorder → re-parse → re-split)', () => {
	it('plain text: reordered value re-parses into correct blocks', () => {
		const original = 'aaa\n\nbbb\n\nccc'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\n\naaa\n\nccc')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)

		expect(newBlocks).toHaveLength(3)
		expect((newBlocks[0].tokens[0] as TextToken).content).toBe('bbb')
		expect((newBlocks[1].tokens[0] as TextToken).content).toBe('aaa')
		expect((newBlocks[2].tokens[0] as TextToken).content).toBe('ccc')
	})

	it('markdown: reordered value re-parses into correct blocks', () => {
		const original = '# Heading\n\nParagraph text\n\n## Subheading'
		const parser = new Parser(['# __nested__\n\n', '## __nested__\n\n'])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		expect(blocks).toHaveLength(3)

		const reordered = reorderBlocks(original, blocks, 2, 0)
		expect(reordered).toBe('## Subheading\n\n# Heading\n\nParagraph text')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)

		expect(newBlocks).toHaveLength(3)
	})

	it('full cycle: split → reorder → re-parse → re-split produces consistent blocks', () => {
		const lines = ['First line', 'Second line', 'Third line', 'Fourth line']
		const original = lines.join('\n\n')
		const parser = new Parser([])

		const tokens1 = parser.parse(original)
		const blocks1 = splitTokensIntoBlocks(tokens1)
		expect(blocks1).toHaveLength(4)

		const reordered = reorderBlocks(original, blocks1, 0, 4)
		expect(reordered).toBe('Second line\n\nThird line\n\nFourth line\n\nFirst line')

		const tokens2 = parser.parse(reordered)
		const blocks2 = splitTokensIntoBlocks(tokens2)
		expect(blocks2).toHaveLength(4)
		expect((blocks2[0].tokens[0] as TextToken).content).toBe('Second line')
		expect((blocks2[3].tokens[0] as TextToken).content).toBe('First line')

		const reordered2 = reorderBlocks(reordered, blocks2, 3, 0)
		expect(reordered2).toBe(original)
	})

	it('preserves double newline between adjacent blocks after reorder', () => {
		const original = 'aaa\n\nbbb\n\nccc'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\n\naaa\n\nccc')
		expect(reordered.split('\n\n')).toHaveLength(3)
	})

	it('trailing double newline creates empty block and is preserved after reorder', () => {
		const original = 'aaa\n\nbbb\n\nccc\n\n'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		expect(blocks).toHaveLength(4)
		expect(blocks[2].endPos).toBe(13)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\n\naaa\n\nccc\n\n')
	})

	it('handles unicode content correctly', () => {
		const original = '你好\n\n世界\n\n🎉'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 2, 0)
		expect(reordered).toBe('🎉\n\n你好\n\n世界')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)
		expect((newBlocks[0].tokens[0] as TextToken).content).toBe('🎉')
		expect((newBlocks[1].tokens[0] as TextToken).content).toBe('你好')
		expect((newBlocks[2].tokens[0] as TextToken).content).toBe('世界')
	})
})