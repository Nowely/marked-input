/* oxlint-disable no-unsafe-type-assertion */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {Markup} from '../parsing'
import {Caret} from './Caret'
import {TriggerFinder} from './TriggerFinder'

vi.mock('./Caret', () => ({
	Caret: {
		getCurrentPosition: vi.fn(),
		getSelectedNode: vi.fn(),
		getFocusedSpan: vi.fn(),
		isSelectedPosition: true,
	},
}))

const mockGetCurrentPosition = vi.mocked(Caret.getCurrentPosition)
const mockGetSelectedNode = vi.mocked(Caret.getSelectedNode)
const mockGetFocusedSpan = vi.mocked(Caret.getFocusedSpan)

function setIsSelectedPosition(value: boolean): void {
	Object.defineProperty(Caret, 'isSelectedPosition', {value, configurable: true})
}

describe(`Utility: ${TriggerFinder.name}`, () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setIsSelectedPosition(true)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('constructor', () => {
		it('initialize with caret position data', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('Hello @world')
			expect(finder.node.nodeType).toBe(3)
			expect(finder.dividedText).toEqual({left: 'Hello', right: ' @world'})
			expect(Caret.getCurrentPosition).toHaveBeenCalled()
			expect(Caret.getSelectedNode).toHaveBeenCalled()
			expect(Caret.getFocusedSpan).toHaveBeenCalled()
		})

		it('handle empty span', () => {
			mockGetCurrentPosition.mockReturnValue(0)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(''))
			mockGetFocusedSpan.mockReturnValue('')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('')
			expect(finder.dividedText).toEqual({left: '', right: ''})
		})

		it('handle position at end of span', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(span.length)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()

			expect(finder.dividedText).toEqual({left: span, right: ''})
		})
	})

	describe('static find', () => {
		it('return TriggerFinder instance when position is selected', () => {
			setIsSelectedPosition(true)
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeInstanceOf(Object)
			expect(result?.value).toBe('world')
			expect(result?.source).toBe('@world')
			expect(result?.range).toEqual({start: 6, end: 12})
		})

		it('return undefined when position is not selected', () => {
			setIsSelectedPosition(false)

			const options = [{trigger: '@', markup: '@[__label__](__value__)'}]
			const result = TriggerFinder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})
	})

	describe('getDividedTextBy', () => {
		it('correctly divide text by position', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(7)

			expect(result).toEqual({left: 'Hello @', right: 'world'})
		})

		it('handle position 0', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(0)

			expect(result).toEqual({left: '', right: 'Hello @world'})
		})

		it('handle position at end', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(span.length)

			expect(result).toEqual({left: span, right: ''})
		})
	})

	describe('find', () => {
		it('find trigger match and return OverlayMatch', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

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
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const options = [{trigger: '@', markup: '@[__value__](__meta__)' as Markup}]
			const result = finder.find(options, opt => opt.trigger)

			expect(result).toBeUndefined()
		})

		it('prioritize first matching option', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

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
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toEqual({word: 'world', annotation: '@world', index: 6})
		})

		it('return undefined when no left match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toBeUndefined()
		})

		it('handle custom trigger', () => {
			mockGetCurrentPosition.mockReturnValue(12)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello #world test'))
			mockGetFocusedSpan.mockReturnValue('Hello #world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('#')

			expect(result).toEqual({word: 'world', annotation: '#world', index: 6})
		})
	})

	describe('matchRightPart', () => {
		it('extract word from right part', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})

		it('handle no word match', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world!'))
			mockGetFocusedSpan.mockReturnValue('Hello @world!')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: ''})
		})

		it('extract only word characters', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world! test'))
			mockGetFocusedSpan.mockReturnValue('Hello world! test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})
	})

	describe('matchLeftPart', () => {
		it('find trigger and word before cursor', () => {
			mockGetCurrentPosition.mockReturnValue(12)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({
				word: 'world',
				annotation: '@world',
				index: 6,
			})
		})

		it('return undefined when no match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toBeUndefined()
		})

		it('handle trigger at start of text', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@hi test'))
			mockGetFocusedSpan.mockReturnValue('@hi test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: 'hi', annotation: '@hi', index: 0})
		})

		it('handle empty word after trigger', () => {
			mockGetCurrentPosition.mockReturnValue(1)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@ test'))
			mockGetFocusedSpan.mockReturnValue('@ test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({word: '', annotation: '@', index: 0})
		})
	})

	describe('makeTriggerRegex', () => {
		it('create regex for trigger', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@')

			expect(regex).toEqual(/@(\w*)$/)
			expect(regex.test('@world')).toBe(true)
			expect(regex.test('Hello @world')).toBe(true)
			expect(regex.test('#world')).toBe(false)
		})

		it('escape special regex characters', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('.*')

			expect(regex.source).toBe('\\.\\*(\\w*)$')
			expect(regex.test('.*test')).toBe(true)
		})

		it('handle multi-character triggers', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('@@')

			expect(regex).toEqual(/@@(\w*)$/)
			expect(regex.test('@@world')).toBe(true)
			expect(regex.test('@world')).toBe(false)
		})
	})
})