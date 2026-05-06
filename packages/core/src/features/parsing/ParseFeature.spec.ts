import {describe, it, expect, beforeEach} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
	})

	describe('sync()', () => {
		it('sets tokens from current value', () => {
			store.value.current('hello')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.props.set({Mark: undefined})
		})

		it('sets tokens from explicit value', () => {
			store.props.set({Mark: () => null})
			store.parsing.sync('default')

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])

			store.props.set({Mark: undefined})
		})

		it('falls back to empty string when both are undefined', () => {
			store.props.set({Mark: () => null})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])

			store.props.set({Mark: undefined})
		})

		it('does not write value state', () => {
			store.props.set({Mark: () => null})
			store.parsing.sync('test')

			expect(store.value.current()).toBe('')

			store.props.set({Mark: undefined})
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.value.current('@hello')
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeUndefined()
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '@hello', position: {start: 0, end: 6}}])
		})

		it('uses markup when Mark override is set', () => {
			store.value.current('@hello')
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeDefined()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — setting Mark twice does not double-subscribe', () => {
			store.value.current('hello')
			store.props.set({Mark: () => null})
			// setting Mark again is a no-op (already true)
			store.props.set({Mark: () => null})
			store.parsing.sync()

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
			store.props.set({Mark: undefined})
		})

		it('stops parse subscription after removing Mark', () => {
			store.value.current('hello')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			store.props.set({Mark: undefined})

			const tokensBefore = store.parsing.tokens()
			store.parsing.reparse()
			expect(store.parsing.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.value.current('first')
			store.props.set({Mark: () => null})
			store.parsing.sync()
			store.props.set({Mark: undefined})

			store.value.current('second')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.props.set({Mark: undefined})
		})
	})

	describe('reactive parse', () => {
		it('does not react when only ParsingFeature is active and props.value changes', () => {
			store.value.current('hello')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			store.props.set({value: 'world'})

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.props.set({Mark: undefined})
		})

		it('re-parses from current value when parser changes', () => {
			store.value.current('hello @[world]')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})

			expect(store.parsing.tokens()).toEqual([
				expect.objectContaining({type: 'text', content: 'hello '}),
				expect.objectContaining({type: 'mark', content: '@[world]', value: 'world'}),
				expect.objectContaining({type: 'text', content: ''}),
			])

			store.props.set({Mark: undefined})
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.value.current('test')
			store.props.set({Mark: () => null})
			store.parsing.sync()

			store.caret.recovery({kind: 'caret', rawPosition: 0})
			store.parsing.reparse()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.value.current()).toBe('test')

			store.props.set({Mark: undefined})
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.value.current('hello')
			store.props.set({Mark: () => null})
			store.parsing.sync()
			store.caret.recovery({kind: 'caret', rawPosition: 0})

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

			callCount = 0
			store.caret.recovery({kind: 'caret', rawPosition: 1})
			expect(callCount).toBe(0)

			// oxlint-disable-next-line no-unsafe-type-assertion -- test spy restore
			;(store.parsing as unknown as Record<string, unknown>).tokens = original
			store.props.set({Mark: undefined})
		})
	})
})