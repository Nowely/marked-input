import {describe, it, expect, beforeEach} from 'vitest'

import {watch} from '../../../shared/signals'
import {Store} from '../../../store/Store'
import type {Token} from '../parser/types'

/**
 * Parse-pipeline behavior through the Store. The model publishes nothing
 * before mount, so each test attaches a bare container; with no aligned DOM
 * every commit settles structurally (the text branch escalates on missing
 * surfaces), keeping `current()` exactly the reconciled parse — which is what
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
			expect(store.tokens.current()).toMatchObject([
				{type: 'text', content: 'hello', position: {start: 0, end: 5}},
			])
		})

		it('updates tokens when value changes via replaceAll', () => {
			mountWith('hello')
			store.tokens.setValue('world')
			expect(store.tokens.current()).toMatchObject([
				{type: 'text', content: 'world', position: {start: 0, end: 5}},
			])
		})

		it('falls back to empty string when defaultValue is empty', () => {
			mountWith('')
			expect(store.tokens.current()).toMatchObject([{type: 'text', content: '', position: {start: 0, end: 0}}])
		})

		it('mount with defaultValue initializes value current', () => {
			mountWith('test')
			expect(store.tokens.value()).toBe('test')
		})

		it('does not parse markup when Mark is not set', () => {
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
			expect(store.tokens.current()).toMatchObject([
				{type: 'text', content: '@[test]', position: {start: 0, end: 7}},
			])
		})

		it('parses markup when Mark is set', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.host.container(document.createElement('div'))
			store.tokens.setValue('@[test]')
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
			store.tokens.setValue('second')
			store.props.set({Mark: () => null})
			expect(store.tokens.current()).toMatchObject([
				{type: 'text', content: 'second', position: {start: 0, end: 6}},
			])
		})
	})

	describe('signal ordering guarantee', () => {
		it('current() is updated when value.current fires', () => {
			// The model's reconcile watch is registered at mount, before any other
			// watcher added afterwards, so by the time downstream listeners observe
			// value.current, current() reflects the new value (the structural commit
			// self-heals synchronously against the bare container).
			store.props.set({Mark: () => null, defaultValue: ''})
			store.host.container(document.createElement('div'))
			let tokensAtChangeTime: readonly Token[] | undefined
			const stop = watch(store.tokens.value, () => {
				tokensAtChangeTime = store.tokens.current()
			})

			store.tokens.setValue('hello')

			expect(tokensAtChangeTime).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

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
			store.host.container(document.createElement('div'))
			expect(store.tokens.current()).toHaveLength(3)
			expect(store.tokens.current()[0].type).toBe('text')
			expect(store.tokens.current()[1].type).toBe('mark')
			expect(store.tokens.current()[2].type).toBe('text')
		})
	})

	describe('keyOf (adapter SPI)', () => {
		it('returns the stable identity id — a suffix-shifted token keeps its key', () => {
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], defaultValue: 'he@[x]llo'})
			store.host.container(document.createElement('div'))
			const mark = store.tokens.current()[1]
			const markKey = store.tokens.keyOf(mark)

			// edit BEFORE the mark: 'he@[x]llo' → 'Xhe@[x]llo' — the mark suffix-
			// shifts into a NEW object with an INHERITED id; the framework key
			// must not change (object-keyed counters remounted it, the defect)
			store.tokens.setValue('Xhe@[x]llo')

			const shifted = store.tokens.current()[1]
			expect(shifted).not.toBe(mark)
			expect(store.tokens.keyOf(shifted)).toBe(markKey)
		})
	})
})