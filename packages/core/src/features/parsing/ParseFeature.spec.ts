import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ParseFeature', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'parse') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('sync()', () => {
		it('sets tokens from value signal', () => {
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.parse.disable()
		})

		it('falls back to defaultValue when value is undefined', () => {
			store.feature.parse.enable()
			store.setProps({defaultValue: 'default'})
			store.feature.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])

			store.feature.parse.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.feature.parse.enable()
			store.feature.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])

			store.feature.parse.disable()
		})

		it('sets previousValue to the parsed input', () => {
			store.feature.parse.enable()
			store.setProps({value: 'test'})
			store.feature.parse.sync()

			expect(store.state.previousValue()).toBe('test')

			store.feature.parse.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.feature.parse.enable()
			store.setProps({options: [{markup: '@[__value__]'}], value: '@hello'})
			store.feature.parse.sync()

			expect(store.computed.parser()).toBeUndefined()
			expect(store.state.tokens()).toEqual([{type: 'text', content: '@hello', position: {start: 0, end: 6}}])

			store.feature.parse.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.feature.parse.enable()
			store.setProps({Mark: () => null, options: [{markup: '@[__value__]'}], value: '@hello'})
			store.feature.parse.sync()

			expect(store.computed.parser()).toBeDefined()

			store.feature.parse.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.feature.parse.enable()
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()

			let callCount = 0
			const original = store.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.state as Record<string, unknown>).tokens = tokensWrapper

			store.event.reparse()
			expect(callCount).toBe(1)

			;(store.state as Record<string, unknown>).tokens = original
			store.feature.parse.disable()
		})

		it('stops parse subscription after disable', () => {
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()

			store.feature.parse.disable()

			const tokensBefore = store.state.tokens()
			store.event.reparse()
			expect(store.state.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.feature.parse.enable()
			store.setProps({value: 'first'})
			store.feature.parse.sync()
			store.feature.parse.disable()

			store.feature.parse.enable()
			store.setProps({value: 'second'})
			store.feature.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.feature.parse.disable()
		})
	})

	describe('reactive parse', () => {
		it('reactively re-parses when props.value changes', () => {
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()

			store.setProps({value: 'world'})

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
			expect(store.state.previousValue()).toBe('world')

			store.feature.parse.disable()
		})

		it('does not re-parse in recovery mode when props.value changes', () => {
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()

			store.state.recovery({caret: 0, anchor: store.nodes.focus})
			store.setProps({value: 'world'})

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.feature.parse.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.feature.parse.enable()
			store.setProps({value: 'test'})
			store.feature.parse.sync()

			store.state.recovery({caret: 0, anchor: store.nodes.focus})
			store.event.reparse()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue()).toBe('test')

			store.feature.parse.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.feature.parse.enable()
			store.setProps({value: 'hello'})
			store.feature.parse.sync()
			store.state.recovery({caret: 0, anchor: store.nodes.focus})

			let callCount = 0
			const original = store.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.state as Record<string, unknown>).tokens = tokensWrapper

			store.event.reparse()
			expect(callCount).toBe(1)

			callCount = 0
			store.state.recovery({caret: 1, anchor: store.nodes.focus})
			expect(callCount).toBe(0)

			;(store.state as Record<string, unknown>).tokens = original
			store.feature.parse.disable()
		})
	})
})