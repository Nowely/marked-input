import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('SystemListenerFeature', () => {
	it('exists as a no-op shell (watchers redistributed)', () => {
		const store = new Store()
		expect(store.feature.system).toBeDefined()
		store.feature.system.enable()
		store.feature.system.disable()
	})
})