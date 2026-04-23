import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const feature = store.feature as Record<string, {enable(): void; disable(): void}>
		for (const key of Object.keys(feature)) {
			if (key === 'parsing') continue
			vi.spyOn(feature[key], 'enable').mockImplementation(() => {})
			vi.spyOn(feature[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('sync()', () => {
		it('sets tokens from value signal', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'hello', position: {start: 0, end: 5}},
			])

			store.feature.parsing.disable()
		})

		it('falls back to defaultValue when value is undefined', () => {
			store.feature.parsing.enable()
			store.props.set({defaultValue: 'default'})
			store.feature.parsing.sync()

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'default', position: {start: 0, end: 7}},
			])

			store.feature.parsing.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.feature.parsing.enable()
			store.feature.parsing.sync()

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: '', position: {start: 0, end: 0}},
			])

			store.feature.parsing.disable()
		})

		it('sets previousValue to the parsed input', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'test'})
			store.feature.parsing.sync()

			expect(store.feature.value.previousValue()).toBe('test')

			store.feature.parsing.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.feature.parsing.enable()
			store.props.set({options: [{markup: '@[__value__]'}], value: '@hello'})
			store.feature.parsing.sync()

			expect(store.feature.parsing.computed.parser()).toBeUndefined()
			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: '@hello', position: {start: 0, end: 6}},
			])

			store.feature.parsing.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.feature.parsing.enable()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], value: '@hello'})
			store.feature.parsing.sync()

			expect(store.feature.parsing.computed.parser()).toBeDefined()

			store.feature.parsing.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.feature.parsing.enable()
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()

			let callCount = 0
			const original = store.feature.parsing.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.feature.parsing.state as Record<string, unknown>).tokens = tokensWrapper

			store.feature.parsing.emit.reparse()
			expect(callCount).toBe(1)

			;(store.feature.parsing.state as Record<string, unknown>).tokens = original
			store.feature.parsing.disable()
		})

		it('stops parse subscription after disable', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()

			store.feature.parsing.disable()

			const tokensBefore = store.feature.parsing.state.tokens()
			store.feature.parsing.emit.reparse()
			expect(store.feature.parsing.state.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'first'})
			store.feature.parsing.sync()
			store.feature.parsing.disable()

			store.feature.parsing.enable()
			store.props.set({value: 'second'})
			store.feature.parsing.sync()

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'second', position: {start: 0, end: 6}},
			])

			store.feature.parsing.disable()
		})
	})

	describe('reactive parse', () => {
		it('reactively re-parses when props.value changes', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()

			store.props.set({value: 'world'})

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'world', position: {start: 0, end: 5}},
			])
			expect(store.feature.value.previousValue()).toBe('world')

			store.feature.parsing.disable()
		})

		it('does not re-parse in recovery mode when props.value changes', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()

			store.feature.caret.recovery({caret: 0, anchor: store.nodes.focus})
			store.props.set({value: 'world'})

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'hello', position: {start: 0, end: 5}},
			])

			store.feature.parsing.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'test'})
			store.feature.parsing.sync()

			store.feature.caret.recovery({caret: 0, anchor: store.nodes.focus})
			store.feature.parsing.emit.reparse()

			expect(store.feature.parsing.state.tokens()).toEqual([
				{type: 'text', content: 'test', position: {start: 0, end: 4}},
			])
			expect(store.feature.value.previousValue()).toBe('test')

			store.feature.parsing.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.feature.parsing.enable()
			store.props.set({value: 'hello'})
			store.feature.parsing.sync()
			store.feature.caret.recovery({caret: 0, anchor: store.nodes.focus})

			let callCount = 0
			const original = store.feature.parsing.state.tokens
			const tokensWrapper = (...args: unknown[]) => {
				if (args.length) callCount++
				return (original as (...args: unknown[]) => unknown)(...args)
			}
			;(store.feature.parsing.state as Record<string, unknown>).tokens = tokensWrapper

			store.feature.parsing.emit.reparse()
			expect(callCount).toBe(1)

			callCount = 0
			store.feature.caret.recovery({caret: 1, anchor: store.nodes.focus})
			expect(callCount).toBe(0)

			;(store.feature.parsing.state as Record<string, unknown>).tokens = original
			store.feature.parsing.disable()
		})
	})
})