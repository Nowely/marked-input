import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('MarkFeature', () => {
	it('hasMark is false when no Mark is configured', () => {
		const store = new Store()
		expect(store.feature.mark.computed.hasMark()).toBe(false)
	})

	it('hasMark is true when Mark prop is set', () => {
		const store = new Store()
		store.setProps({Mark: () => null})
		expect(store.feature.mark.computed.hasMark()).toBe(true)
	})

	it('exposes hasMark, mark, markRemove', () => {
		const store = new Store()
		expect(typeof store.feature.mark.computed.hasMark).toBe('function')
		expect(typeof store.feature.mark.computed.mark).toBe('function')
		expect(typeof store.feature.mark.emit.markRemove).toBe('function')
	})

	describe('markRemove handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
			store.feature.value.enable()
		})

		it('react to delete event with correct token', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			store.feature.parsing.state.tokens([token, token2])

			store.feature.mark.enable()

			store.feature.mark.emit.markRemove({token})

			expect(store.feature.parsing.state.tokens()).toEqual([
				{
					type: 'text',
					content: 'b',
					position: {start: 0, end: 1},
				},
			])
			expect(onChange).toHaveBeenCalled()
		})

		it('ignore markRemove events for tokens that are not in state', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			const missingToken = {type: 'text' as const, content: 'c', position: {start: 2, end: 3}}
			store.feature.parsing.state.tokens([token, token2])

			store.feature.mark.enable()

			store.feature.mark.emit.markRemove({token: missingToken})

			expect(store.feature.parsing.state.tokens()).toEqual([token, token2])
			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('stop reacting to markRemove events after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			store.feature.parsing.state.tokens([token])

			store.feature.value.enable()
			store.feature.mark.enable()
			store.feature.mark.disable()

			store.feature.mark.emit.markRemove({token})

			expect(onChange).not.toHaveBeenCalled()
		})
	})
})