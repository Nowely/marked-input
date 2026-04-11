import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import type {SystemListenerFeature} from './SystemListenerFeature'

describe('SystemListenerFeature', () => {
	let store: Store
	let controller: SystemListenerFeature

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
		controller = store.features.system
	})

	describe('enable()', () => {
		it('should react to change event after enable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			controller.enable()

			// Emit change — handler should serialize tokens and call onChange
			store.event.change()

			expect(onChange).toHaveBeenCalled()
		})

		it('should be idempotent — calling enable twice does not double-subscribe', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hi', position: {start: 0, end: 2}}])

			controller.enable()
			controller.enable()

			store.event.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})

		it('should react to delete event with correct token', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			store.state.tokens([token, token2])

			controller.enable()

			store.event.delete({token})

			// After delete, the token should be removed from the tokens array
			expect(store.state.tokens()).toEqual([
				{
					type: 'text',
					content: 'b',
					position: {start: 0, end: 1},
				},
			])
			expect(onChange).toHaveBeenCalled()
		})

		it('should ignore delete events for tokens that are not in state', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			const missingToken = {type: 'text' as const, content: 'c', position: {start: 2, end: 3}}
			store.state.tokens([token, token2])

			controller.enable()

			store.event.delete({token: missingToken})

			expect(store.state.tokens()).toEqual([token, token2])
			expect(onChange).not.toHaveBeenCalled()
		})

		it('should react to select event with mark and match', () => {
			const onChange = vi.fn()
			store.setProps({onChange})

			controller.enable()

			// For select, we just verify the handler runs without error
			// The full behavior requires DOM setup, so we verify the effect subscribes
			const mark = {type: 'text' as const, content: '@user', position: {start: 0, end: 5}}
			store.state.tokens([mark])

			// oxlint-disable-next-line no-unsafe-type-assertion -- test stub with minimal OverlayMatch shape
			const match = {
				option: {markup: '[$1](user:$1)'},
				span: '@user',
				index: 0,
				source: '@user',
				value: '@user',
				// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
				node: {} as unknown as Node,
			} as unknown as OverlayMatch

			store.event.select({mark, match})
		})
	})

	describe('disable()', () => {
		it('should stop reacting to events after disable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			controller.enable()
			controller.disable()

			store.event.change()

			expect(onChange).not.toHaveBeenCalled()
		})

		it('should stop reacting to delete events after disable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			store.state.tokens([token])

			controller.enable()
			controller.disable()

			store.event.delete({token})

			expect(onChange).not.toHaveBeenCalled()
		})

		it('should allow re-enabling after disable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			store.state.tokens([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			controller.enable()
			controller.disable()
			controller.enable()

			store.event.change()

			expect(onChange).toHaveBeenCalledTimes(1)
		})
	})
})