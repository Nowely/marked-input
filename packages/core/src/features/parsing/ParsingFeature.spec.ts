import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	it('exposes tokens signal', () => {
		const store = new Store()
		expect(Array.isArray(store.feature.parsing.tokens())).toBe(true)
	})

	it('exposes tokens, parser, reparse', () => {
		const store = new Store()
		expect(Array.isArray(store.feature.parsing.tokens())).toBe(true)
		expect(typeof store.feature.parsing.parser).toBe('function')
		expect(typeof store.feature.parsing.reparse).toBe('function')
	})
})