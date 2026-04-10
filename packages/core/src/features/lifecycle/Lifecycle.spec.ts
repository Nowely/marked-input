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
			vi.spyOn(features[key], 'enable').mockImplementation(() => {})
			vi.spyOn(features[key], 'disable').mockImplementation(() => {})
		}
	})

	describe('enable()', () => {
		it('is idempotent — calling twice does not double-subscribe', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.enable()

			store.state.value.set('hello')
			lifecycle.syncParser()
			const tokensAfterSync = store.state.tokens.get()
			expect(tokensAfterSync).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})

		it('sets default overlayTrigger extractor', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()

			const getTrigger = store.state.overlayTrigger.get()
			expect(getTrigger).toBeDefined()

			const option = {overlay: {trigger: '@'}}
			expect(getTrigger!(option)).toBe('@')

			const optionWithoutTrigger = {overlay: {}}
			expect(getTrigger!(optionWithoutTrigger)).toBeUndefined()

			const optionWithoutOverlay = {}
			expect(getTrigger!(optionWithoutOverlay)).toBeUndefined()

			lifecycle.disable()
		})

		it('clears overlayTrigger on disable', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			expect(store.state.overlayTrigger.get()).toBeDefined()

			lifecycle.disable()
			expect(store.state.overlayTrigger.get()).toBeUndefined()
		})
	})

	describe('disable()', () => {
		it('stops parse subscription — emitting parse after disable does not run handler', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('hello')
			lifecycle.syncParser()

			lifecycle.disable()

			// After disable, emitting parse should NOT update tokens
			const tokensBefore = store.state.tokens.get()
			store.event.parse()
			const tokensAfter = store.state.tokens.get()

			expect(tokensAfter).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and syncParser works fresh', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('first')
			lifecycle.syncParser()
			lifecycle.disable()

			lifecycle.enable()
			store.state.value.set('second')
			lifecycle.syncParser()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			lifecycle.disable()
		})
	})

	describe('syncParser()', () => {
		it('derives options from store.state — reads value and options signals', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('hello')
			lifecycle.syncParser()

			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})

		it('derives effective options — skips markup when no Mark override and no per-option Mark', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.options.set([{markup: '@[__value__]'}])
			lifecycle.syncParser()

			expect(store.state.parser.get()).toBeUndefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when Mark override is set', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.Mark.set(() => null)
			store.state.options.set([{markup: '@[__value__]'}])
			lifecycle.syncParser()

			expect(store.state.parser.get()).toBeDefined()

			lifecycle.disable()
		})

		it('derives effective options — uses markup when option has per-option Mark', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.options.set([{markup: '@[__value__]', Mark: () => null} as Record<string, unknown>])
			lifecycle.syncParser()

			expect(store.state.parser.get()).toBeDefined()

			lifecycle.disable()
		})

		it('skips parse emission when in recovery mode', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('initial')
			lifecycle.syncParser()

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			store.event.parse()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'initial', position: {start: 0, end: 7}}])
			expect(store.state.previousValue.get()).toBe('initial')

			lifecycle.disable()
		})
	})

	describe('parse handler', () => {
		it('updates state.tokens when parse event fires', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('hello world')
			lifecycle.syncParser()

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'hello world', position: {start: 0, end: 11}},
			])

			lifecycle.disable()
		})

		it('handles recovery mode — re-parses from token text', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('test')
			lifecycle.syncParser()

			// Set recovery state
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			// Emit parse — should re-parse from token text
			store.event.parse()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue.get()).toBe('test')

			lifecycle.disable()
		})

		it('does not re-run the parse subscription when recovery changes after a parse event', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			store.state.value.set('hello')
			lifecycle.syncParser()
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			const setSpy = vi.spyOn(store.state.tokens, 'set')

			store.event.parse()
			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockClear()
			store.state.recovery.set({caret: 1, anchor: store.nodes.focus})
			expect(setSpy).not.toHaveBeenCalled()

			lifecycle.disable()
		})
	})

	describe('lifecycle events', () => {
		it('updated() first call triggers enable() and syncParser()', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')

			const enableSpy = vi.spyOn(lifecycle, 'enable')
			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser')

			store.event.updated()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(syncParserSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.event.unmounted()
		})

		it('updated() subsequent call with unchanged deps skips syncParser()', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')
			store.event.updated()

			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser')
			store.event.updated()

			expect(syncParserSpy).not.toHaveBeenCalled()

			store.event.unmounted()
		})

		it('updated() re-runs syncParser when value changes', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')
			store.event.updated()

			store.state.value.set('world')
			// mock to prevent parse() downstream (getTokensByValue not suitable for test env)
			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser').mockImplementation(() => {})
			store.event.updated()

			expect(syncParserSpy).toHaveBeenCalledOnce()
			syncParserSpy.mockRestore()

			store.event.unmounted()
		})

		it('updated() does not call sync or recoverFocus (committed handles those)', () => {
			store.state.Mark.set(() => null)
			store.state.value.set('hello')

			const syncSpy = vi.spyOn(store.event, 'sync')
			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.updated()

			expect(syncSpy).not.toHaveBeenCalled()
			expect(recoverFocusSpy).not.toHaveBeenCalled()

			store.event.unmounted()
		})

		it('afterTokensRendered() always calls sync', () => {
			store.event.updated()

			const syncSpy = vi.spyOn(store.event, 'sync')
			store.event.afterTokensRendered()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.event.unmounted()
		})

		it('afterTokensRendered() calls recoverFocus when Mark is set', () => {
			store.state.Mark.set(() => null)
			store.event.updated()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).toHaveBeenCalledOnce()

			store.event.unmounted()
		})

		it('afterTokensRendered() does not call recoverFocus when Mark is not set', () => {
			store.event.updated()

			const recoverFocusSpy = vi.spyOn(store.event, 'recoverFocus')
			store.event.afterTokensRendered()

			expect(recoverFocusSpy).not.toHaveBeenCalled()

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
			store.state.value.set('first')
			store.event.updated()
			store.event.unmounted()

			store.state.value.set('second')
			const enableSpy = vi.spyOn(store.lifecycle, 'enable')
			store.event.updated()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.event.unmounted()
		})
	})
})