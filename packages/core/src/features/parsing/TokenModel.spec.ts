import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../shared/signals'
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

		it('re-parses when Mark is added or removed', () => {
			mountWith('first')
			store.props.set({Mark: undefined})
			store.value.current('second')
			store.props.set({Mark: () => null})
			expect(store.tokens.current()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])
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

	describe('block layout empty text filtering', () => {
		it('filters out empty text tokens when layout is block', () => {
			store.props.set({
				Mark: () => null,
				layout: 'block',
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.lifecycle.mounted()
			expect(store.tokens.current()).toHaveLength(1)
			expect(store.tokens.current()[0].type).toBe('mark')
		})

		it('does not filter out empty text tokens when layout is inline', () => {
			store.props.set({
				Mark: () => null,
				layout: 'inline',
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.lifecycle.mounted()
			expect(store.tokens.current()).toHaveLength(3)
			expect(store.tokens.current()[0].type).toBe('text')
			expect(store.tokens.current()[1].type).toBe('mark')
			expect(store.tokens.current()[2].type).toBe('text')
		})
	})
})