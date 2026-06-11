import {afterEach, describe, expect, it, vi} from 'vitest'

import * as caretDom from './caret'

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

	describe('placeAtTextOffset', () => {
		it('places caret at character offset within a single text node', () => {
			const el = document.createElement('span')
			el.appendChild(document.createTextNode('hello'))
			document.body.appendChild(el)
			caretDom.placeAtTextOffset(el, 3)
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el.firstChild)
			expect(range?.startOffset).toBe(3)
			expect(range?.collapsed).toBe(true)
			document.body.removeChild(el)
		})

		it('walks across multiple text nodes', () => {
			const el = document.createElement('span')
			el.append(document.createTextNode('ab'), document.createTextNode('cd'))
			document.body.appendChild(el)
			caretDom.placeAtTextOffset(el, 3)
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el.childNodes[1])
			expect(range?.startOffset).toBe(1)
			document.body.removeChild(el)
		})

		it('creates a fallback text node when the surface is empty', () => {
			const el = document.createElement('span')
			document.body.appendChild(el)
			caretDom.placeAtTextOffset(el, 0)
			expect(el.firstChild?.nodeType).toBe(Node.TEXT_NODE)
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el.firstChild)
			expect(range?.startOffset).toBe(0)
			document.body.removeChild(el)
		})

		it('clamps offset to the surface text length', () => {
			const el = document.createElement('span')
			el.appendChild(document.createTextNode('hi'))
			document.body.appendChild(el)
			caretDom.placeAtTextOffset(el, 99)
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el.firstChild)
			expect(range?.startOffset).toBe(2)
			document.body.removeChild(el)
		})
	})

	describe('placeAtChildBoundary', () => {
		it('places caret at the start (childIndex 0) of an element', () => {
			const el = document.createElement('span')
			el.appendChild(document.createElement('b'))
			document.body.appendChild(el)
			caretDom.placeAtChildBoundary(el, 'start')
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el)
			expect(range?.startOffset).toBe(0)
			expect(range?.collapsed).toBe(true)
			document.body.removeChild(el)
		})

		it('places caret at the end (childIndex = childNodes.length) of an element', () => {
			const el = document.createElement('span')
			el.append(document.createElement('b'), document.createElement('i'))
			document.body.appendChild(el)
			caretDom.placeAtChildBoundary(el, 'end')
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(el)
			expect(range?.startOffset).toBe(2)
			document.body.removeChild(el)
		})
	})

	describe('placeRangeAcrossSurfaces', () => {
		it('builds a non-collapsed range from start surface to end surface', () => {
			const a = document.createElement('span')
			const b = document.createElement('span')
			a.appendChild(document.createTextNode('hello'))
			b.appendChild(document.createTextNode('world'))
			document.body.append(a, b)
			caretDom.placeRangeAcrossSurfaces({element: a, offset: 1}, {element: b, offset: 3})
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.startContainer).toBe(a.firstChild)
			expect(range?.startOffset).toBe(1)
			expect(range?.endContainer).toBe(b.firstChild)
			expect(range?.endOffset).toBe(3)
			expect(range?.collapsed).toBe(false)
			document.body.removeChild(a)
			document.body.removeChild(b)
		})

		it('places a collapsed range when start and end resolve to the same boundary', () => {
			const el = document.createElement('span')
			el.appendChild(document.createTextNode('hello'))
			document.body.appendChild(el)
			caretDom.placeRangeAcrossSurfaces({element: el, offset: 2}, {element: el, offset: 2})
			const range = window.getSelection()?.getRangeAt(0)
			expect(range?.collapsed).toBe(true)
			expect(range?.startOffset).toBe(2)
			document.body.removeChild(el)
		})
	})
})