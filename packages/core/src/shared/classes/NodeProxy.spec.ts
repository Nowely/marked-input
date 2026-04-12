import {describe, it, expect} from 'vitest'

import {Store} from '../../store/Store'
import {NodeProxy} from './NodeProxy'

describe('NodeProxy', () => {
	describe('isCaretAtBeginning', () => {
		it('returns false (not undefined) when target is not set', () => {
			const proxy = new NodeProxy(null, new Store())
			expect(proxy.isCaretAtBeginning).toBe(false)
		})
	})

	describe('isCaretAtEnd', () => {
		it('returns false (not undefined) when target is not set', () => {
			const proxy = new NodeProxy(null, new Store())
			expect(proxy.isCaretAtEnd).toBe(false)
		})
	})
})