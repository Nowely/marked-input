import {describe, expect, it} from 'vitest'

import type {Token, TextToken, MarkToken} from '../parsing/ParserV2/types'
import {splitTokensIntoBlocks} from './splitTokensIntoBlocks'

function text(content: string, start: number): TextToken {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

function mark(content: string, start: number, value = ''): MarkToken {
	return {
		type: 'mark',
		content,
		position: {start, end: start + content.length},
		value,
		children: [],
		descriptor: {
			markup: '' as any,
			index: 0,
			segments: [],
			gapTypes: [],
			hasNested: false,
			hasTwoValues: false,
			segmentGlobalIndices: [],
		},
	}
}

describe('splitTokensIntoBlocks', () => {
	it('returns empty array for empty tokens', () => {
		expect(splitTokensIntoBlocks([])).toEqual([])
	})

	it('groups single-line text into one block', () => {
		const tokens: Token[] = [text('hello world', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(1)
		expect(blocks[0].tokens).toHaveLength(1)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('hello world')
	})

	it('splits text by newlines into separate blocks', () => {
		const tokens: Token[] = [text('line one\nline two\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('line two')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('line three')
	})

	it('handles block-level marks ending with newline', () => {
		const heading = mark('# Hello\n', 0, 'Hello')
		heading.content = '# Hello\n'
		const tokens: Token[] = [heading, text('paragraph text', 9)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
		expect(blocks[0].tokens[0]).toBe(heading)
		expect((blocks[1].tokens[0] as TextToken).content).toBe('paragraph text')
	})

	it('keeps inline marks in the same block as surrounding text', () => {
		const tokens: Token[] = [text('hello ', 0), mark('@[world](meta)', 6, 'world'), text(' end', 20)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(1)
		expect(blocks[0].tokens).toHaveLength(3)
	})

	it('assigns correct positions to blocks', () => {
		const tokens: Token[] = [text('aaa\nbbb\nccc', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks[0].startPos).toBe(0)
		expect(blocks[0].endPos).toBe(3)
		expect(blocks[1].startPos).toBe(4)
		expect(blocks[1].endPos).toBe(7)
		expect(blocks[2].startPos).toBe(8)
		expect(blocks[2].endPos).toBe(11)
	})

	it('handles consecutive newlines (empty lines)', () => {
		const tokens: Token[] = [text('aaa\n\nbbb', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('aaa')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('bbb')
	})

	it('generates unique block ids based on start position', () => {
		const tokens: Token[] = [text('aaa\nbbb\nccc', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		const ids = blocks.map(b => b.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('handles empty text token', () => {
		const tokens: Token[] = [text('', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(0)
	})

	it('handles text with only newlines', () => {
		const tokens: Token[] = [text('\n\n\n', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(0)
	})

	it('handles \\r\\n line endings (Windows)', () => {
		const tokens: Token[] = [text('line one\r\nline two\r\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('line two')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('line three')
	})

	it('handles mixed \\n and \\r\\n line endings', () => {
		const tokens: Token[] = [text('line one\nline two\r\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
	})

	it('handles standalone \\r (old Mac style)', () => {
		const tokens: Token[] = [text('line one\rline two', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
	})

	it('handles unicode and emoji content', () => {
		const tokens: Token[] = [text('你好世界\n🎉 emoji\nØÆÅ', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('你好世界')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('🎉 emoji')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('ØÆÅ')
	})

	it('handles very long text without performance issues', () => {
		const lines = Array(1000).fill('line')
		const longText = lines.join('\n')
		const tokens: Token[] = [text(longText, 0)]

		const start = performance.now()
		const blocks = splitTokensIntoBlocks(tokens)
		const duration = performance.now() - start

		expect(blocks).toHaveLength(1000)
		expect(duration).toBeLessThan(100)
	})
})