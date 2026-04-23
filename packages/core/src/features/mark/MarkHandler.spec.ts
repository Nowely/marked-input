import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import type {MarkToken} from '../parsing'
import {MarkHandler} from './MarkHandler'

function createMarkToken(overrides: Partial<MarkToken> = {}): MarkToken {
	return {
		type: 'mark',
		content: '@user',
		value: 'user',
		descriptor: {
			index: 0,
			markup: '@[__value__]' as MarkToken['descriptor']['markup'],
			segments: [],
			gapTypes: [],
			hasSlot: false,
			hasTwoValues: false,
			segmentGlobalIndices: [],
		},
		children: [],
		position: {start: 0, end: 5},
		...overrides,
	}
}

describe('MarkHandler', () => {
	it('return depth 0 for top-level mark', () => {
		const store = new Store()
		const markToken = createMarkToken()
		store.feature.parsing.state.tokens([{type: 'text', content: 'hi ', position: {start: 0, end: 3}}, markToken])

		const handler = new MarkHandler({ref: {current: null}, store, token: markToken})

		expect(handler.depth).toBe(0)
	})

	it('return parent as undefined for top-level mark', () => {
		const store = new Store()
		const markToken = createMarkToken()
		store.feature.parsing.state.tokens([markToken])

		const handler = new MarkHandler({ref: {current: null}, store, token: markToken})

		expect(handler.parent).toBeUndefined()
	})

	it('return depth 1 for nested mark', () => {
		const store = new Store()
		const innerMark = createMarkToken({content: '#tag', value: 'tag', position: {start: 0, end: 4}})
		const outerMark = createMarkToken({
			content: '@user #tag',
			value: 'user',
			children: [innerMark],
			position: {start: 0, end: 9},
		})
		store.feature.parsing.state.tokens([outerMark])

		const handler = new MarkHandler({ref: {current: null}, store, token: innerMark})

		expect(handler.depth).toBe(1)
	})

	it('return parent for nested mark', () => {
		const store = new Store()
		const innerMark = createMarkToken({content: '#tag', value: 'tag', position: {start: 0, end: 4}})
		const outerMark = createMarkToken({
			content: '@user #tag',
			value: 'user',
			children: [innerMark],
			position: {start: 0, end: 9},
		})
		store.feature.parsing.state.tokens([outerMark])

		const handler = new MarkHandler({ref: {current: null}, store, token: innerMark})

		expect(handler.parent).toBe(outerMark)
	})

	it('return depth 0 when token not found in state', () => {
		const store = new Store()
		const markToken = createMarkToken()
		store.feature.parsing.state.tokens([{type: 'text', content: 'other', position: {start: 0, end: 5}}])

		const handler = new MarkHandler({ref: {current: null}, store, token: markToken})

		expect(handler.depth).toBe(0)
	})
})