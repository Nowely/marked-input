import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('CaretFeature', () => {
	it('owns recovery and selecting signals (aliased with legacy maps)', () => {
		const store = new Store()
		expect(store.feature.caret.state.recovery).toBe(store.state.recovery)
		expect(store.feature.caret.state.selecting).toBe(store.state.selecting)
	})
})