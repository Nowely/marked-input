import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('CaretFeature', () => {
	it('owns recovery and selecting signals', () => {
		const store = new Store()
		expect(typeof store.caret.recovery).toBe('function')
		expect(typeof store.caret.selecting).toBe('function')
	})
})