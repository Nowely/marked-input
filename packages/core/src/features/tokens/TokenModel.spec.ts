import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {Token} from './parser/types'

/**
 * Parse-pipeline behavior through the Store. The model publishes nothing
 * before mount, so each test attaches a bare container; with no aligned DOM
 * every commit settles structurally (the text branch escalates on missing
 * surfaces), keeping `tree()` exactly the reconciled parse — which is what
 * these scenarios pin.
 */
describe('TokenModel', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
	})

	function mountWith(value: string) {
		store.props.set({Mark: () => null, defaultValue: value})
		store.host.container(document.createElement('div'))
	}

	describe('auto-parse on value change', () => {
		it('sets tokens from initial value on mount', () => {
			mountWith('hello')
			expect(store.tokens.tree()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
		})

		it('updates tokens when value changes via replaceAll', () => {
			mountWith('hello')
			store.value.current('world')
			expect(store.tokens.tree()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
		})

		it('falls back to empty string when defaultValue is empty', () => {
			mountWith('')
			expect(store.tokens.tree()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])
		})

		it('mount with defaultValue initializes value current', () => {
			mountWith('test')
			expect(store.value.current()).toBe('test')
		})

		it('does not parse markup when Mark is not set', () => {
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.value.current('@[test]')
			expect(store.tokens.tree()).toEqual([{type: 'text', content: '@[test]', position: {start: 0, end: 7}}])
		})

		it('parses markup when Mark is set', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.value.current('@[test]')
			expect(store.tokens.tree()).toEqual(expect.arrayContaining([expect.objectContaining({type: 'mark'})]))
		})
	})

	describe('reactive parse', () => {
		it('re-parses when parser changes', () => {
			mountWith('hello @[world]')
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			expect(store.tokens.tree()).toEqual([
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
			expect(store.tokens.tree()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])
		})
	})

	describe('signal ordering guarantee', () => {
		it('tokens.tree is updated when value.current fires', () => {
			// The model's reconcile watch is registered at mount, before any other
			// watcher added afterwards, so by the time downstream listeners observe
			// value.current, tree() reflects the new value (the structural commit
			// self-heals synchronously against the bare container).
			store.props.set({Mark: () => null, defaultValue: ''})
			store.host.container(document.createElement('div'))
			let tokensAtChangeTime: Token[] | undefined
			const stop = watch(store.value.current, () => {
				tokensAtChangeTime = store.tokens.tree()
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
			store.host.container(document.createElement('div'))
			expect(store.tokens.tree()).toHaveLength(1)
			expect(store.tokens.tree()[0].type).toBe('mark')
		})

		it('does not filter out empty text tokens when layout is inline', () => {
			store.props.set({
				Mark: () => null,
				layout: 'inline',
				options: [{markup: '@[__value__]'}],
				defaultValue: '@[hello]',
			})
			store.host.container(document.createElement('div'))
			expect(store.tokens.tree()).toHaveLength(3)
			expect(store.tokens.tree()[0].type).toBe('text')
			expect(store.tokens.tree()[1].type).toBe('mark')
			expect(store.tokens.tree()[2].type).toBe('text')
		})
	})
})