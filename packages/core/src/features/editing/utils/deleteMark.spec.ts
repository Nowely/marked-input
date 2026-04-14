import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

import {Store} from '../../../store/Store'
import type {Token} from '../../parsing'
import {deleteMark} from './deleteMark'

class MockHTMLElement {
	textContent = ''
	isContentEditable = true
	parentElement: MockHTMLElement | null = null
	children: MockHTMLElement[] = []
	focus = vi.fn()
}

beforeEach(() => {
	vi.stubGlobal('HTMLElement', MockHTMLElement)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('deleteMark', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'system') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
		store.features.system.enable()
	})

	function setupDOM() {
		const span1 = new MockHTMLElement()
		span1.textContent = 'hi '
		const mark = new MockHTMLElement()
		mark.textContent = '@user'
		mark.isContentEditable = false
		const span2 = new MockHTMLElement()
		span2.textContent = ' there'

		const container = new MockHTMLElement()
		container.children = [span1, mark, span2]
		span1.parentElement = container
		mark.parentElement = container
		span2.parentElement = container

		// oxlint-disable-next-line no-unsafe-type-assertion
		// oxlint-disable-next-line no-unsafe-type-assertion
		store.refs.container = container as unknown as HTMLDivElement
		// oxlint-disable-next-line no-unsafe-type-assertion
		store.nodes.focus.target = mark as unknown as HTMLElement
	}

	function makeTokens(): Token[] {
		const textToken1 = {type: 'text' as const, content: 'hi ', position: {start: 0, end: 3}}
		// oxlint-disable-next-line no-unsafe-type-assertion
		const markToken = {
			type: 'mark' as const,
			content: '@user',
			value: 'user',
			descriptor: {index: 0},
			children: [],
			position: {start: 3, end: 8},
		} as unknown as Token
		const textToken2 = {type: 'text' as const, content: ' there', position: {start: 8, end: 14}}
		return [textToken1, markToken, textToken2]
	}

	it('should fire event.change after deleting a mark', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(onChange).toHaveBeenCalled()
	})

	it('should merge adjacent text spans after deletion', () => {
		const onChange = vi.fn()
		store.setProps({onChange})
		setupDOM()
		store.state.tokens(makeTokens())

		deleteMark('self', store)

		expect(store.state.tokens()).toHaveLength(1)
		expect(store.state.tokens()[0].content).toBe('hi  there')
	})
})