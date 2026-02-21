import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Caret} from './Caret'

// Mock DOM and window APIs
const mockGetSelection = vi.fn()
const mockGetBoundingClientRect = vi.fn()
const mockGetRangeAt = vi.fn()

const mockSelection = {
	isCollapsed: true,
	anchorOffset: 5,
	anchorNode: {textContent: 'Hello world'} as {textContent: string} | null,
	getRangeAt: mockGetRangeAt,
	setPosition: vi.fn(),
	rangeCount: 1,
}

const mockRange = {
	getBoundingClientRect: mockGetBoundingClientRect,
	setStart: vi.fn(),
	setEnd: vi.fn(),
	cloneRange: vi.fn(),
	selectNodeContents: vi.fn(),
	toString: vi.fn(),
	endContainer: null,
	endOffset: 0,
	startContainer: null,
}

// Mock window and document
Object.defineProperty(global, 'window', {
	value: {
		getSelection: mockGetSelection,
	},
	writable: true,
})

Object.defineProperty(global, 'document', {
	value: {
		createElement: vi.fn(tag => ({
			tagName: tag.toUpperCase(),
			textContent: '',
			firstChild: {nodeType: 3, textContent: ''},
		})),
	},
	writable: true,
})

describe(`Utility: ${Caret.name}`, () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetSelection.mockReturnValue(mockSelection)
		mockGetRangeAt.mockReturnValue(mockRange)
		mockGetBoundingClientRect.mockReturnValue({
			left: 100,
			top: 200,
			height: 20,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('isSelectedPosition', () => {
		it('should return true when selection is collapsed', () => {
			mockSelection.isCollapsed = true
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.isSelectedPosition).toBe(true)
		})

		it('should return false when selection is not collapsed', () => {
			mockSelection.isCollapsed = false
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.isSelectedPosition).toBe(false)
		})

		it('should return undefined when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			expect(Caret.isSelectedPosition).toBeUndefined()
		})
	})

	describe('getCurrentPosition', () => {
		it('should return anchor offset from selection', () => {
			mockSelection.anchorOffset = 10
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.getCurrentPosition()).toBe(10)
		})

		it('should return 0 when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			expect(Caret.getCurrentPosition()).toBe(0)
		})
	})

	describe('getFocusedSpan', () => {
		it('should return text content of anchor node', () => {
			const textNode = {textContent: 'Hello world'}
			mockSelection.anchorNode = textNode
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.getFocusedSpan()).toBe('Hello world')
		})

		it('should return empty string when no anchor node', () => {
			mockSelection.anchorNode = null
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.getFocusedSpan()).toBe('')
		})

		it('should return empty string when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			expect(Caret.getFocusedSpan()).toBe('')
		})
	})

	describe('getSelectedNode', () => {
		it('should return anchor node when available', () => {
			const textNode = {textContent: 'Hello world'}
			mockSelection.anchorNode = textNode
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.getSelectedNode()).toBe(textNode)
		})

		it('should throw error when no anchor node', () => {
			mockSelection.anchorNode = null
			mockGetSelection.mockReturnValue(mockSelection)

			expect(() => Caret.getSelectedNode()).toThrow('Anchor node of selection is not exists!')
		})

		it('should throw error when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			expect(() => Caret.getSelectedNode()).toThrow('Anchor node of selection is not exists!')
		})
	})

	describe('getAbsolutePosition', () => {
		it('should return calculated position from range bounding rect', () => {
			mockGetSelection.mockReturnValue(mockSelection)
			mockGetRangeAt.mockReturnValue(mockRange)
			mockGetBoundingClientRect.mockReturnValue({
				left: 100,
				top: 200,
				height: 20,
			})

			const result = Caret.getAbsolutePosition()

			expect(result).toEqual({left: 100, top: 221}) // top + height + 1
			expect(mockGetRangeAt).toHaveBeenCalledWith(0)
		})

		it('should return default position when no range', () => {
			mockGetRangeAt.mockReturnValue({
				getBoundingClientRect: undefined,
			})

			const result = Caret.getAbsolutePosition()

			expect(result).toEqual({left: 0, top: 0})
		})

		it('should return default position when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			const result = Caret.getAbsolutePosition()

			expect(result).toEqual({left: 0, top: 0})
		})
	})

	describe('trySetIndex', () => {
		it('should call setIndex and not throw on error', () => {
			const element = document.createElement('div')
			element.textContent = 'Hello'

			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			setIndexSpy.mockImplementation(() => {
				throw new Error('Test error')
			})

			expect(() => Caret.trySetIndex(element, 3)).not.toThrow()
			expect(setIndexSpy).toHaveBeenCalledWith(element, 3)
		})
	})

	describe('setIndex', () => {
		it('should set caret position in element', () => {
			const element = document.createElement('div')
			element.textContent = 'Hello world'

			mockSelection.rangeCount = 1
			mockSelection.anchorNode = {textContent: 'test'}
			mockGetSelection.mockReturnValue(mockSelection)
			mockGetRangeAt.mockReturnValue(mockRange)

			Caret.setIndex(element, 5)

			expect(mockRange.setStart).toHaveBeenCalledWith(element.firstChild, 5)
			expect(mockRange.setEnd).toHaveBeenCalledWith(element.firstChild, 5)
		})

		it('should do nothing when no selection', () => {
			const element = document.createElement('div')

			mockGetSelection.mockReturnValue(null)

			Caret.setIndex(element, 5)

			expect(mockRange.setStart).not.toHaveBeenCalled()
			expect(mockRange.setEnd).not.toHaveBeenCalled()
		})

		it('should do nothing when no range count', () => {
			const element = document.createElement('div')

			mockSelection.rangeCount = 0
			mockGetSelection.mockReturnValue(mockSelection)

			Caret.setIndex(element, 5)

			expect(mockRange.setStart).not.toHaveBeenCalled()
			expect(mockRange.setEnd).not.toHaveBeenCalled()
		})
	})

	describe('getCaretIndex', () => {
		it('should calculate caret index from selection range', () => {
			const element = document.createElement('div')
			element.textContent = 'Hello world'

			mockSelection.rangeCount = 1
			mockGetSelection.mockReturnValue(mockSelection)

			// Mock the range operations
			const mockPreCaretRange = {
				selectNodeContents: vi.fn(),
				setEnd: vi.fn(),
				toString: vi.fn().mockReturnValue('Hello'),
			}

			mockGetRangeAt.mockReturnValue({
				...mockRange,
				cloneRange: vi.fn().mockReturnValue(mockPreCaretRange),
				endContainer: element.firstChild,
				endOffset: 5,
			})

			const result = Caret.getCaretIndex(element)

			expect(result).toBe(5)
			expect(mockPreCaretRange.selectNodeContents).toHaveBeenCalledWith(element)
			expect(mockPreCaretRange.setEnd).toHaveBeenCalledWith(element.firstChild, 5)
		})

		it('should return 0 when no selection range', () => {
			const element = document.createElement('div')

			mockSelection.rangeCount = 0
			mockGetSelection.mockReturnValue(mockSelection)

			const result = Caret.getCaretIndex(element)

			expect(result).toBe(0)
		})

		it('should return 0 when no selection', () => {
			const element = document.createElement('div')

			mockGetSelection.mockReturnValue(null)

			const result = Caret.getCaretIndex(element)

			expect(result).toBe(0)
		})
	})

	describe('setCaretToEnd', () => {
		it('should set position to end of element', () => {
			const element = document.createElement('div')
			element.textContent = 'Hello'

			mockGetSelection.mockReturnValue(mockSelection)

			Caret.setCaretToEnd(element)

			expect(mockSelection.setPosition).toHaveBeenCalledWith(element, 1)
		})

		it('should do nothing when element is null', () => {
			Caret.setCaretToEnd(null)

			expect(mockSelection.setPosition).not.toHaveBeenCalled()
		})

		it('should do nothing when element is undefined', () => {
			Caret.setCaretToEnd(undefined)

			expect(mockSelection.setPosition).not.toHaveBeenCalled()
		})
	})

	describe('getIndex', () => {
		it('should return anchor offset', () => {
			mockSelection.anchorOffset = 7
			mockGetSelection.mockReturnValue(mockSelection)

			expect(Caret.getIndex()).toBe(7)
		})

		it('should return NaN when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			expect(Caret.getIndex()).toBe(NaN)
		})
	})

	describe('setIndex1', () => {
		it('should set caret position using firstChild', () => {
			const element = document.createElement('div')
			element.textContent = 'Hello world'

			mockSelection.rangeCount = 1
			mockSelection.anchorNode = {textContent: 'test'}
			mockGetSelection.mockReturnValue(mockSelection)

			const mockStartContainer = {
				firstChild: element.firstChild,
			}

			const mockRangeWithContainer = {
				...mockRange,
				startContainer: mockStartContainer,
				setStart: vi.fn(),
				setEnd: vi.fn(),
			}

			mockGetRangeAt.mockReturnValue(mockRangeWithContainer)

			Caret.setIndex1(5)

			expect(mockRangeWithContainer.setStart).toHaveBeenCalledWith(element.firstChild, 5)
			expect(mockRangeWithContainer.setEnd).toHaveBeenCalledWith(element.firstChild, 5)
		})

		it('should do nothing when no selection', () => {
			mockGetSelection.mockReturnValue(null)

			Caret.setIndex1(5)

			expect(mockRange.setStart).not.toHaveBeenCalled()
		})

		it('should do nothing when no range count', () => {
			mockSelection.rangeCount = 0
			mockGetSelection.mockReturnValue(mockSelection)

			Caret.setIndex1(5)

			expect(mockRange.setStart).not.toHaveBeenCalled()
		})
	})

	describe('setCaretRightTo (instance method)', () => {
		it('should set caret position to the right of current position', () => {
			mockGetSelection.mockReturnValue(mockSelection)
			mockGetRangeAt.mockReturnValue(mockRange)

			const instance = new Caret()
			const element = document.createElement('div')

			instance.setCaretRightTo(element, 10)

			expect(mockRange.setStart).toHaveBeenCalledWith(mockRange.endContainer, 10)
			expect(mockRange.setEnd).toHaveBeenCalledWith(mockRange.endContainer, 10)
		})
	})
})
