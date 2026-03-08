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

	it('keeps single newlines as content within a block', () => {
		const tokens: Token[] = [text('line one\nline two\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(1)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one\nline two\nline three')
	})

	it('splits text by double newlines (empty lines) into separate blocks', () => {
		const tokens: Token[] = [text('line one\n\nline two\n\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('line two')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('line three')
	})

	it('handles block-level marks ending with double newline', () => {
		const heading = mark('# Hello\n\n', 0, 'Hello')
		heading.content = '# Hello\n\n'
		const tokens: Token[] = [heading, text('paragraph text', 10)]
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

	it('assigns correct positions to blocks with double newlines', () => {
		const tokens: Token[] = [text('aaa\n\nbbb\n\nccc', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks[0].startPos).toBe(0)
		expect(blocks[0].endPos).toBe(3)
		expect(blocks[1].startPos).toBe(5)
		expect(blocks[1].endPos).toBe(8)
		expect(blocks[2].startPos).toBe(10)
		expect(blocks[2].endPos).toBe(13)
	})

	it('handles consecutive double newlines as separate empty blocks', () => {
		const tokens: Token[] = [text('aaa\n\n\n\nbbb', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('aaa')
		expect(blocks[1].tokens).toHaveLength(0)
		expect((blocks[2].tokens[0] as TextToken).content).toBe('bbb')
	})

	it('creates empty block from trailing double newline', () => {
		const tokens: Token[] = [text('aaa\n\nbbb\n\n', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('aaa')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('bbb')
		expect(blocks[2].tokens).toHaveLength(0)
		expect(blocks[2].startPos).toBe(blocks[2].endPos)
	})

	it('single trailing newline stays as content in last block', () => {
		const tokens: Token[] = [text('aaa\n\nbbb\n', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('aaa')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('bbb\n')
	})

	it('generates unique block ids based on start position', () => {
		const tokens: Token[] = [text('aaa\n\nbbb\n\nccc', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		const ids = blocks.map(b => b.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('handles empty text token', () => {
		const tokens: Token[] = [text('', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(0)
	})

	it('handles text with only double newlines', () => {
		const tokens: Token[] = [text('\n\n\n\n', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
		blocks.forEach(b => {
			expect(b.tokens).toHaveLength(0)
			expect(b.startPos).toBe(b.endPos)
		})
	})

	it('handles \\r\\n\\r\\n line endings (Windows double newline)', () => {
		const tokens: Token[] = [text('line one\r\n\r\nline two\r\n\r\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('line two')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('line three')
	})

	it('handles single \\r\\n as content within block', () => {
		const tokens: Token[] = [text('line one\r\nline two', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(1)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one\nline two')
	})

	it('handles mixed single and double line endings', () => {
		const tokens: Token[] = [text('line one\nline two\r\n\r\nline three', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(2)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one\nline two')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('line three')
	})

	it('handles standalone \\r as newline content', () => {
		const tokens: Token[] = [text('line one\rline two', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(1)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('line one\nline two')
	})

	it('handles unicode and emoji content with double newlines', () => {
		const tokens: Token[] = [text('你好世界\n\n🎉 emoji\n\nØÆÅ', 0)]
		const blocks = splitTokensIntoBlocks(tokens)
		expect(blocks).toHaveLength(3)
		expect((blocks[0].tokens[0] as TextToken).content).toBe('你好世界')
		expect((blocks[1].tokens[0] as TextToken).content).toBe('🎉 emoji')
		expect((blocks[2].tokens[0] as TextToken).content).toBe('ØÆÅ')
	})

	it('handles very long text without performance issues', () => {
		const lines = Array(1000).fill('line')
		const longText = lines.join('\n\n')
		const tokens: Token[] = [text(longText, 0)]

		const start = performance.now()
		const blocks = splitTokensIntoBlocks(tokens)
		const duration = performance.now() - start

		expect(blocks).toHaveLength(1000)
		expect(duration).toBeLessThan(100)
	})
})