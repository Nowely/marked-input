import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	it('exposes tokens signal', () => {
		const store = new Store()
		expect(Array.isArray(store.parsing.tokens())).toBe(true)
	})

	it('exposes tokens, parser, reparse', () => {
		const store = new Store()
		expect(Array.isArray(store.parsing.tokens())).toBe(true)
		expect(typeof store.parsing.parser).toBe('function')
		expect(typeof store.parsing.reparse).toBe('function')
	})
})