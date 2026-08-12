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

	describe('placeAtParentBoundary', () => {
		it('places a collapsed caret at a child index of the parent', () => {
			const host = document.createElement('div')
			host.contentEditable = 'true'
			const a = document.createElement('span')
			a.textContent = 'a'
			const mark = document.createElement('mark')
			mark.contentEditable = 'false'
			host.append(a, mark)
			document.body.append(host)

			caretDom.placeAtParentBoundary(host, 1)

			const sel = window.getSelection()
			expect(sel?.anchorNode).toBe(host)
			expect(sel?.anchorOffset).toBe(1)
			expect(sel?.isCollapsed).toBe(true)
			host.remove()
		})

		it('places at the end of the child list', () => {
			const el = document.createElement('span')
			el.append(document.createElement('b'), document.createElement('i'))
			document.body.append(el)

			caretDom.placeAtParentBoundary(el, el.childNodes.length)

			expect(window.getSelection()?.anchorOffset).toBe(2)
			el.remove()
		})
	})

	describe('focusEditingHost', () => {
		it('focuses the nearest contenteditable=true ancestor, not the element itself', () => {
			const host = document.createElement('div')
			host.contentEditable = 'true'
			const span = document.createElement('span')
			host.append(span)
			document.body.append(host)

			caretDom.focusEditingHost(span)

			expect(document.activeElement).toBe(host)
			host.remove()
		})

		it('does nothing when focus is already inside the host', () => {
			const host = document.createElement('div')
			host.contentEditable = 'true'
			const inner = document.createElement('button')
			const span = document.createElement('span')
			host.append(inner, span)
			document.body.append(host)
			inner.focus()

			caretDom.focusEditingHost(span)

			expect(document.activeElement).toBe(inner)
			host.remove()
		})

		it('does nothing when the element has no editing host', () => {
			const plain = document.createElement('div')
			const span = document.createElement('span')
			plain.append(span)
			document.body.append(plain)

			caretDom.focusEditingHost(span)

			expect(plain.contains(document.activeElement)).toBe(false)
			plain.remove()
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