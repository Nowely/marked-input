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
	})

	describe('enable()', () => {
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
})