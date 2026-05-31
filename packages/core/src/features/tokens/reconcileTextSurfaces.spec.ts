import {describe, it, expect} from 'vitest'

import {markToken, textToken} from './__testing__/tokenFactories'
import type {TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {reconcileTextSurfaces} from './reconcileTextSurfaces'
import {createTokenIndex} from './tokenIndex'

describe('reconcileTextSurfaces', () => {
	it('writes textContent and contentEditable=true on text surfaces when editable', () => {
		const span = document.createElement('span')
		const tokens: Token[] = [textToken('hello', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const node: TokenNode = {
			path: [0],
			address: tokenIndex.addressFor([0])!,
			tokenElement: span,
			textElement: span,
		}

		reconcileTextSurfaces([node], tokenIndex, {editable: true, readOnly: false})

		expect(span.textContent).toBe('hello')
		expect(span.contentEditable).toBe('true')
	})

	it('sets contentEditable=false on text surfaces when not editable', () => {
		const span = document.createElement('span')
		span.textContent = 'hello'
		const tokens: Token[] = [textToken('hello', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const node: TokenNode = {
			path: [0],
			address: tokenIndex.addressFor([0])!,
			tokenElement: span,
			textElement: span,
		}

		reconcileTextSurfaces([node], tokenIndex, {editable: false, readOnly: false})

		expect(span.contentEditable).toBe('false')
	})

	it('does not overwrite textContent when already correct (avoids caret flicker)', () => {
		const span = document.createElement('span')
		span.append(document.createTextNode('hello'))
		const initialTextNode = span.firstChild
		const tokens: Token[] = [textToken('hello', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const node: TokenNode = {
			path: [0],
			address: tokenIndex.addressFor([0])!,
			tokenElement: span,
			textElement: span,
		}

		reconcileTextSurfaces([node], tokenIndex, {editable: true, readOnly: false})

		expect(span.firstChild).toBe(initialTextNode)
	})

	it('gives mark roots tabIndex 0 when not readOnly, regardless of editable', () => {
		const mark = document.createElement('mark')
		const tokens: Token[] = [markToken('hello', '@[hello]', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const node: TokenNode = {
			path: [0],
			address: tokenIndex.addressFor([0])!,
			tokenElement: mark,
		}

		reconcileTextSurfaces([node], tokenIndex, {editable: true, readOnly: false})
		expect(mark.tabIndex).toBe(0)

		reconcileTextSurfaces([node], tokenIndex, {editable: false, readOnly: false})
		expect(mark.tabIndex).toBe(0)
	})

	it('removes mark tabIndex when readOnly', () => {
		const mark = document.createElement('mark')
		mark.tabIndex = 0
		const tokens: Token[] = [markToken('hello', '@[hello]', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const node: TokenNode = {
			path: [0],
			address: tokenIndex.addressFor([0])!,
			tokenElement: mark,
		}

		reconcileTextSurfaces([node], tokenIndex, {editable: false, readOnly: true})
		expect(mark.hasAttribute('tabindex')).toBe(false)
	})
})