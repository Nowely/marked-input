import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {cleanup, createEditableDiv} from '../../test-utils/dom'
import {Caret} from './Caret'

function selectText(host: HTMLElement, start: number, end: number = start): void {
	const textNode = host.firstChild
	if (!textNode) throw new Error('host has no text node')
	const range = document.createRange()
	range.setStart(textNode, start)
	range.setEnd(textNode, end)
	const selection = window.getSelection()
	if (!selection) throw new Error('window.getSelection() returned null')
	selection.removeAllRanges()
	selection.addRange(range)
}

function clearSelection(): void {
	window.getSelection()?.removeAllRanges()
}

describe(`Utility: ${Caret.name}`, () => {
	let host: HTMLDivElement

	beforeEach(() => {
		host = createEditableDiv()
		host.appendChild(document.createTextNode('Hello world'))
	})

	afterEach(() => {
		clearSelection()
		cleanup()
	})

	describe('isSelectedPosition', () => {
		it('should return true when selection is collapsed', () => {
			selectText(host, 5)
			expect(Caret.isSelectedPosition).toBe(true)
		})

		it('should return false when selection is not collapsed', () => {
			selectText(host, 0, 5)
			expect(Caret.isSelectedPosition).toBe(false)
		})
	})

	describe('getCurrentPosition', () => {
		it('should return anchor offset from selection', () => {
			selectText(host, 10)
			expect(Caret.getCurrentPosition()).toBe(10)
		})

		it('should return 0 when selection has no ranges', () => {
			clearSelection()
			expect(Caret.getCurrentPosition()).toBe(0)
		})
	})

	describe('getFocusedSpan', () => {
		it('should return text content of anchor node', () => {
			selectText(host, 3)
			expect(Caret.getFocusedSpan()).toBe('Hello world')
		})

		it('should return empty string when selection has no anchor', () => {
			clearSelection()
			expect(Caret.getFocusedSpan()).toBe('')
		})
	})

	describe('getSelectedNode', () => {
		it('should return anchor node when available', () => {
			selectText(host, 3)
			expect(Caret.getSelectedNode()).toBe(host.firstChild)
		})

		it('should throw when selection has no anchor', () => {
			clearSelection()
			expect(() => Caret.getSelectedNode()).toThrow('Anchor node of selection is not exists!')
		})
	})

	describe('getAbsolutePosition', () => {
		it('should return a DOMRect-derived position when a range is active', () => {
			selectText(host, 5)
			const result = Caret.getAbsolutePosition()
			expect(typeof result.left).toBe('number')
			expect(typeof result.top).toBe('number')
			expect(Number.isFinite(result.left)).toBe(true)
			expect(Number.isFinite(result.top)).toBe(true)
		})

		it('should throw when selection has no ranges', () => {
			clearSelection()
			expect(() => Caret.getAbsolutePosition()).toThrow()
		})
	})

	describe('trySetIndex', () => {
		it('should swallow errors thrown by setIndex', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			setIndexSpy.mockImplementation(() => {
				throw new Error('Test error')
			})

			expect(() => Caret.trySetIndex(host, 3)).not.toThrow()
			expect(setIndexSpy).toHaveBeenCalledWith(host, 3)

			setIndexSpy.mockRestore()
		})
	})

	describe('setIndex', () => {
		it('should set caret position inside the text node', () => {
			Caret.setIndex(host, 5)

			const selection = window.getSelection()!
			expect(selection.anchorNode).toBe(host.firstChild)
			expect(selection.anchorOffset).toBe(5)
			expect(selection.isCollapsed).toBe(true)
		})

		it('should clamp to the end when offset exceeds text length', () => {
			Caret.setIndex(host, Infinity)

			const selection = window.getSelection()!
			expect(selection.anchorNode).toBe(host.firstChild)
			expect(selection.anchorOffset).toBe('Hello world'.length)
		})

		it('should do nothing when the element has no text nodes', () => {
			const empty = createEditableDiv()

			Caret.setIndex(empty, 5)

			const selection = window.getSelection()!
			expect(selection.anchorNode).not.toBe(empty)
		})
	})

	describe('getCaretIndex', () => {
		it('should calculate caret index from selection range', () => {
			selectText(host, 5)
			expect(Caret.getCaretIndex(host)).toBe(5)
		})

		it('should return 0 when selection has no ranges', () => {
			clearSelection()
			expect(Caret.getCaretIndex(host)).toBe(0)
		})
	})

	describe('setCaretToEnd', () => {
		it('should set position to end of element by delegating to setIndex', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')

			Caret.setCaretToEnd(host)

			expect(setIndexSpy).toHaveBeenCalledWith(host, Infinity)

			setIndexSpy.mockRestore()
		})

		it('should do nothing when element is null', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			Caret.setCaretToEnd(null)
			expect(setIndexSpy).not.toHaveBeenCalled()
			setIndexSpy.mockRestore()
		})

		it('should do nothing when element is undefined', () => {
			const setIndexSpy = vi.spyOn(Caret, 'setIndex')
			Caret.setCaretToEnd(undefined)
			expect(setIndexSpy).not.toHaveBeenCalled()
			setIndexSpy.mockRestore()
		})
	})

	describe('getIndex', () => {
		it('should return anchor offset', () => {
			selectText(host, 7)
			expect(Caret.getIndex()).toBe(7)
		})

		it('should return 0 when selection has no anchor', () => {
			clearSelection()
			expect(Caret.getIndex()).toBe(0)
		})
	})

	describe('setIndex1', () => {
		it('should set caret position via range on the selection anchor', () => {
			selectText(host, 2)

			Caret.setIndex1(5)

			const selection = window.getSelection()!
			const range = selection.getRangeAt(0)
			expect(range.startOffset).toBe(5)
			expect(range.endOffset).toBe(5)
		})

		it('should do nothing when selection has no ranges', () => {
			clearSelection()
			expect(() => Caret.setIndex1(5)).not.toThrow()
		})
	})

	describe('setCaretRightTo (instance method)', () => {
		it('should set caret position inside the existing range endContainer', () => {
			selectText(host, 3)

			const instance = new Caret()
			instance.setCaretRightTo(host, 7)

			const selection = window.getSelection()!
			const range = selection.getRangeAt(0)
			expect(range.startOffset).toBe(7)
			expect(range.endOffset).toBe(7)
		})
	})
})