import {describe, it, expect, beforeEach} from 'vitest'

import {effect, watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {Token} from './parser/types'

describe('TokenModel', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
	})

	function mountWith(value: string) {
		store.props.set({Mark: () => null, defaultValue: value})
		store.lifecycle.mounted()
	}

	describe('auto-parse on value change', () => {
		it('sets tokens from initial value on mount', () => {
			mountWith('hello')
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		})

		it('updates tokens when value changes via replaceAll', () => {
			mountWith('hello')
			store.value.current('world')
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		})

		it('falls back to empty string when defaultValue is empty', () => {
			mountWith('')
			expect(store.tokens.current()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])
		})

		it('mount with defaultValue initializes value current', () => {
			mountWith('test')
			expect(store.value.current()).toBe('test')
		})

		it('does not parse markup when Mark is not set', () => {
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.lifecycle.mounted()
			store.value.current('@[test]')
			expect(store.tokens.current()).toEqual([{type: 'text', content: '@[test]', position: {start: 0, end: 7}}])
		})

		it('parses markup when Mark is set', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.lifecycle.mounted()
			store.value.current('@[test]')
			expect(store.tokens.current()).toEqual(expect.arrayContaining([expect.objectContaining({type: 'mark'})]))
		})
	})

	describe('enable / disable', () => {
		it('is idempotent — setting Mark twice does not double-subscribe', () => {
			mountWith('hello')
			store.props.set({Mark: () => null})

			let updateCount = 0
			const stop = effect(() => {
				store.tokens.current()
				updateCount++
			})
			updateCount = 0

			store.tokens.invalidate()

			expect(updateCount).toBe(1)
			stop()
		})

		it('stops parse subscription after removing Mark', () => {
			mountWith('hello')
			const tokensBefore = store.tokens.current()
			store.props.set({Mark: undefined})
			store.tokens.invalidate()
			expect(store.tokens.current()).toBe(tokensBefore)
		})

		it('re-enables and parses fresh after Mark removed and re-added', () => {
			mountWith('first')
			store.props.set({Mark: undefined})
			store.value.current('second')
			store.props.set({Mark: () => null})
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])
		})
	})

	describe('reactive parse', () => {
		it('re-parses when parser changes', () => {
			mountWith('hello @[world]')
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.tokens.current()).toEqual([
				expect.objectContaining({type: 'text', content: 'hello '}),
				expect.objectContaining({type: 'mark', content: '@[world]', value: 'world'}),
				expect.objectContaining({type: 'text', content: ''}),
			])
		})
	})

	describe('invalidate event', () => {
		it('re-parses from current value on invalidate', () => {
			mountWith('test')
			store.tokens.invalidate()
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
		})
	})

	describe('signal ordering guarantee', () => {
		it('tokens.current is updated when value.current fires', () => {
			// TokenModel subscribes to value.current before any other watcher
			// added in onMounted, so by the time downstream listeners observe
			// value.current, tokens.current reflects the new value.
			store.props.set({Mark: () => null, defaultValue: ''})
			store.lifecycle.mounted()

			let tokensAtChangeTime: Token[] | undefined
			const stop = watch(store.value.current, () => {
				tokensAtChangeTime = store.tokens.current()
			})

			store.value.current('hello')

			expect(tokensAtChangeTime).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			stop()
		})
	})
})