import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import type {SystemListenerFeature} from './SystemListenerFeature'

describe('SystemListenerFeature', () => {
	let store: Store
	let controller: SystemListenerFeature

	beforeEach(() => {
		store = new Store()
		controller = store.feature.system
		store.feature.value.enable()
	})

	describe('enable()', () => {
		it('react to delete event with correct token', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			const token2 = {type: 'text' as const, content: 'b', position: {start: 1, end: 2}}
			store.state.tokens([token, token2])

			controller.enable()

			store.emit.markRemove({token})

			expect(store.state.tokens()).toEqual([
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
			store.state.tokens([token, token2])

			controller.enable()

			store.emit.markRemove({token: missingToken})

			expect(store.state.tokens()).toEqual([token, token2])
			expect(onChange).not.toHaveBeenCalled()
		})

		it('react to select event with mark and match', () => {
			const onChange = vi.fn()
			store.setProps({onChange})

			controller.enable()

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

			store.emit.overlaySelect({mark, match})

			expect(store.state.recovery()).toBeDefined()
			expect(store.state.recovery()?.caret).toBe('[$1](user:$1)'.length)
			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe('disable()', () => {
		it('stop reacting to markRemove events after disable', () => {
			const onChange = vi.fn()
			store.setProps({onChange})
			const token = {type: 'text' as const, content: 'a', position: {start: 0, end: 1}}
			store.state.tokens([token])

			controller.enable()
			controller.disable()

			store.emit.markRemove({token})

			expect(onChange).not.toHaveBeenCalled()
		})
	})
})