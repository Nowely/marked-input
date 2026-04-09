import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory, watch} from '../../shared/signals'
import {Store} from '../store/Store'

vi.mock('../feature-manager', () => ({
	createCoreFeatures: () => ({
		enableAll: vi.fn(),
		disableAll: vi.fn(),
	}),
}))

vi.mock('../parsing', () => ({
	Parser: class {
		parse(value: string) {
			return [{type: 'text', content: value, position: {start: 0, end: value.length}}]
		}
	},
	toString: (tokens: Array<{content: string}>) => tokens.map(t => t.content).join(''),
	getTokensByUI: (store: Store) => store.state.tokens.get(),
	getTokensByValue: (store: Store) => {
		const value = store.state.value.get() ?? ''
		return [{type: 'text', content: value, position: {start: 0, end: value.length}}]
	},
	parseWithParser: (_store: Store, value: string) => [
		{type: 'text', content: value, position: {start: 0, end: value.length}},
	],
}))

describe('Lifecycle', () => {
	let store: Store

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store()
	})

	describe('enable()', () => {
		it('is idempotent — calling twice does not double-subscribe', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.enable()

			lifecycle.syncParser('hello', [])

			const tokensAfterSync = store.state.tokens.get()
			expect(tokensAfterSync).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})
	})

	describe('disable()', () => {
		it('stops all subscriptions — emitting parse after disable does not run handler', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('hello', [])

			lifecycle.disable()

			const tokensBefore = store.state.tokens.get()
			store.events.parse.emit()
			const tokensAfter = store.state.tokens.get()

			expect(tokensAfter).toBe(tokensBefore)
		})

		it('resets subscriptions — re-enable and syncParser works fresh', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('first', [])
			lifecycle.disable()

			lifecycle.enable()
			lifecycle.syncParser('second', [])

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'second', position: {start: 0, end: 6}}])

			lifecycle.disable()
		})
	})

	describe('syncParser()', () => {
		it('parses value and updates tokens', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('hello world', [])

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'hello world', position: {start: 0, end: 11}},
			])

			lifecycle.disable()
		})

		it('skips parse emission when in recovery mode', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('initial', [])

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			store.events.parse.emit()

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
			lifecycle.syncParser('hello world', [])

			expect(store.state.tokens.get()).toEqual([
				{type: 'text', content: 'hello world', position: {start: 0, end: 11}},
			])

			lifecycle.disable()
		})

		it('handles recovery mode — re-parses from token text', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('test', [])

			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			store.events.parse.emit()

			const tokens = store.state.tokens.get()
			expect(tokens).toEqual([{type: 'text', content: 'test', position: {start: 0, end: 4}}])
			expect(store.state.previousValue.get()).toBe('test')

			lifecycle.disable()
		})

		it('does not re-run the parse subscription when recovery changes after a parse event', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('hello', [])
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			const setSpy = vi.spyOn(store.state.tokens, 'set')

			store.events.parse.emit()
			expect(setSpy).toHaveBeenCalledTimes(1)

			setSpy.mockClear()
			store.state.recovery.set({caret: 1, anchor: store.nodes.focus})
			expect(setSpy).not.toHaveBeenCalled()

			lifecycle.disable()
		})
	})

	describe('recoverFocus', () => {
		it('emits sync and recoverFocus events', () => {
			const lifecycle = store.lifecycle
			const syncSpy = vi.fn()
			const recoverFocusSpy = vi.fn()
			const stopSyncWatch = watch(store.events.sync, syncSpy)
			const stopRecoverWatch = watch(store.events.recoverFocus, recoverFocusSpy)

			store.state.Mark.set(() => null)

			lifecycle.recoverFocus()

			expect(syncSpy).toHaveBeenCalledTimes(1)
			expect(recoverFocusSpy).toHaveBeenCalledTimes(1)

			stopSyncWatch()
			stopRecoverWatch()
		})

		it('does not emit recoverFocus when Mark is not set', () => {
			const lifecycle = store.lifecycle
			const recoverFocusSpy = vi.fn()
			const stopWatch = watch(store.events.recoverFocus, recoverFocusSpy)

			lifecycle.recoverFocus()

			expect(recoverFocusSpy).not.toHaveBeenCalled()

			stopWatch()
		})
	})
})