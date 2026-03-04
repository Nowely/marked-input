import {describe, expect, it} from 'vitest'
import type {Block} from './splitTokensIntoBlocks'
import {splitTokensIntoBlocks} from './splitTokensIntoBlocks'
import {reorderBlocks} from './reorderBlocks'
import {Parser} from '../parsing/ParserV2/Parser'
import type {TextToken} from '../parsing/ParserV2/types'

function makeBlocks(...lines: string[]): {value: string; blocks: Block[]} {
	const value = lines.join('\n')
	let pos = 0
	const blocks: Block[] = lines.map(line => {
		const block: Block = {
			id: `block-${pos}`,
			tokens: [{type: 'text', content: line, position: {start: pos, end: pos + line.length}}],
			startPos: pos,
			endPos: pos + line.length,
		}
		pos += line.length + 1
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
		expect(result).toBe('bbb\naaa\nccc')
	})

	it('moves block backward', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		const result = reorderBlocks(value, blocks, 2, 0)
		expect(result).toBe('ccc\naaa\nbbb')
	})

	it('moves block to end', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc')
		const result = reorderBlocks(value, blocks, 0, 3)
		expect(result).toBe('bbb\nccc\naaa')
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
		expect(result).toBe('bbb\nccc\nddd\naaa')
	})

	it('moves last block to first position', () => {
		const {value, blocks} = makeBlocks('aaa', 'bbb', 'ccc', 'ddd')
		const result = reorderBlocks(value, blocks, 3, 0)
		expect(result).toBe('ddd\naaa\nbbb\nccc')
	})
})

describe('reorderBlocks round-trip (reorder → re-parse → re-split)', () => {
	it('plain text: reordered value re-parses into correct blocks', () => {
		const original = 'aaa\nbbb\nccc'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\naaa\nccc')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)

		expect(newBlocks).toHaveLength(3)
		expect((newBlocks[0].tokens[0] as TextToken).content).toBe('bbb')
		expect((newBlocks[1].tokens[0] as TextToken).content).toBe('aaa')
		expect((newBlocks[2].tokens[0] as TextToken).content).toBe('ccc')
	})

	it('markdown: reordered value re-parses into correct blocks', () => {
		const original = '# Heading\nParagraph text\n## Subheading'
		const parser = new Parser(['# __nested__\n', '## __nested__\n'])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		expect(blocks).toHaveLength(3)

		const reordered = reorderBlocks(original, blocks, 2, 0)
		expect(reordered).toBe('## Subheading\n# Heading\nParagraph text')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)

		expect(newBlocks).toHaveLength(3)
	})

	it('full cycle: split → reorder → re-parse → re-split produces consistent blocks', () => {
		const lines = ['First line', 'Second line', 'Third line', 'Fourth line']
		const original = lines.join('\n')
		const parser = new Parser([])

		const tokens1 = parser.parse(original)
		const blocks1 = splitTokensIntoBlocks(tokens1)
		expect(blocks1).toHaveLength(4)

		const reordered = reorderBlocks(original, blocks1, 0, 4)
		expect(reordered).toBe('Second line\nThird line\nFourth line\nFirst line')

		const tokens2 = parser.parse(reordered)
		const blocks2 = splitTokensIntoBlocks(tokens2)
		expect(blocks2).toHaveLength(4)
		expect((blocks2[0].tokens[0] as TextToken).content).toBe('Second line')
		expect((blocks2[3].tokens[0] as TextToken).content).toBe('First line')

		const reordered2 = reorderBlocks(reordered, blocks2, 3, 0)
		expect(reordered2).toBe(original)
	})

	it('preserves single newline between adjacent blocks after reorder', () => {
		const original = 'aaa\nbbb\nccc'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\naaa\nccc')
		expect(reordered.split('\n')).toHaveLength(3)
	})

	it('does not preserve trailing newline from original after reorder', () => {
		const original = 'aaa\nbbb\nccc\n'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		expect(blocks).toHaveLength(3)
		expect(blocks[2].endPos).toBe(11)

		const reordered = reorderBlocks(original, blocks, 0, 2)
		expect(reordered).toBe('bbb\naaa\nccc')
	})

	it('handles unicode content correctly', () => {
		const original = '你好\n世界\n🎉'
		const parser = new Parser([])
		const tokens = parser.parse(original)
		const blocks = splitTokensIntoBlocks(tokens)

		const reordered = reorderBlocks(original, blocks, 2, 0)
		expect(reordered).toBe('🎉\n你好\n世界')

		const newTokens = parser.parse(reordered)
		const newBlocks = splitTokensIntoBlocks(newTokens)
		expect((newBlocks[0].tokens[0] as TextToken).content).toBe('🎉')
		expect((newBlocks[1].tokens[0] as TextToken).content).toBe('你好')
		expect((newBlocks[2].tokens[0] as TextToken).content).toBe('世界')
	})
})
