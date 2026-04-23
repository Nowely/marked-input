import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	it('exposes tokens signal', () => {
		const store = new Store()
		expect(Array.isArray(store.feature.parsing.state.tokens())).toBe(true)
	})

	it('aliases tokens, parser, reparse with legacy store maps', () => {
		const store = new Store()
		expect(store.feature.parsing.state.tokens).toBe(store.state.tokens)
		expect(store.feature.parsing.computed.parser).toBe(store.computed.parser)
		expect(store.feature.parsing.emit.reparse).toBe(store.emit.reparse)
	})
})