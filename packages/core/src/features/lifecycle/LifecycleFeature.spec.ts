import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('LifecycleFeature', () => {
	it('exposes mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.feature.lifecycle.mounted).toBe('function')
		expect(typeof store.feature.lifecycle.unmounted).toBe('function')
		expect(typeof store.feature.lifecycle.rendered).toBe('function')
	})
})