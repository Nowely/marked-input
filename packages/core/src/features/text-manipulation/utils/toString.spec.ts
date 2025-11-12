import {describe, it, expect} from 'vitest'
import {toString} from './toString'
import {Token} from '../../parsing/ParserV2/types'
import {MarkupDescriptor} from '../../parsing/ParserV2/core/MarkupDescriptor'
import {Markup} from '../../parsing/ParserV2/types'

// Helper to create mock MarkupDescriptor for tests
const createMockDescriptor = (markup: Markup, index: number): MarkupDescriptor => ({
	markup,
	index,
	segments: [],
	gapTypes: [],
	hasNested: false,
	hasTwoValues: false,
	segmentGlobalIndices: [],
})

describe(`Utility: ${toString.name}`, () => {
	it('should return empty string for empty tokens array', () => {
		const tokens: Token[] = []

		const result = toString(tokens)

		expect(result).toBe('')
	})

	it('should handle plain text tokens', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'Hello', position: {start: 0, end: 5}},
			{type: 'text', content: ' ', position: {start: 5, end: 6}},
			{type: 'text', content: 'world', position: {start: 6, end: 11}},
		]

		const result = toString(tokens)

		expect(result).toBe('Hello world')
	})

	it('should handle annotated marks', () => {
		const tokens: Token[] = [
			{
				type: 'mark',
				value: 'Hello',
				meta: 'greeting',
				content: '@[Hello](greeting)',
				position: {start: 0, end: 18},
				descriptor: createMockDescriptor('@[__value__](__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('@[Hello](greeting)')
	})

	it('should handle mix of plain and annotated marks', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'Start ', position: {start: 0, end: 6}},
			{
				type: 'mark',
				value: 'bold',
				meta: 'strong',
				content: '**bold**(strong)',
				position: {start: 6, end: 23},
				descriptor: createMockDescriptor('**__value__**(__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
			{type: 'text', content: ' and ', position: {start: 23, end: 28}},
			{
				type: 'mark',
				value: 'italic',
				meta: undefined,
				content: '*italic*',
				position: {start: 28, end: 37},
				descriptor: createMockDescriptor('*__value__*' as Markup, 1),
				children: [],
				nested: undefined,
			},
			{type: 'text', content: ' end', position: {start: 37, end: 41}},
		]

		const result = toString(tokens)

		expect(result).toBe('Start **bold**(strong) and *italic* end')
	})

	it('should handle marks with undefined meta', () => {
		const tokens: Token[] = [
			{
				type: 'mark',
				value: 'hashtag',
				meta: undefined,
				content: '#hashtag',
				position: {start: 0, end: 8},
				descriptor: createMockDescriptor('#__value__' as Markup, 0),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('#hashtag')
	})

	it('should use correct markup based on descriptor', () => {
		const tokens: Token[] = [
			{
				type: 'mark',
				value: 'mention',
				meta: 'user',
				content: '@[mention](user)',
				position: {start: 0, end: 16},
				descriptor: createMockDescriptor('@[__value__](__meta__)' as Markup, 1),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('@[mention](user)')
	})

	it('should handle multiple marks with different descriptors', () => {
		const tokens: Token[] = [
			{
				type: 'mark',
				value: 'bold',
				meta: 'strong',
				content: '**bold**(strong)',
				position: {start: 0, end: 17},
				descriptor: createMockDescriptor('**__value__**(__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
			{
				type: 'mark',
				value: 'link',
				meta: 'url',
				content: '[link](url)',
				position: {start: 17, end: 28},
				descriptor: createMockDescriptor('[__value__](__meta__)' as Markup, 1),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('**bold**(strong)[link](url)')
	})

	it('should handle marks with special characters', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'User ', position: {start: 0, end: 5}},
			{
				type: 'mark',
				value: 'user@domain.com',
				meta: 'click here',
				content: '[user@domain.com](click here)',
				position: {start: 5, end: 33},
				descriptor: createMockDescriptor('[__value__](__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
			{type: 'text', content: ' says hello', position: {start: 33, end: 44}},
		]

		const result = toString(tokens)

		expect(result).toBe('User [user@domain.com](click here) says hello')
	})

	it('should handle empty value and meta', () => {
		const tokens: Token[] = [
			{
				type: 'mark',
				value: '',
				meta: '',
				content: '@[]()',
				position: {start: 0, end: 4},
				descriptor: createMockDescriptor('@[__value__](__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('@[]()')
	})

	it('should concatenate all tokens in order', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'A', position: {start: 0, end: 1}},
			{type: 'text', content: 'B', position: {start: 1, end: 2}},
			{
				type: 'mark',
				value: 'C',
				meta: undefined,
				content: '*C*',
				position: {start: 2, end: 5},
				descriptor: createMockDescriptor('*__value__*' as Markup, 0),
				children: [],
				nested: undefined,
			},
			{type: 'text', content: 'D', position: {start: 5, end: 6}},
		]

		const result = toString(tokens)

		expect(result).toBe('AB*C*D')
	})

	it('should handle large arrays of tokens', () => {
		const tokens: Token[] = Array.from({length: 1000}, (_, i) => ({
			type: 'text' as const,
			content: `part${i}`,
			position: {start: i * 6, end: (i + 1) * 6},
		}))

		const result = toString(tokens)

		expect(result).toBe(tokens.map(t => t.content).join(''))
		expect(result.length).toBe(6890)
	})

	it('should handle tokens with unicode characters', () => {
		const tokens: Token[] = [
			{type: 'text', content: 'Hello 🌍 ', position: {start: 0, end: 9}},
			{
				type: 'mark',
				value: '🚀',
				meta: 'launch',
				content: '[🚀](launch)',
				position: {start: 9, end: 21},
				descriptor: createMockDescriptor('[__value__](__meta__)' as Markup, 0),
				children: [],
				nested: undefined,
			},
		]

		const result = toString(tokens)

		expect(result).toBe('Hello 🌍 [🚀](launch)')
	})
})
