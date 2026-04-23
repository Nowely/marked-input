import {describe, it, expect, beforeEach, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ParsingFeature', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		const features: Record<string, {enable(): void; disable(): void}> = {
			lifecycle: store.lifecycle,
			value: store.value,
			mark: store.mark,
			overlay: store.overlay,
			slots: store.slots,
			caret: store.caret,
			keyboard: store.keyboard,
			dom: store.dom,
			drag: store.drag,
			clipboard: store.clipboard,
		}
		for (const key of Object.keys(features)) {
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('sync()', () => {
		it('sets tokens from value signal', () => {
			store.parsing.enable()
			store.props.set({value: 'hello'})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.parsing.disable()
		})

		it('falls back to defaultValue when value is undefined', () => {
			store.parsing.enable()
			store.props.set({defaultValue: 'default'})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])

			store.parsing.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.parsing.enable()
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])

			store.parsing.disable()
		})

		it('sets previousValue to the parsed input', () => {
			store.parsing.enable()
			store.props.set({value: 'test'})
			store.parsing.sync()

			expect(store.value.previousValue()).toBe('test')

			store.parsing.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.parsing.enable()
			store.props.set({options: [{markup: '@[__value__]'}], value: '@hello'})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeUndefined()
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '@hello', position: {start: 0, end: 6}}])

			store.parsing.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.parsing.enable()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}], value: '@hello'})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeDefined()

			store.parsing.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.parsing.enable()
			store.parsing.enable()
			store.props.set({value: 'hello'})
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
			store.parsing.disable()
		})

		it('stops parse subscription after disable', () => {
			store.parsing.enable()
			store.props.set({value: 'hello'})
			store.parsing.sync()

			store.parsing.disable()

			const tokensBefore = store.parsing.tokens()
			store.parsing.reparse()
			expect(store.parsing.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.parsing.enable()
			store.props.set({value: 'first'})
			store.parsing.sync()
			store.parsing.disable()

			store.parsing.enable()
			store.props.set({value: 'second'})
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.parsing.disable()
		})
	})

	describe('reactive parse', () => {
		it('reactively re-parses when props.value changes', () => {
			store.parsing.enable()
			store.props.set({value: 'hello'})
			store.parsing.sync()

			store.props.set({value: 'world'})

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
			expect(store.value.previousValue()).toBe('world')

			store.parsing.disable()
		})

		it('does not re-parse in recovery mode when props.value changes', () => {
			store.parsing.enable()
			store.props.set({value: 'hello'})
			store.parsing.sync()

			store.caret.recovery({caret: 0, anchor: store.nodes.focus})
			store.props.set({value: 'world'})

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.parsing.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.parsing.enable()
			store.props.set({value: 'test'})
			store.parsing.sync()

			store.caret.recovery({caret: 0, anchor: store.nodes.focus})
			store.parsing.reparse()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.value.previousValue()).toBe('test')

			store.parsing.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.parsing.enable()
			store.props.set({value: 'hello'})
			store.parsing.sync()
			store.caret.recovery({caret: 0, anchor: store.nodes.focus})

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
			store.caret.recovery({caret: 1, anchor: store.nodes.focus})
			expect(callCount).toBe(0)

			// oxlint-disable-next-line no-unsafe-type-assertion -- test spy restore
			;(store.parsing as unknown as Record<string, unknown>).tokens = original
			store.parsing.disable()
		})
	})
})