import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('MarkFeature', () => {
	it('enabled is false when no Mark is configured', () => {
		const store = new Store()
		expect(store.mark.enabled()).toBe(false)
	})

	it('enabled is true when Mark prop is set', () => {
		const store = new Store()
		store.props.set({Mark: () => null})
		expect(store.mark.enabled()).toBe(true)
	})

	it('exposes enabled, slot, remove', () => {
		const store = new Store()
		expect(typeof store.mark.enabled).toBe('function')
		expect(typeof store.mark.slot).toBe('function')
		expect(typeof store.mark.remove).toBe('function')
	})

	describe('remove handler', () => {
		let store: Store

		beforeEach(() => {
			store = new Store()
			store.value.enable()
		})

		it('react to delete event with correct token', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			store.parsing.tokens([token, token2])

			store.mark.enable()

			store.mark.remove({token})

			expect(store.parsing.tokens()).toEqual([
				{
					type: 'text',
					content: 'b',
					position: {start: 0, end: 1},
				},
			])
			expect(onChange).toHaveBeenCalled()
		})

		it('ignore remove events for tokens that are not in state', () => {
			const onChange = vi.fn()
			store.props.set({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			const missingToken = {type: 'text' as const, content: 'c', position: {start: 2, end: 3}}
			store.parsing.tokens([token, token2])

			store.mark.enable()

			store.mark.remove({token: missingToken})

			expect(store.parsing.tokens()).toEqual([token, token2])
			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('stop reacting to remove events after disable', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			store.parsing.tokens([token])

			store.value.enable()
			store.mark.enable()
			store.mark.disable()

			store.mark.remove({token})

			expect(onChange).not.toHaveBeenCalled()
		})
	})
})