import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {Token} from './parser/types'

describe('ParseController', () => {
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
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		})

		it('updates tokens when value changes via replaceAll', () => {
			mountWith('hello')
			store.value.current('world')
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		})

		it('falls back to empty string when defaultValue is empty', () => {
			mountWith('')
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])
		})

		it('mount with defaultValue initializes value current', () => {
			mountWith('test')
			expect(store.value.current()).toBe('test')
		})

		it('parser is undefined when no Mark and no per-option Mark', () => {
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.lifecycle.mounted()
			expect(store.parsing.parser()).toBeUndefined()
		})

		it('parser is defined when Mark override is set', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.lifecycle.mounted()
			expect(store.parsing.parser()).toBeDefined()
		})
	})

	describe('enable / disable', () => {
		it('is idempotent — setting Mark twice does not double-subscribe', () => {
			mountWith('hello')
			store.props.set({Mark: () => null})

			let callCount = 0
			const original = store.parsing.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			// oxlint-disable-next-line no-unsafe-type-assertion -- test spy
			;(store.parsing as unknown as Record<string, unknown>).tokens = tokensWrapper

			store.parsing.reparse()
			expect(callCount).toBe(1)

			// oxlint-disable-next-line no-unsafe-type-assertion -- test spy restore
			;(store.parsing as unknown as Record<string, unknown>).tokens = original
		})

		it('stops parse subscription after removing Mark', () => {
			mountWith('hello')
			const tokensBefore = store.parsing.tokens()
			store.props.set({Mark: undefined})
			store.parsing.reparse()
			expect(store.parsing.tokens()).toBe(tokensBefore)
		})

		it('re-enables and parses fresh after Mark removed and re-added', () => {
			mountWith('first')
			store.props.set({Mark: undefined})
			store.value.current('second')
			store.props.set({Mark: () => null})
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])
		})
	})

	describe('reactive parse', () => {
		it('re-parses when parser changes', () => {
			mountWith('hello @[world]')
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.parsing.tokens()).toEqual([
				expect.objectContaining({type: 'text', content: 'hello '}),
				expect.objectContaining({type: 'mark', content: '@[world]', value: 'world'}),
				expect.objectContaining({type: 'text', content: ''}),
			])
		})
	})

	describe('reparse event', () => {
		it('re-parses from current value on reparse', () => {
			mountWith('test')
			store.parsing.reparse()
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
		})
	})

	describe('signal ordering guarantee', () => {
		it('parsing.tokens is updated when value.current fires', () => {
			// ParseController subscribes to value.current before any other watcher
			// added in onMounted, so by the time downstream listeners observe
			// value.current, parsing.tokens reflects the new value.
			store.props.set({Mark: () => null, defaultValue: ''})
			store.lifecycle.mounted()

			let tokensAtChangeTime: Token[] | undefined
			const stop = watch(store.value.current, () => {
				tokensAtChangeTime = store.parsing.tokens()
			})

			store.value.current('hello')

			expect(tokensAtChangeTime).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			stop()
		})
	})
})