import {afterEach, describe, expect, it} from 'vitest'

import type {Markup} from '../tokens'
import {TriggerFinder} from './TriggerFinder'

function anchorIn(
	text: string,
	offset: number,
	isCollapsed = true
): {node: Node; offset: number; isCollapsed: boolean} {
	const node = document.createTextNode(text)
	document.body.appendChild(node)
	return {node, offset, isCollapsed}
}

describe(`Utility: ${TriggerFinder.name}`, () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	describe('constructor', () => {
		it('initialize with caret position data', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))

			expect(finder.span).toBe('Hello @world')
			expect(finder.node.nodeType).toBe(3)
			expect(finder.dividedText).toEqual({left: 'Hello', right: ' @world'})
		})

		it('handle empty span', () => {
			const finder = new TriggerFinder(undefined, anchorIn('', 0))

			expect(finder.span).toBe('')
			expect(finder.dividedText).toEqual({left: '', right: ''})
		})

		it('handle position at end of span', () => {
			const span = 'Hello @world'

			const finder = new TriggerFinder(undefined, anchorIn(span, span.length))

			expect(finder.dividedText).toEqual({left: span, right: ''})
		})

		it('throws when no anchor node', () => {
			expect(() => new TriggerFinder()).toThrow('Anchor node of selection is not exists!')
		})
	})

	describe('static find', () => {
		it('return TriggerFinder instance when position is selected', () => {
			const anchor = anchorIn('Hello @world', 7)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger, undefined, anchor)

			expect(result).toBeInstanceOf(Object)
			expect(result?.value).toBe('world')
			expect(result?.source).toBe('@world')
			expect(result?.range).toEqual({start: 6, end: 12})
		})

		it('return undefined when selection is not collapsed', () => {
			const anchor = anchorIn('Hello @world', 7, false)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger, undefined, anchor)

			expect(result).toBeUndefined()
		})
	})

	describe('getDividedTextBy', () => {
		it('correctly divide text by position', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))
			const result = finder.getDividedTextBy(7)

			expect(result).toEqual({left: 'Hello @', right: 'world'})
		})

		it('handle position 0', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))
			const result = finder.getDividedTextBy(0)

			expect(result).toEqual({left: '', right: 'Hello @world'})
		})

		it('handle position at end', () => {
			const span = 'Hello @world'

			const finder = new TriggerFinder(undefined, anchorIn(span, 5))
			const result = finder.getDividedTextBy(span.length)

			expect(result).toEqual({left: span, right: ''})
		})
	})

	describe('find', () => {
		it('find trigger match and return OverlayMatch', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world test', 7))
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
			const finder = new TriggerFinder(undefined, anchorIn('Hello world', 3))
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})

		it('prioritize first matching option', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world test', 7))
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
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world test', 7))
			const result = finder.matchInTextVia('@')

			expect(result).toEqual({word: 'world', annotation: '@world', index: 6})
		})

		it('return undefined when no left match', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello world', 3))
			const result = finder.matchInTextVia('@')

			expect(result).toBeUndefined()
		})

		it('handle custom trigger', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello #world test', 12))
			const result = finder.matchInTextVia('#')

			expect(result).toEqual({word: 'world', annotation: '#world', index: 6})
		})
	})

	describe('matchRightPart', () => {
		it('extract word from right part', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world test', 7))
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})

		it('handle no word match', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world!', 6))
			const result = finder.matchRightPart()

			expect(result).toEqual({word: ''})
		})

		it('extract only word characters', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello world! test', 6))
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})
	})

	describe('matchLeftPart', () => {
		it('find trigger and word before cursor', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world test', 12))
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({
				word: 'world',
				annotation: '@world',
				index: 6,
			})
		})

		it('return undefined when no match', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello world', 3))
			const result = finder.matchLeftPart('@')

			expect(result).toBeUndefined()
		})

		it('handle trigger at start of text', () => {
			const finder = new TriggerFinder(undefined, anchorIn('@hi test', 3))
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: 'hi', annotation: '@hi', index: 0})
		})

		it('handle empty word after trigger', () => {
			const finder = new TriggerFinder(undefined, anchorIn('@ test', 1))
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: '', annotation: '@', index: 0})
		})
	})

	describe('makeTriggerRegex', () => {
		it('create regex for trigger', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))
			const regex = finder.makeTriggerRegex('@')

			expect(regex).toEqual(/@(\w*)$/)
			expect(regex.test('@world')).toBe(true)
			expect(regex.test('Hello @world')).toBe(true)
			expect(regex.test('#world')).toBe(false)
		})

		it('escape special regex characters', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))
			const regex = finder.makeTriggerRegex('.*')

			expect(regex.source).toBe('\\.\\*(\\w*)$')
			expect(regex.test('.*test')).toBe(true)
		})

		it('handle multi-character triggers', () => {
			const finder = new TriggerFinder(undefined, anchorIn('Hello @world', 5))
			const regex = finder.makeTriggerRegex('@@')

			expect(regex).toEqual(/@@(\w*)$/)
			expect(regex.test('@@world')).toBe(true)
			expect(regex.test('@world')).toBe(false)
		})
	})
})