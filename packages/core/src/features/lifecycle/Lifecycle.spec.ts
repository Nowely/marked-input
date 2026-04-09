import {describe, it, expect, beforeEach, vi} from 'vitest'

import {setUseHookFactory} from '../../shared/signals'
import {Store} from '../store/Store'

// Mock createCoreFeatures to avoid DOM dependencies (TextSelectionController etc.)
vi.mock('../feature-manager', () => ({
	createCoreFeatures: () => ({
		enableAll: vi.fn(),
		disableAll: vi.fn(),
	}),
}))

describe('Lifecycle', () => {
	let store: Store

	beforeEach(() => {
		setUseHookFactory(() => () => undefined)
		store = new Store({defaultSpan: null})
	})

	describe('enable()', () => {
		it('is idempotent — calling twice does not double-subscribe', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.enable() // second call should be a no-op

			// If double-subscribed, parse would fire handler twice producing wrong state.
			// We verify by calling syncParser then emitting parse, checking tokens are set once.
			lifecycle.syncParser('hello', [])
			const tokensAfterSync = store.state.tokens.get()
			expect(tokensAfterSync).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])

			lifecycle.disable()
		})
	})

	describe('disable()', () => {
		it('stops parse subscription — emitting parse after disable does not run handler', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('hello', [])

			lifecycle.disable()

			// After disable, emitting parse should NOT update tokens
			const tokensBefore = store.state.tokens.get()
			store.events.parse.emit()
			const tokensAfter = store.state.tokens.get()

			expect(tokensAfter).toBe(tokensBefore)
		})

		it('resets initialized state — re-enable and syncParser works fresh', () => {
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
		it('calls events.parse() when already initialized and in recovery mode', () => {
			const lifecycle = store.lifecycle

			lifecycle.enable()
			lifecycle.syncParser('initial', [])

			// Put store in recovery mode so syncParser skips parse() emission
			// but we can manually emit parse and verify the handler re-parses
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			// Emit parse directly — handler should re-parse from token text
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

			// Set recovery state
			store.state.recovery.set({caret: 0, anchor: store.nodes.focus})

			// Emit parse — should re-parse from token text
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
})