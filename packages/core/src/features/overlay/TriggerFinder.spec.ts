/* oxlint-disable no-unsafe-type-assertion */
import {afterEach, describe, expect, it, vi} from 'vitest'

import type {Markup} from '../tokens'
import {TriggerFinder} from './TriggerFinder'

function mockSelection(text: string, offset: number): Text {
	const node = document.createTextNode(text)
	document.body.appendChild(node)
	vi.spyOn(window, 'getSelection').mockReturnValue({
		anchorNode: node,
		anchorOffset: offset,
		isCollapsed: true,
		focusNode: node,
		focusOffset: offset,
		rangeCount: 1,
	} as unknown as Selection)
	return node
}

describe(`Utility: ${TriggerFinder.name}`, () => {
	afterEach(() => {
		vi.restoreAllMocks()
		document.body.innerHTML = ''
	})

	describe('constructor', () => {
		it('initialize with caret position data', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()

			expect(finder.span).toBe('Hello @world')
			expect(finder.node.nodeType).toBe(3)
			expect(finder.dividedText).toEqual({left: 'Hello', right: ' @world'})
		})

		it('handle empty span', () => {
			mockSelection('', 0)

			const finder = new TriggerFinder()

			expect(finder.span).toBe('')
			expect(finder.dividedText).toEqual({left: '', right: ''})
		})

		it('handle position at end of span', () => {
			const span = 'Hello @world'
			mockSelection(span, span.length)

			const finder = new TriggerFinder()

			expect(finder.dividedText).toEqual({left: span, right: ''})
		})

		it('throws when no anchor node', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue({
				anchorNode: null,
				isCollapsed: true,
			} as unknown as Selection)
			expect(() => new TriggerFinder()).toThrow('Anchor node of selection is not exists!')
		})
	})

	describe('static find', () => {
		it('return TriggerFinder instance when position is selected', () => {
			mockSelection('Hello @world', 7)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeInstanceOf(Object)
			expect(result?.value).toBe('world')
			expect(result?.source).toBe('@world')
			expect(result?.range).toEqual({start: 6, end: 12})
		})

		it('return undefined when selection is not collapsed', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue({
				isCollapsed: false,
			} as unknown as Selection)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})
	})

	describe('getDividedTextBy', () => {
		it('correctly divide text by position', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(7)

			expect(result).toEqual({left: 'Hello @', right: 'world'})
		})

		it('handle position 0', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(0)

			expect(result).toEqual({left: '', right: 'Hello @world'})
		})

		it('handle position at end', () => {
			const span = 'Hello @world'
			mockSelection(span, 5)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(span.length)

			expect(result).toEqual({left: span, right: ''})
		})
	})

	describe('find', () => {
		it('find trigger match and return OverlayMatch', () => {
			mockSelection('Hello @world test', 7)

			const finder = new TriggerFinder()
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toEqual({
				value: 'world',
				source: '@world',
				range: {start: 6, end: 12},
				span: 'Hello @world test',
				node: expect.objectContaining({nodeType: 3}),
				option: options[0],
			})
		})

		it('return undefined when no trigger found', () => {
			mockSelection('Hello world', 3)

			const finder = new TriggerFinder()
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})

		it('prioritize first matching option', () => {
			mockSelection('Hello @world test', 7)

			const finder = new TriggerFinder()
			const options = [
				{trigger: '@', markup: '@[__value__](__meta__)' as Markup},
				{trigger: '#', markup: '#[__value__](__meta__)' as Markup},
			]
			const result = finder.find(options, opt => opt.trigger)

			expect(result?.option).toBe(options[0])
		})
	})

	describe('matchInTextVia', () => {
		it('return match object when trigger found', () => {
			mockSelection('Hello @world test', 7)

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toEqual({word: 'world', annotation: '@world', index: 6})
		})

		it('return undefined when no left match', () => {
			mockSelection('Hello world', 3)

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toBeUndefined()
		})

		it('handle custom trigger', () => {
			mockSelection('Hello #world test', 12)

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('#')

			expect(result).toEqual({word: 'world', annotation: '#world', index: 6})
		})
	})

	describe('matchRightPart', () => {
		it('extract word from right part', () => {
			mockSelection('Hello @world test', 7)

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})

		it('handle no word match', () => {
			mockSelection('Hello @world!', 6)

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: ''})
		})

		it('extract only word characters', () => {
			mockSelection('Hello world! test', 6)

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})
	})

	describe('matchLeftPart', () => {
		it('find trigger and word before cursor', () => {
			mockSelection('Hello @world test', 12)

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({
				word: 'world',
				annotation: '@world',
				index: 6,
			})
		})

		it('return undefined when no match', () => {
			mockSelection('Hello world', 3)

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toBeUndefined()
		})

		it('handle trigger at start of text', () => {
			mockSelection('@hi test', 3)

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: 'hi', annotation: '@hi', index: 0})
		})

		it('handle empty word after trigger', () => {
			mockSelection('@ test', 1)

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: '', annotation: '@', index: 0})
		})
	})

	describe('makeTriggerRegex', () => {
		it('create regex for trigger', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@')

			expect(regex).toEqual(/@(\w*)$/)
			expect(regex.test('@world')).toBe(true)
			expect(regex.test('Hello @world')).toBe(true)
			expect(regex.test('#world')).toBe(false)
		})

		it('escape special regex characters', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('.*')

			expect(regex.source).toBe('\\.\\*(\\w*)$')
			expect(regex.test('.*test')).toBe(true)
		})

		it('handle multi-character triggers', () => {
			mockSelection('Hello @world', 5)

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@@')

			expect(regex).toEqual(/@@(\w*)$/)
			expect(regex.test('@@world')).toBe(true)
			expect(regex.test('@world')).toBe(false)
		})
	})
})