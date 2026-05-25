import {describe, it, expect} from 'vitest'

import type {Token} from '../parsing/parser/types'
import {createTokenIndex} from '../parsing/tokenIndex'
import {markToken, textToken} from './__testing__/tokenFactories'
import {buildIndex} from './buildIndex'

describe('buildIndex', () => {
	it('indexes a single inline text token to its DOM element', () => {
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.append(span)

		const tokens: Token[] = [textToken('hello', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		const node = result.byPath.get('0')
		expect(node?.tokenElement).toBe(span)
		expect(node?.textElement).toBe(span)
		expect(result.byElement.get(span)).toBe(node)
	})

	it('indexes inline mark sibling order', () => {
		const container = document.createElement('div')
		const before = document.createElement('span')
		const mark = document.createElement('mark')
		const after = document.createElement('span')
		container.append(before, mark, after)

		const tokens: Token[] = [textToken('hi ', 0), markToken('world', '@[world]', 3), textToken('!', 11)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(before)
		expect(result.byPath.get('1')?.tokenElement).toBe(mark)
		expect(result.byPath.get('2')?.tokenElement).toBe(after)
		expect(result.byPath.get('1')?.textElement).toBeUndefined()
	})

	it('descends into nested mark children in place', () => {
		const container = document.createElement('div')
		const outer = document.createElement('mark')
		const innerText = document.createElement('span')
		outer.append(innerText)
		container.append(outer)

		const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('x', 0)])]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(outer)
		expect(result.byPath.get('0.0')?.tokenElement).toBe(innerText)
		expect(result.byPath.get('0.0')?.textElement).toBe(innerText)
	})

	it('completes indexing when a nested mark renders no child elements', () => {
		const container = document.createElement('div')
		const outer = document.createElement('mark')
		container.append(outer)

		const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0)])]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(outer)
		expect(result.byPath.get('0.0')).toBeUndefined()
	})

	it('peels block-layout rows and indexes the single token per row', () => {
		const container = document.createElement('div')
		const row0 = document.createElement('div')
		const tokenEl0 = document.createElement('span')
		row0.append(tokenEl0)
		const row1 = document.createElement('div')
		const tokenEl1 = document.createElement('span')
		row1.append(tokenEl1)
		container.append(row0, row1)

		const tokens: Token[] = [textToken('a', 0), textToken('b', 2)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: true,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(tokenEl0)
		expect(result.byPath.get('0')?.rowElement).toBe(row0)
		expect(result.byPath.get('1')?.tokenElement).toBe(tokenEl1)
		expect(result.byPath.get('1')?.rowElement).toBe(row1)
		expect(result.byElement.get(row0)).toBe(result.byPath.get('0'))
		expect(result.byElement.get(row1)).toBe(result.byPath.get('1'))
	})

	it('treats block-row control children as non-tokens (preserves single-token-per-row invariant)', () => {
		const container = document.createElement('div')
		const row = document.createElement('div')
		const control = document.createElement('button')
		const tokenEl = document.createElement('span')
		row.append(control, tokenEl)
		container.append(row)

		const tokens: Token[] = [textToken('a', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set([control]),
			childSequenceHostsByPath: new Map(),
			isBlock: true,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(tokenEl)
		expect(result.byPath.get('0')?.rowElement).toBe(row)
	})

	it('bails block alignment when a row has more than one non-control child (fail-loud)', () => {
		const container = document.createElement('div')
		const row0 = document.createElement('div')
		const tokenEl0 = document.createElement('span')
		row0.append(tokenEl0)
		const row1 = document.createElement('div')
		const extra1 = document.createElement('span')
		const extra2 = document.createElement('span')
		row1.append(extra1, extra2)
		container.append(row0, row1)

		const tokens: Token[] = [textToken('a', 0), textToken('b', 2)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map(),
			isBlock: true,
		})

		expect(result.byPath.get('0')).toBeUndefined()
		expect(result.byPath.get('1')).toBeUndefined()
	})

	it('skips control elements when zipping tokens with DOM children', () => {
		const container = document.createElement('div')
		const control = document.createElement('button')
		const tokenEl = document.createElement('span')
		container.append(control, tokenEl)

		const tokens: Token[] = [textToken('a', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set([control]),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(tokenEl)
		expect(result.byElement.get(control)).toBeUndefined()
	})

	it('treats elements containing a control as control roots', () => {
		const container = document.createElement('div')
		const wrapper = document.createElement('div')
		const control = document.createElement('button')
		wrapper.append(control)
		const tokenEl = document.createElement('span')
		container.append(wrapper, tokenEl)

		const tokens: Token[] = [textToken('a', 0)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set([control]),
			childSequenceHostsByPath: new Map(),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(tokenEl)
	})

	it('uses a registered child-sequence host as the parent for nested children', () => {
		const container = document.createElement('div')
		const outer = document.createElement('mark')
		const host = document.createElement('span')
		const innerA = document.createElement('span')
		const innerB = document.createElement('span')
		host.append(innerA, innerB)
		outer.append(host)
		container.append(outer)

		const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0), textToken('b', 1)])]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map([['0', [host]]]),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.childSequenceHost).toBe(host)
		expect(result.byPath.get('0.0')?.tokenElement).toBe(innerA)
		expect(result.byPath.get('0.1')?.tokenElement).toBe(innerB)
		expect(result.byElement.get(host)).toBe(result.byPath.get('0'))
	})

	it('falls back to in-place descent when child-sequence host is duplicated', () => {
		const container = document.createElement('div')
		const outer = document.createElement('mark')
		const hostA = document.createElement('span')
		const hostB = document.createElement('span')
		outer.append(hostA, hostB)
		container.append(outer)

		const tokens: Token[] = [markToken('x', '@[x]', 0, [textToken('a', 0)])]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map([['0', [hostA, hostB]]]),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.childSequenceHost).toBeUndefined()
		expect(result.byPath.get('0.0')).toBeUndefined()
	})

	it('ignores a child-sequence host registered outside its owner mark element', () => {
		const container = document.createElement('div')
		const leading = document.createElement('span')
		const outer = document.createElement('mark')
		const trailing = document.createElement('span')
		const outsideHost = document.createElement('span')
		leading.append(outsideHost)
		container.append(leading, outer, trailing)

		const tokens: Token[] = [textToken('a', 0), markToken('x', '@[x]', 1, [textToken('b', 1)]), textToken('c', 5)]
		const tokenIndex = createTokenIndex(tokens)
		const result = buildIndex({
			container,
			tokens,
			addressFor: path => tokenIndex.addressFor(path),
			controlElements: new Set(),
			childSequenceHostsByPath: new Map([['1', [outsideHost]]]),
			isBlock: false,
		})

		expect(result.byPath.get('0')?.tokenElement).toBe(leading)
		expect(result.byPath.get('1')?.tokenElement).toBe(outer)
		expect(result.byPath.get('1')?.childSequenceHost).toBeUndefined()
		expect(result.byPath.get('2')?.tokenElement).toBe(trailing)
		expect(result.byPath.get('1.0')).toBeUndefined()
	})
})