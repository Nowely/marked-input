import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../store/Store'

describe('Lifecycle', () => {
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

	describe('enable()', () => {
		it('is idempotent — calling twice does not double-subscribe', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.enable()

			store.state.value('hello')
			store.features.parse.sync()
			const tokensAfterSync = store.state.tokens()
			expect(tokensAfterSync).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})
	})

	describe('disable()', () => {
		it('stops parse subscription — emitting parse after disable does not run handler', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('hello')
			store.features.parse.sync()

			lifecycle.disable()

			// After disable, emitting parse should NOT update tokens
			const tokensBefore = store.state.tokens()
			store.event.parse()
			const tokensAfter = store.state.tokens()

			expect(tokensAfter).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and syncParser works fresh', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('first')
			store.features.parse.sync()
			lifecycle.disable()

			lifecycle.enable()
			store.state.value('second')
			store.features.parse.sync()

			const tokens = store.state.tokens()
			expect(tokens).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			lifecycle.disable()
		})
	})

	describe('sync via ParseFeature', () => {
		it('derives options from store.state — reads value and options signals', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('hello')
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})

		it('derives effective options — skips markup when no Mark override and no per-option Mark', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.options([{markup: '@[__value__]'}])
			store.features.parse.sync()

			expect(store.computed.parser()).toBeUndefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when Mark override is set', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.Mark(() => null)
			store.state.options([{markup: '@[__value__]'}])
			store.features.parse.sync()

			expect(store.computed.parser()).toBeDefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when option has per-option Mark', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.options([{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>])
			store.features.parse.sync()

			expect(store.computed.parser()).toBeDefined()

			lifecycle.disable()
		})

		it('skips parse emission when in recovery mode', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('initial')
			store.features.parse.sync()

			store.state.recovery({caret: 0, anchor: store.nodes.focus})

			store.event.parse()

			const tokens = store.state.tokens()
			expect(tokens).toEqual([{type: 'text', content: 'initial', position: {start: 0, end: 7}}])
			expect(store.state.previousValue()).toBe('initial')

			lifecycle.disable()
		})

		it('parser auto-updates when drag changes (computed reactivity)', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.Mark(() => null)
			store.state.options([{markup: '@[__value__]'}])
			store.state.value('hello')
			store.features.parse.sync()

			const parserBefore = store.computed.parser()
			expect(parserBefore).toBeDefined()

			store.state.drag(true)
			const parserAfter = store.computed.parser()

			expect(parserAfter).toBeDefined()
			expect(parserAfter).not.toBe(parserBefore)

			lifecycle.disable()
		})
	})

	describe('parse handler', () => {
		it('updates state.tokens when parse event fires', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('hello world')
			store.features.parse.sync()

			expect(store.state.tokens()).toEqual([
				{type: 'text', content: 'hello world', position: {start: 0, end: 11}},
			])

			lifecycle.disable()
		})

		it('handles recovery mode — re-parses from token text', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('test')
			store.features.parse.sync()

			// Set recovery state
			store.state.recovery({caret: 0, anchor: store.nodes.focus})

			// Emit parse — should re-parse from token text
			store.event.parse()

			const tokens = store.state.tokens()
			expect(tokens).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue()).toBe('test')

			lifecycle.disable()
		})

		it('does not re-run the parse subscription when recovery changes after a parse event', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value('hello')
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
			lifecycle.disable()
		})
	})

	describe('lifecycle events', () => {
		it('updated() first call triggers enable() and parse sync', () => {
			const lifecycle = store.lifecycle
			store.state.value('hello')

			const enableSpy = vi.spyOn(lifecycle, 'enable')
			const parseSyncSpy = vi.spyOn(store.features.parse, 'sync')

			store.event.updated()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(parseSyncSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.event.unmounted()
		})

		it('updated() subsequent call with unchanged deps skips parse()', () => {
			store.state.value('hello')
			store.event.updated()

			const parseSpy = vi.spyOn(store.event, 'parse')
			store.event.updated()

			expect(parseSpy).not.toHaveBeenCalled()

			store.event.unmounted()
		})

		it('updated() emits parse when value changes', () => {
			store.state.Mark(() => null)
			store.state.options([{markup: '@[__value__]'}])
			store.state.value('hello')
			store.event.updated()

			store.state.value('world')
			const parseSpy = vi.spyOn(store.event, 'parse').mockImplementation(() => {})
			store.event.updated()

			expect(parseSpy).toHaveBeenCalledOnce()
			parseSpy.mockRestore()

			store.event.unmounted()
		})

		it('updated() does not call sync or recoverFocus', () => {
			store.state.Mark(() => null)
			store.state.value('hello')

			const syncSpy = vi.spyOn(store.event, 'sync')
			store.event.updated()

			expect(syncSpy).not.toHaveBeenCalled()

			store.event.unmounted()
		})

		it('unmounted() triggers disable()', () => {
			const lifecycle = store.lifecycle
			store.event.updated()

			const disableSpy = vi.spyOn(lifecycle, 'disable')
			store.event.unmounted()

			expect(disableSpy).toHaveBeenCalledOnce()
		})

		it('remount: unmounted then updated re-enables and re-syncs', () => {
			store.state.value('first')
			store.event.updated()
			store.event.unmounted()

			store.state.value('second')
			const enableSpy = vi.spyOn(store.lifecycle, 'enable')
			store.event.updated()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.event.unmounted()
		})
	})
})