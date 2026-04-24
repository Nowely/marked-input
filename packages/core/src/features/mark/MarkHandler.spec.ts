import {describe, it, expect, vi} from 'vitest'

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
		store.parsing.tokens([{type: 'text', content: 'hi ', position: {start: 0, end: 3}}, markToken])

		const handler = new MarkHandler({ref: {current: null}, store, token: markToken})

		expect(handler.depth).toBe(0)
	})

	it('return parent as undefined for top-level mark', () => {
		const store = new Store()
		const markToken = createMarkToken()
		store.parsing.tokens([markToken])

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
		store.parsing.tokens([outerMark])

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
		store.parsing.tokens([outerMark])

		const handler = new MarkHandler({ref: {current: null}, store, token: innerMark})

		expect(handler.parent).toBe(outerMark)
	})

	it('return depth 0 when token not found in state', () => {
		const store = new Store()
		const markToken = createMarkToken()
		store.parsing.tokens([{type: 'text', content: 'other', position: {start: 0, end: 5}}])

		const handler = new MarkHandler({ref: {current: null}, store, token: markToken})

		expect(handler.depth).toBe(0)
	})

	it('restore accepted store tokens when content setter runs while readOnly', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({
			defaultValue: '@[user]',
			readOnly: true,
			onChange,
			Mark: () => null,
			options: [{markup: '@[__value__]'}],
		})
		store.value.enable()
		const token = store.parsing.tokens().find(token => token.type === 'mark')
		if (!token) throw new Error('expected parsed mark token')
		const handler = new MarkHandler({ref: {current: null}, store, token})

		handler.content = '@[other]'

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('@[user]')
		expect(store.parsing.tokens().find(token => token.type === 'mark')).toEqual(
			expect.objectContaining({type: 'mark', content: '@[user]', value: 'user'})
		)
		store.value.disable()
	})
})