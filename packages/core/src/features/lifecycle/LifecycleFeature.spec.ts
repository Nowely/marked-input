import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('LifecycleFeature', () => {
	it('exposes mounted, unmounted, rendered events', () => {
		const store = new Store()
		expect(typeof store.lifecycle.mounted).toBe('function')
		expect(typeof store.lifecycle.unmounted).toBe('function')
		expect(typeof store.lifecycle.rendered).toBe('function')
		store.lifecycle.rendered({container: document.createElement('div'), layout: 'inline'})
	})
})