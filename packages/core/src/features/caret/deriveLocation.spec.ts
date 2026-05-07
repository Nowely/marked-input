import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import {deriveLocation} from './deriveLocation'

describe('deriveLocation', () => {
	it('returns undefined when range is undefined', () => {
		const store = new Store()
		store.lifecycle.mounted()
		store.props.set({value: 'hello'})
		expect(deriveLocation(undefined, store.parsing.tokens(), store.parsing.index())).toBeUndefined()
	})

	it('returns undefined when position is out of bounds', () => {
		const store = new Store()
		store.lifecycle.mounted()
		store.props.set({value: 'hi'})
		expect(deriveLocation({start: 999, end: 999}, store.parsing.tokens(), store.parsing.index())).toBeUndefined()
	})

	it('returns text role for position inside a text token', () => {
		const store = new Store()
		store.lifecycle.mounted()
		store.props.set({value: 'hello'})
		const result = deriveLocation({start: 2, end: 2}, store.parsing.tokens(), store.parsing.index())
		expect(result?.role).toBe('text')
	})

	it('returns token role for position inside a mark token', () => {
		const store = new Store()
		store.lifecycle.mounted()
		store.props.set({Mark: () => null, value: '@[Alice](123)', options: [{markup: '@[__value__](__meta__)'}]})
		const tokens = store.parsing.tokens()
		const mark = tokens.find(t => t.type === 'mark')!
		const mid = Math.floor((mark.position.start + mark.position.end) / 2)
		const result = deriveLocation({start: mid, end: mid}, tokens, store.parsing.index())
		expect(result?.role).toBe('token')
	})
})