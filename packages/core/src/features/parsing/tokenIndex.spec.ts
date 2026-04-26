import {describe, it, expect} from 'vitest'

import type {MarkToken, TextToken, Token} from './parser/types'
import {createTokenIndex, pathEquals, pathKey, resolvePath, snapshotTokenShape} from './tokenIndex'

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

describe('TokenIndex', () => {
	it('builds paths for top-level and nested tokens', () => {
		const inner = mark('inner', 9, [text('leaf', 12)])
		const tokens = [text('hello ', 0), mark('outer', 6, [inner]), text('!', 20)]
		const index = createTokenIndex(tokens, 4)

		expect(index.pathFor(tokens[0])).toEqual([0])
		expect(index.pathFor(inner)).toEqual([1, 0])
		expect(index.pathFor(inner.children[0])).toEqual([1, 0, 0])
		expect(index.addressFor([1, 0])).toEqual({path: [1, 0], parseGeneration: 4})
		expect(index.key([1, 0, 0])).toBe('1.0.0')
	})

	it('resolves paths and rejects invalid paths', () => {
		const tokens = [text('a', 0), mark('b', 1)]
		const index = createTokenIndex(tokens, 2)

		expect(resolvePath(tokens, [1])).toBe(tokens[1])
		expect(resolvePath(tokens, [])).toBeUndefined()
		expect(resolvePath(tokens, [2])).toBeUndefined()
		expect(index.resolve([1, 0])).toBeUndefined()
	})

	it('compares paths by value', () => {
		expect(pathEquals([0, 1], [0, 1])).toBe(true)
		expect(pathEquals([0, 1], [1, 0])).toBe(false)
		expect(pathKey([2, 0, 3])).toBe('2.0.3')
	})

	it('rejects stale addresses before resolving same-path tokens', () => {
		const first = mark('first', 0)
		const firstIndex = createTokenIndex([first], 1)
		const staleAddress = firstIndex.addressFor([0])!

		const second = mark('second', 0)
		const secondIndex = createTokenIndex([second], 2)
		const result = secondIndex.resolveAddress(staleAddress, snapshotTokenShape(first))

		expect(result).toEqual({ok: false, reason: 'stale'})
	})

	it('rejects same-generation shape mismatches', () => {
		const oldToken = mark('first', 0)
		const currentToken = text('first', 0)
		const index = createTokenIndex([currentToken], 5)

		const result = index.resolveAddress({path: [0], parseGeneration: 5}, snapshotTokenShape(oldToken))

		expect(result).toEqual({ok: false, reason: 'stale'})
	})
})