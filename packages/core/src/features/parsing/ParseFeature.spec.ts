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
		it('sets tokens from current value', () => {
			store.value.current('hello')
			store.parsing.enable()
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.parsing.disable()
		})

		it('sets tokens from explicit value', () => {
			store.parsing.enable()
			store.parsing.sync('default')

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])

			store.parsing.disable()
		})

		it('falls back to empty string when both are undefined', () => {
			store.parsing.enable()
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '', position: {start: 0, end: 0}}])

			store.parsing.disable()
		})

		it('does not write value state', () => {
			store.parsing.enable()
			store.parsing.sync('test')

			expect(store.value.current()).toBe('')

			store.parsing.disable()
		})

		it('skips markup when no Mark override and no per-option Mark', () => {
			store.value.current('@hello')
			store.parsing.enable()
			store.props.set({options: [{markup: '@[__value__]'}]})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeUndefined()
			expect(store.parsing.tokens()).toEqual([{type: 'text', content: '@hello', position: {start: 0, end: 6}}])

			store.parsing.disable()
		})

		it('uses markup when Mark override is set', () => {
			store.value.current('@hello')
			store.parsing.enable()
			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
			store.parsing.sync()

			expect(store.parsing.parser()).toBeDefined()

			store.parsing.disable()
		})
	})

	describe('enable() / disable()', () => {
		it('is idempotent — calling enable twice does not double-subscribe', () => {
			store.value.current('hello')
			store.parsing.enable()
			store.parsing.enable()
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
			store.value.current('hello')
			store.parsing.enable()
			store.parsing.sync()

			store.parsing.disable()

			const tokensBefore = store.parsing.tokens()
			store.parsing.reparse()
			expect(store.parsing.tokens()).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and sync works fresh', () => {
			store.value.current('first')
			store.parsing.enable()
			store.parsing.sync()
			store.parsing.disable()

			store.value.current('second')
			store.parsing.enable()
			store.parsing.sync()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.parsing.disable()
		})
	})

	describe('reactive parse', () => {
		it('does not react when only ParsingFeature is enabled and props.value changes', () => {
			store.value.current('hello')
			store.parsing.enable()
			store.parsing.sync()

			store.props.set({value: 'world'})

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.parsing.disable()
		})

		it('re-parses from current value when parser changes and focus has stale content', () => {
			store.value.current('hello @[world]')
			store.parsing.enable()
			store.parsing.sync()
			const container = document.createElement('div')
			const target = document.createElement('span')
			target.textContent = 'stale @[ui]'
			container.append(target)
			store.nodes.focus.target = target

			store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})

			expect(store.parsing.tokens()).toEqual([
				expect.objectContaining({type: 'text', content: 'hello '}),
				expect.objectContaining({type: 'mark', content: '@[world]', value: 'world'}),
				expect.objectContaining({type: 'text', content: ''}),
			])

			store.parsing.disable()
		})
	})

	describe('parse handler', () => {
		it('in recovery mode — re-parses from token text', () => {
			store.value.current('test')
			store.parsing.enable()
			store.parsing.sync()

			store.caret.recovery({caret: 0, anchor: store.nodes.focus})
			store.parsing.reparse()

			expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.value.current()).toBe('test')

			store.parsing.disable()
		})

		it('does not re-run parse subscription when recovery changes after parse event', () => {
			store.value.current('hello')
			store.parsing.enable()
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