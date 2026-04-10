import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../../store/Store'

// oxlint-disable-next-line no-unsafe-type-assertion -- test stub for container ref
const stubContainer = {
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
} as unknown as HTMLDivElement

describe('FocusFeature', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		setUseHookFactory(() => () => undefined)
		store = new Store()
		store.refs.container = stubContainer
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'focus') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('afterTokensRendered handler', () => {
		it('always emits sync', () => {
			store.features.focus.enable()

			const syncSpy = vi.spyOn(store.event, 'sync')
			store.event.afterTokensRendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.features.focus.disable()
		})

		it('emits recoverFocus when Mark is set', () => {
			store.state.Mark(() => null)
			store.features.focus.enable()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).toHaveBeenCalledOnce()

			store.features.focus.disable()
		})

		it('does not emit recoverFocus when Mark is not set', () => {
			store.features.focus.enable()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).not.toHaveBeenCalled()

			store.features.focus.disable()
		})
	})
})