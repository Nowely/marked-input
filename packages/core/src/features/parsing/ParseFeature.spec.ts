import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../../store/Store'

describe('ParseFeature', () => {
	let store: Store

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
		const features = store.features as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(features)) {
			if (key === 'parse') continue
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('sync()', () => {
		it('sets tokens from value signal', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.features.parse.disable()
		})

		it('falls back to defaultValue when value is undefined', () => {
			store.features.parse.enable()
			store.props.defaultValue('default')
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])

			store.features.parse.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.features.parse.enable()
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])

			store.features.parse.disable()
		})

		it('sets previousValue to the parsed input', () => {
			store.features.parse.enable()
			store.props.value('test')
			store.features.parse.sync()

			expect(store.state.previousValue()).toBe('test')

			store.features.parse.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.features.parse.enable()
			store.props.options([{markup: '@[__value__]'}])
			store.props.value('@hello')
			store.features.parse.sync()

			expect(store.computed.parser()).toBeUndefined()
			expect(store.state.tokens()).toEqual([{type: 'text', content: '@hello', position: {start: 0, end: 6}}])

			store.features.parse.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.features.parse.enable()
			store.props.Mark(() => null)
			store.props.options([{markup: '@[__value__]'}])
			store.props.value('@hello')
			store.features.parse.sync()

			expect(store.computed.parser()).toBeDefined()

			store.features.parse.disable()
		})
	})

	describe('hasChanged()', () => {
		it('returns true before sync() is called', () => {
			expect(store.features.parse.hasChanged()).toBe(true)
		})

		it('returns false after sync() with no value/parser change', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			expect(store.features.parse.hasChanged()).toBe(false)

			store.features.parse.disable()
		})

		it('returns true when value changes after sync()', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			store.props.value('world')

			expect(store.features.parse.hasChanged()).toBe(true)

			store.features.parse.disable()
		})

		it('returns true when parser changes after sync()', () => {
			store.features.parse.enable()
			store.props.Mark(() => null)
			store.props.options([{markup: '@[__value__]'}])
			store.props.value('hello')
			store.features.parse.sync()

			store.props.options([{markup: '#[__value__]'}])

			expect(store.features.parse.hasChanged()).toBe(true)

			store.features.parse.disable()
		})

		it('updates internal cache as side effect', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			store.props.value('world')
			store.features.parse.hasChanged()

			expect(store.features.parse.hasChanged()).toBe(false)

			store.features.parse.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.features.parse.enable()
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			let callCount = 0
			const original = store.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.state as Record<string, unknown>).tokens = tokensWrapper

			store.event.parse()
			expect(callCount).toBe(1)

			;(store.state as Record<string, unknown>).tokens = original
			store.features.parse.disable()
		})

		it('stops parse subscription after disable', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()

			store.features.parse.disable()

			const tokensBefore = store.state.tokens()
			store.event.parse()
			expect(store.state.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.features.parse.enable()
			store.props.value('first')
			store.features.parse.sync()
			store.features.parse.disable()

			store.features.parse.enable()
			store.props.value('second')
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.features.parse.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.features.parse.enable()
			store.props.value('test')
			store.features.parse.sync()

			store.state.recovery({caret: 0, anchor: store.nodes.focus})
			store.event.parse()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue()).toBe('test')

			store.features.parse.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.features.parse.enable()
			store.props.value('hello')
			store.features.parse.sync()
			store.state.recovery({caret: 0, anchor: store.nodes.focus})

			let callCount = 0
			const original = store.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.state as Record<string, unknown>).tokens = tokensWrapper

			store.event.parse()
			expect(callCount).toBe(1)

			callCount = 0
			store.state.recovery({caret: 1, anchor: store.nodes.focus})
			expect(callCount).toBe(0)

			;(store.state as Record<string, unknown>).tokens = original
			store.features.parse.disable()
		})
	})
})