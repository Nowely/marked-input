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
			store.on.parse.emit()
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

			store.on.parse.emit()

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
			store.on.parse.emit()

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

			store.on.parse.emit()
			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockClear()
			store.state.recovery.set({caret: 1, anchor: store.nodes.focus})
			expect(setSpy).not.toHaveBeenCalled()

			lifecycle.disable()
		})
	})

	describe('lifecycle events', () => {
		it('updated.emit() first call triggers enable() and syncParser()', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')

			const enableSpy = vi.spyOn(lifecycle, 'enable')
			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser')

			store.on.updated.emit()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(syncParserSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			store.on.unmounted.emit()
		})

		it('updated.emit() subsequent call with unchanged deps skips syncParser()', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')
			store.on.updated.emit()

			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser')
			store.on.updated.emit()

			expect(syncParserSpy).not.toHaveBeenCalled()

			store.on.unmounted.emit()
		})

		it('updated.emit() re-runs syncParser when value changes', () => {
			const lifecycle = store.lifecycle
			store.state.value.set('hello')
			store.on.updated.emit()

			store.state.value.set('world')
			// mock to prevent parse.emit() downstream (getTokensByValue not suitable for test env)
			const syncParserSpy = vi.spyOn(lifecycle, 'syncParser').mockImplementation(() => {})
			store.on.updated.emit()

			expect(syncParserSpy).toHaveBeenCalledOnce()
			syncParserSpy.mockRestore()

			store.on.unmounted.emit()
		})

		it('updated.emit() does not emit sync or recoverFocus (committed handles those)', () => {
			store.state.Mark.set(() => null)
			store.state.value.set('hello')

			const syncSpy = vi.spyOn(store.on.sync, 'emit')
			const recoverFocusSpy = vi.spyOn(store.on.recoverFocus, 'emit')
			store.on.updated.emit()

			expect(syncSpy).not.toHaveBeenCalled()
			expect(recoverFocusSpy).not.toHaveBeenCalled()

			store.on.unmounted.emit()
		})

		it('afterTokensRendered.emit() always emits sync', () => {
			store.on.updated.emit()

			const syncSpy = vi.spyOn(store.on.sync, 'emit')
			store.on.afterTokensRendered.emit()

			expect(syncSpy).toHaveBeenCalledOnce()

			store.on.unmounted.emit()
		})

		it('afterTokensRendered.emit() emits recoverFocus when Mark is set', () => {
			store.state.Mark.set(() => null)
			store.on.updated.emit()

			const recoverFocusSpy = vi.spyOn(store.on.recoverFocus, 'emit')
			store.on.afterTokensRendered.emit()

			expect(recoverFocusSpy).toHaveBeenCalledOnce()

			store.on.unmounted.emit()
		})

		it('afterTokensRendered.emit() does not emit recoverFocus when Mark is not set', () => {
			store.on.updated.emit()

			const recoverFocusSpy = vi.spyOn(store.on.recoverFocus, 'emit')
			store.on.afterTokensRendered.emit()

			expect(recoverFocusSpy).not.toHaveBeenCalled()

			store.on.unmounted.emit()
		})

		it('unmounted.emit() triggers disable()', () => {
			const lifecycle = store.lifecycle
			store.on.updated.emit()

			const disableSpy = vi.spyOn(lifecycle, 'disable')
			store.on.unmounted.emit()

			expect(disableSpy).toHaveBeenCalledOnce()
		})

		it('remount: unmounted then updated re-enables and re-syncs', () => {
			store.state.value.set('first')
			store.on.updated.emit()
			store.on.unmounted.emit()

			store.state.value.set('second')
			const enableSpy = vi.spyOn(store.lifecycle, 'enable')
			store.on.updated.emit()

			expect(enableSpy).toHaveBeenCalledOnce()
			expect(store.state.tokens.get()).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			store.on.unmounted.emit()
		})
	})
})