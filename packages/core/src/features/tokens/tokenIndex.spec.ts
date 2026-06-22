import {describe, it, expect} from 'vitest'

import type {MarkToken, TextToken, Token} from './parser/types'
import {pathEquals, pathKey, resolvePath} from './tokenIndex'

function text(content: string, start: number): TextToken {
	return {type: 'text', content, position: {start, end: start + content.length}}
}

function mark(value: string, start: number, children: Token[] = []): MarkToken {
	return {
		type: 'mark',
		content: `@[${value}]`,
		position: {start, end: start + value.length + 3},
		descriptor: {
			markup: '@[__value__]',
			index: 0,
			segments: ['@[', ']'],
			gapTypes: ['value'],
			hasSlot: false,
			hasTwoValues: false,
			segmentGlobalIndices: [0, 1],
		},
		value,
		children,
	}
}

describe('path utilities', () => {
	it('resolves top-level and nested paths', () => {
		const inner = mark('inner', 9, [text('leaf', 12)])
		const tokens = [text('hello ', 0), mark('outer', 6, [inner]), text('!', 20)]

		expect(resolvePath(tokens, [0])).toBe(tokens[0])
		expect(resolvePath(tokens, [1, 0])).toBe(inner)
		expect(resolvePath(tokens, [1, 0, 0])).toBe(inner.children[0])
	})

	it('resolves paths and rejects invalid paths', () => {
		const tokens = [text('a', 0), mark('b', 1)]

		expect(resolvePath(tokens, [1])).toBe(tokens[1])
		expect(resolvePath(tokens, [])).toBeUndefined()
		expect(resolvePath(tokens, [2])).toBeUndefined()
		// a text token has no children — descending past it fails
		expect(resolvePath(tokens, [0, 0])).toBeUndefined()
		// an empty mark has no child at [0]
		expect(resolvePath(tokens, [1, 0])).toBeUndefined()
	})

	it('compares paths by value', () => {
		expect(pathEquals([0, 1], [0, 1])).toBe(true)
		expect(pathEquals([0, 1], [1, 0])).toBe(false)
		expect(pathKey([2, 0, 3])).toBe('2.0.3')
	})
})