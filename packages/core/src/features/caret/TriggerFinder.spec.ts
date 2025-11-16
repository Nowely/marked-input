import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {TriggerFinder} from './TriggerFinder'
import {Caret} from './Caret'
import {Markup} from '../parsing/ParserV2/types'

// Mock DOM
const mockCreateTextNode = vi.fn(
	(text: string) =>
		({
			nodeType: 3,
			textContent: text,
		}) as Text
)

Object.defineProperty(global, 'document', {
	value: {
		createTextNode: mockCreateTextNode,
	},
	writable: true,
})

// Mock Text constructor
Object.defineProperty(global, 'Text', {
	value: function (text: string) {
		return {
			nodeType: 3,
			textContent: text,
		} as Text
	},
	writable: true,
})

// Mock Caret class
vi.mock('./Caret', () => ({
	Caret: {
		getCurrentPosition: vi.fn(),
		getSelectedNode: vi.fn(),
		getFocusedSpan: vi.fn(),
	},
}))

// Mock isSelectedPosition getter separately
let isSelectedPositionValue = true
Object.defineProperty(Caret, 'isSelectedPosition', {
	get: () => isSelectedPositionValue,
	set: (value: boolean) => {
		isSelectedPositionValue = value
	},
})

// Get the mocked methods
const mockGetCurrentPosition = vi.mocked(Caret.getCurrentPosition)
const mockGetSelectedNode = vi.mocked(Caret.getSelectedNode)
const mockGetFocusedSpan = vi.mocked(Caret.getFocusedSpan)

describe(`Utility: ${TriggerFinder.name}`, () => {
	let mockCaret: typeof Caret

	beforeEach(() => {
		mockCaret = vi.mocked(Caret)
		// Reset all mocks
		vi.clearAllMocks()
		mockCreateTextNode.mockClear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('constructor', () => {
		it('should initialize with caret position data', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('Hello @world')
			expect(finder.node.nodeType).toBe(3)
			expect(finder.dividedText).toEqual({
				left: 'Hello',
				right: ' @world',
			})

			expect(mockCaret.getCurrentPosition).toHaveBeenCalled()
			expect(mockCaret.getSelectedNode).toHaveBeenCalled()
			expect(mockCaret.getFocusedSpan).toHaveBeenCalled()
		})

		it('should handle empty span', () => {
			mockGetCurrentPosition.mockReturnValue(0)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(''))
			mockGetFocusedSpan.mockReturnValue('')

			const finder = new TriggerFinder()

			expect(finder.span).toBe('')
			expect(finder.dividedText).toEqual({
				left: '',
				right: '',
			})
		})

		it('should handle position at end of span', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(span.length)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()

			expect(finder.dividedText).toEqual({
				left: span,
				right: '',
			})
		})
	})

	describe('static find', () => {
		it('should return TriggerFinder instance when position is selected', () => {
			isSelectedPositionValue = true
			mockGetCurrentPosition.mockReturnValue(7) // After "Hello @"
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const result = TriggerFinder.find([{overlayTrigger: '@', markup: '@[__label__](__value__)'}])

			expect(result).toBeInstanceOf(Object)
			expect(result?.value).toBe('world')
			expect(result?.source).toBe('@world')
		})

		it('should return undefined when position is not selected', () => {
			isSelectedPositionValue = false

			const result = TriggerFinder.find([{overlayTrigger: '@', markup: '@[__label__](__value__)'}])

			expect(result).toBeUndefined()
		})
	})

	describe('getDividedTextBy', () => {
		it('should correctly divide text by position', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(7)

			expect(result).toEqual({
				left: 'Hello @',
				right: 'world',
			})
		})

		it('should handle position 0', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(0)

			expect(result).toEqual({
				left: '',
				right: 'Hello @world',
			})
		})

		it('should handle position at end', () => {
			const span = 'Hello @world'
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode(span))
			mockGetFocusedSpan.mockReturnValue(span)

			const finder = new TriggerFinder()
			const result = finder.getDividedTextBy(span.length)

			expect(result).toEqual({
				left: span,
				right: '',
			})
		})
	})

	describe('find', () => {
		it('should find trigger match and return OverlayMatch', () => {
			mockGetCurrentPosition.mockReturnValue(7) // After "Hello @"
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const options = [{overlayTrigger: '@', markup: '@[__value__](__meta__)' as Markup, data: []}]
			const result = finder.find(options)

			expect(result).toEqual({
				value: 'world',
				source: '@world',
				index: 6,
				span: 'Hello @world test',
				node: expect.objectContaining({nodeType: 3}),
				option: options[0],
			})
		})

		it('should return undefined when no trigger found', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.find([{overlayTrigger: '@', markup: '@[__value__](__meta__)' as Markup}])

			expect(result).toBeUndefined()
		})

		it('should prioritize first matching option', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const options = [
				{overlayTrigger: '@', markup: '@[__value__](__meta__)' as Markup, data: []},
				{trigger: '#', markup: '#[__value__](__meta__)' as Markup, data: []},
			]
			const result = finder.find(options)

			expect(result?.option).toBe(options[0])
		})
	})

	describe('matchInTextVia', () => {
		it('should return match object when trigger found', () => {
			mockGetCurrentPosition.mockReturnValue(7) // After "Hello @"
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toEqual({
				word: 'world',
				annotation: '@world',
				index: 6,
			})
		})

		it('should return undefined when no left match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('@')

			expect(result).toBeUndefined()
		})

		it('should handle custom trigger', () => {
			mockGetCurrentPosition.mockReturnValue(12) // After "Hello #world"
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello #world test'))
			mockGetFocusedSpan.mockReturnValue('Hello #world test')

			const finder = new TriggerFinder()
			const result = finder.matchInTextVia('#')

			expect(result).toEqual({
				word: 'world',
				annotation: '#world',
				index: 6,
			})
		})
	})

	describe('matchRightPart', () => {
		it('should extract word from right part', () => {
			mockGetCurrentPosition.mockReturnValue(7)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world test'))
			mockGetFocusedSpan.mockReturnValue('Hello @world test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})

		it('should handle no word match', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world!'))
			mockGetFocusedSpan.mockReturnValue('Hello @world!')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: ''})
		})

		it('should extract only word characters', () => {
			mockGetCurrentPosition.mockReturnValue(6)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world! test'))
			mockGetFocusedSpan.mockReturnValue('Hello world! test')

			const finder = new TriggerFinder()
			const result = finder.matchRightPart()

			expect(result).toEqual({word: 'world'})
		})
	})

	describe('matchLeftPart', () => {
		it('should find trigger and word before cursor', () => {
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

		it('should return undefined when no match', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello world'))
			mockGetFocusedSpan.mockReturnValue('Hello world')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toBeUndefined()
		})

		it('should handle trigger at start of text', () => {
			mockGetCurrentPosition.mockReturnValue(3)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@hi test'))
			mockGetFocusedSpan.mockReturnValue('@hi test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({
				word: 'hi',
				annotation: '@hi',
				index: 0,
			})
		})

		it('should handle empty word after trigger', () => {
			mockGetCurrentPosition.mockReturnValue(1)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('@ test'))
			mockGetFocusedSpan.mockReturnValue('@ test')

			const finder = new TriggerFinder()
			const result = finder.matchLeftPart('@')

			expect(result).toEqual({
				word: '',
				annotation: '@',
				index: 0,
			})
		})
	})

	describe('makeTriggerRegex', () => {
		it('should create regex for trigger', () => {
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

		it('should escape special regex characters', () => {
			mockGetCurrentPosition.mockReturnValue(5)
			mockGetSelectedNode.mockReturnValue(document.createTextNode('Hello @world'))
			mockGetFocusedSpan.mockReturnValue('Hello @world')

			const finder = new TriggerFinder()
			const regex = finder.makeTriggerRegex('.*')

			expect(regex.source).toBe('\\.\\*(\\w*)$')
			expect(regex.test('.*test')).toBe(true)
		})

		it('should handle multi-character triggers', () => {
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
