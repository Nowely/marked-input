import {describe, it, expect, vi, beforeEach, MockedFunction} from 'vitest'
import {Parser} from './Parser'
import {Markup} from './types'

// Mock dependencies
vi.mock('./markupToRegex')
vi.mock('./normalizeMark')
vi.mock('./ParserMatches')
vi.mock('../utils/isObject')

import {markupToRegex} from './markupToRegex'
import {normalizeMark} from './normalizeMark'
import {ParserMatches} from './ParserMatches'
import {isObject} from '../utils/isObject'

describe(`Utility: ${Parser.name}`, () => {
	let mockMarkupToRegex: MockedFunction<typeof markupToRegex>
	let mockNormalizeMark: MockedFunction<typeof normalizeMark>
	let mockParserMatches: MockedFunction<any>
	let mockIsObject: MockedFunction<typeof isObject>

	beforeEach(() => {
		vi.clearAllMocks()
		mockMarkupToRegex = vi.mocked(markupToRegex)
		mockNormalizeMark = vi.mocked(normalizeMark)
		mockIsObject = vi.mocked(isObject)
		mockParserMatches = vi.mocked(ParserMatches)
	})

	describe('constructor', () => {
		it('should initialize with markups and create regex patterns', () => {
			const markups: Markup[] = ['@[__label__](__value__)', '#[__label__]']
			const mockRegex1 = /test1/
			const mockRegex2 = /test2/

			mockMarkupToRegex.mockReturnValueOnce(mockRegex1).mockReturnValueOnce(mockRegex2)

			const parser = new Parser(markups)

			expect(parser.markups).toBe(markups)
			expect(parser.regExps).toEqual([mockRegex1, mockRegex2])
			expect(parser.uniRegExp).toEqual(new RegExp('test1|test2'))
			expect(markupToRegex).toHaveBeenCalledTimes(2)
			expect(markupToRegex).toHaveBeenCalledWith(markups[0], 0, markups)
			expect(markupToRegex).toHaveBeenCalledWith(markups[1], 1, markups)
		})

		it('should handle single markup', () => {
			const markups: Markup[] = ['@[__label__](__value__)']
			const mockRegex = /test/

			mockMarkupToRegex.mockReturnValue(mockRegex)

			const parser = new Parser(markups)

			expect(parser.regExps).toEqual([mockRegex])
			expect(parser.uniRegExp).toEqual(new RegExp('test'))
		})

		it('should handle empty markups array', () => {
			const markups: Markup[] = []

			const parser = new Parser(markups)

			expect(parser.markups).toEqual([])
			expect(parser.regExps).toEqual([])
			expect(parser.uniRegExp).toEqual(new RegExp(''))
		})
	})

	describe('static split', () => {
		it('should parse text with provided options and return MarkStruct array', () => {
			const value = 'Hello @[world](value) test'
			const options = [
				{markup: '@[__label__](__value__)' as Markup, trigger: '@', data: []},
				{markup: '#[__label__]' as Markup, trigger: '#', data: []},
			]

			const mockPieces: any[] = ['Hello ', {annotation: '@[world](value)', label: 'world', value: 'value'}]
			const mockParserInstance = {
				split: vi.fn().mockReturnValue(mockPieces),
			}

			// Mock the Parser constructor
			const parserSpy = vi.spyOn(Parser.prototype, 'split').mockReturnValue(mockPieces)
			mockIsObject.mockReturnValueOnce(false).mockReturnValueOnce(true)

			const result = Parser.split(value, options)

			expect(result).toEqual([{label: 'Hello '}, {annotation: '@[world](value)', label: 'world', value: 'value'}])
			expect(parserSpy).toHaveBeenCalledWith(value)
			expect(mockIsObject).toHaveBeenCalledTimes(2)
		})

		it('should handle text without options', () => {
			const value = 'Hello world'

			mockIsObject.mockReturnValue(false)

			const result = Parser.split(value)

			expect(result).toEqual([{label: 'Hello world'}])
			expect(mockIsObject).toHaveBeenCalledWith('Hello world')
		})

		it('should handle text with undefined options', () => {
			const value = 'Hello world'

			mockIsObject.mockReturnValue(false)

			const result = Parser.split(value, undefined)

			expect(result).toEqual([{label: 'Hello world'}])
		})

		it('should handle empty options array', () => {
			const value = 'Hello @[world](value) test'

			// Empty options array results in empty markups array
			const mockPieces = ['Hello @[world](value) test']
			const parserSpy = vi.spyOn(Parser.prototype, 'split').mockReturnValue(mockPieces)
			mockIsObject.mockReturnValue(false)

			const result = Parser.split(value, [])

			expect(result).toEqual([{label: 'Hello @[world](value) test'}])
		})

		it('should handle options with undefined markup', () => {
			const value = 'Hello @[world](value) test'
			const options = [{markup: undefined as any, trigger: '@', data: []}]

			// Options with undefined markup results in [undefined] markups
			const mockPieces = ['Hello @[world](value) test']
			const parserSpy = vi.spyOn(Parser.prototype, 'split').mockReturnValue(mockPieces)
			mockIsObject.mockReturnValue(false)

			const result = Parser.split(value, options)

			expect(result).toEqual([{label: 'Hello @[world](value) test'}])
		})

		it('should correctly convert pieces to MarkStruct', () => {
			const value = 'test'
			const options = [{markup: '@[__label__](__value__)' as Markup, trigger: '@', data: []}]

			const mockPieces = [
				'text',
				{
					label: 'mark',
					value: 'val',
					annotation: '@[mark](val)',
					input: '@[mark](val)',
					index: 0,
					optionIndex: 0,
				},
			]
			const parserSpy = vi.spyOn(Parser.prototype, 'split').mockReturnValue(mockPieces)

			mockIsObject.mockReturnValueOnce(false).mockReturnValueOnce(true)

			const result = Parser.split(value, options)

			expect(result).toEqual([
				{label: 'text'},
				{
					label: 'mark',
					value: 'val',
					annotation: '@[mark](val)',
					input: '@[mark](val)',
					index: 0,
					optionIndex: 0,
				},
			])
		})
	})

	describe('split', () => {
		it('should exist as a method', () => {
			const parser = new Parser(['@[__label__](__value__)'])
			expect(typeof parser.split).toBe('function')
		})
	})

	describe('iterateMatches', () => {
		it('should process ParserMatches iterator and normalize marks', () => {
			const markups: Markup[] = ['@[__label__](__value__)', '#[__label__]']
			const parser = new Parser(markups)

			const mockMark1 = {
				annotation: '@[hello](world)',
				label: 'hello',
				value: 'world',
				optionIndex: 0,
				input: '@[hello](world)',
				index: 6,
			}
			const mockMark2 = {
				annotation: '#[test]',
				label: 'test',
				value: undefined,
				optionIndex: 1,
				input: '#[test]',
				index: 20,
			}

			const mockNormalizedMark1 = {...mockMark1}
			const mockNormalizedMark2 = {...mockMark2}

			// Mock the iterator
			const mockIterator = {
				[Symbol.iterator]: () => mockIterator,
				next: vi
					.fn()
					.mockReturnValueOnce({done: false, value: ['Hello ', mockMark1]})
					.mockReturnValueOnce({done: false, value: [' world ', mockMark2]})
					.mockReturnValueOnce({done: true, value: null}),
			}

			mockParserMatches.mockImplementation(() => mockIterator)
			mockNormalizeMark.mockReturnValueOnce(mockNormalizedMark1).mockReturnValueOnce(mockNormalizedMark2)

			const result = parser.iterateMatches('Hello @[hello](world) world #[test]')

			expect(result).toEqual(['Hello ', mockNormalizedMark1, ' world ', mockNormalizedMark2])

			expect(mockParserMatches).toHaveBeenCalledWith(
				'Hello @[hello](world) world #[test]',
				parser.uniRegExp,
				parser.regExps
			)
			expect(mockNormalizeMark).toHaveBeenCalledTimes(2)
			expect(mockNormalizeMark).toHaveBeenNthCalledWith(1, mockMark1, markups[0])
			expect(mockNormalizeMark).toHaveBeenNthCalledWith(2, mockMark2, markups[1])
		})

		it('should exist as a method', () => {
			const parser = new Parser(['@[__label__](__value__)'])
			expect(typeof parser.iterateMatches).toBe('function')
		})

		it('should handle null marks from iterator', () => {
			const parser = new Parser(['@[__label__](__value__)'])

			const mockIterator = {
				[Symbol.iterator]: () => mockIterator,
				next: vi
					.fn()
					.mockReturnValueOnce({done: false, value: ['Hello ', {annotation: 'test'}]})
					.mockReturnValueOnce({done: false, value: [' world', null]})
					.mockReturnValueOnce({done: true, value: null}),
			}

			mockParserMatches.mockImplementation(() => mockIterator)
			mockNormalizeMark.mockReturnValue({
				annotation: '@[test]',
				label: 'test',
				value: undefined,
				optionIndex: 0,
				input: '@[test]',
				index: 6,
			})

			const result = parser.iterateMatches('Hello @[test] world')

			expect(result).toEqual([
				'Hello ',
				{annotation: '@[test]', label: 'test', value: undefined, optionIndex: 0, input: '@[test]', index: 6},
				' world',
			])
		})
	})

	describe('error handling', () => {
		it('should handle malformed markups gracefully', () => {
			const markups: Markup[] = ['@[__label__' as Markup, 'invalid' as Markup]
			mockMarkupToRegex.mockReturnValue(/test/) // Mock to avoid actual regex creation

			const parser = new Parser(markups)

			// Should not throw during construction
			expect(parser.markups).toEqual(markups)
			expect(parser.regExps).toHaveLength(2)
		})

		it('should handle empty markups gracefully', () => {
			const parser = new Parser([])
			expect(parser.markups).toEqual([])
			expect(parser.regExps).toEqual([])
		})

		it('should handle constructor with various inputs', () => {
			expect(() => new Parser(['test' as Markup])).not.toThrow()
			expect(() => new Parser([])).not.toThrow()
		})
	})
})
