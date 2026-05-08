import {afterEach, describe, expect, it, vi} from 'vitest'

import * as caretDom from './caretDom'

describe('caretDom', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('getCaretIndex', () => {
		it('returns 0 when no selection', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue(null)
			const el = document.createElement('div')
			expect(caretDom.getCaretIndex(el)).toBe(0)
		})

		it('returns character count from element start to caret', () => {
			const el = document.createElement('div')
			const text = document.createTextNode('hello')
			el.appendChild(text)
			document.body.appendChild(el)
			const range = document.createRange()
			range.setStart(text, 3)
			range.collapse(true)
			const sel = window.getSelection()
			if (!sel) throw new Error('no selection')
			sel.removeAllRanges()
			sel.addRange(range)
			expect(caretDom.getCaretIndex(el)).toBe(3)
			document.body.removeChild(el)
		})
	})

	describe('getRect', () => {
		it('returns null when no selection', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue(null)
			expect(caretDom.getRect()).toBeNull()
		})
	})

	describe('isOnFirstLine', () => {
		it('returns true when no caret rect', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue(null)
			const el = document.createElement('div')
			expect(caretDom.isOnFirstLine(el)).toBe(true)
		})
	})

	describe('isOnLastLine', () => {
		it('returns true when no caret rect', () => {
			vi.spyOn(window, 'getSelection').mockReturnValue(null)
			const el = document.createElement('div')
			expect(caretDom.isOnLastLine(el)).toBe(true)
		})
	})

	describe('setAtElement', () => {
		it('does not throw when element has no text nodes', () => {
			const el = document.createElement('div')
			expect(() => caretDom.setAtElement(el, 0)).not.toThrow()
		})

		it('places caret at offset within text', () => {
			const el = document.createElement('div')
			el.appendChild(document.createTextNode('hello world'))
			document.body.appendChild(el)
			caretDom.setAtElement(el, 5)
			expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(5)
			document.body.removeChild(el)
		})
	})
})