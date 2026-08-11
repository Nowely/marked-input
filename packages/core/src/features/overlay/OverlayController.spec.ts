import {describe, it, expect, beforeEach, vi} from 'vitest'

import type {OverlayMatch} from '../../shared/types'
import {Store} from '../../store/Store'
import {anchorsAt, caretAt} from '../tokens/__testing__/mountFixtures'

/**
 * A store with a caret, which the shared fixture below deliberately has not: the probe is
 * MODEL-ONLY, so `selection.anchors()` is its whole input and a store with no selection can
 * only ever answer `undefined`. `controlled` wires the echoing parent — `onChange` back into
 * `value` on a microtask, the way a framework's state update lands.
 */
function storeWithCaret(value: string, offset: number, controlled = false) {
	const store = new Store()
	store.props.set({
		[controlled ? 'value' : 'defaultValue']: value,
		options: [{overlay: {trigger: '@'}}],
		onChange: controlled
			? (next: string) => {
					queueMicrotask(() => store.props.set({value: next}))
				}
			: undefined,
	})
	store.host.container(document.createElement('div'))
	caretAt(store, offset)
	return store
}

const stubMatch: OverlayMatch = {
	value: 'test',
	source: '@',
	span: 'test',
	// oxlint-disable-next-line no-unsafe-type-assertion -- test stub
	node: {} as unknown as Node,
	range: {anchor: 'start', head: 'start'},
	option: {},
}

describe('OverlayController', () => {
	let store: Store

	beforeEach(() => {
		store = new Store()
		store.host.container(document.createElement('div'))
	})

	describe('ownership', () => {
		it('owns match, element (DOM ref), slot (computed), choose, close', () => {
			expect(typeof store.overlay.match).toBe('function')
			expect(typeof store.overlay.element).toBe('function')
			expect(typeof store.overlay.slot).toBe('function')
			expect(typeof store.overlay.choose).toBe('function')
			expect(typeof store.overlay.close).toBe('function')
		})
	})

	describe('activation via overlay trigger', () => {
		it('probes overlay trigger on change when showOverlayOn includes change', () => {
			// Reset to empty first so watch sees a false->true transition
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.tokens.setValue(store.tokens.value() + ' ')

			expect(store.overlay.match()).toBeUndefined()

			store.props.set({options: []})
		})

		it('FINDS the trigger the commit just typed, uncontrolled', () => {
			const store = storeWithCaret('hello ', 6)

			store.edit.replace(...anchorsAt(store, 6, 6), '@wo')

			expect(store.overlay.match()?.source).toBe('@wo')
			expect(store.overlay.match()?.value).toBe('wo')
		})

		it('FINDS it against the caret the ECHOED commit repaired, not the previous generation', async () => {
			// THE regression: controlled + an echoing parent + the default `showOverlayOn`.
			// The probe used to run from inside adoption — new tree, previous caret — so the
			// trigger keystroke found nothing and the one after it matched '@' with an empty
			// word. Both are asserted here, positively.
			const store = storeWithCaret('hello ', 6, true)

			store.edit.replace(...anchorsAt(store, 6, 6), '@')
			await Promise.resolve()

			expect(store.overlay.match()?.source).toBe('@')
			expect(store.overlay.match()?.value).toBe('')

			store.edit.replace(...anchorsAt(store, 7, 7), 'f')
			await Promise.resolve()

			expect(store.overlay.match()?.source).toBe('@f')
			expect(store.overlay.match()?.value).toBe('f')
		})

		it('clear match when close is emitted', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})

		it('react to change event when showOverlayOn includes change', () => {
			store.props.set({options: [], showOverlayOn: 'change'})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.tokens.setValue(store.tokens.value() + ' ')

			expect(store.overlay.match()).toBeUndefined()
		})

		it('replaces a stale match with the one the new commit finds', () => {
			// The positive half of the case above: the probe does not merely clear, it answers.
			const store = storeWithCaret('hello @wo', 9)
			store.overlay.match(stubMatch)

			store.edit.replace(...anchorsAt(store, 9, 9), 'r')

			expect(store.overlay.match()?.source).toBe('@wor')
		})

		it('not react to change event when showOverlayOn does not include change', () => {
			store.props.set({options: [], showOverlayOn: 'selectionChange'})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.tokens.setValue(store.tokens.value() + ' ')

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('be idempotent — setting options twice does not double-subscribe', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			// second set is a no-op (already has overlay trigger)
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('deactivation', () => {
		it('stop reacting to events after removing overlay trigger', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			store.props.set({options: []})

			store.overlay.match(stubMatch)

			store.overlay.close()
			store.tokens.setValue(store.tokens.value() + ' ')

			expect(store.overlay.match()).toBe(stubMatch)
		})

		it('allow re-enabling after removing overlay trigger', () => {
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})
			store.props.set({options: []})
			store.props.set({options: [{overlay: {trigger: '@'}}]})

			store.overlay.match(stubMatch)

			store.overlay.close()

			expect(store.overlay.match()).toBeUndefined()
		})
	})

	describe('choose()', () => {
		it('delegates trigger replacement to the edit coordinator', () => {
			// A store of its own: the shared fixture is seeded EMPTY (its container attaches
			// before any defaultValue), so it has no text node to anchor into.
			const store = new Store()
			store.props.set({defaultValue: 'hello @wo', options: [{overlay: {trigger: '@'}}]})
			store.host.container(document.createElement('div'))
			const replace = vi.spyOn(store.edit, 'replace')
			const node = store.tokens.nodes()[0]
			if (node.kind !== 'text') throw new Error('expected a text root')
			const range = {anchor: {node, offset: 6}, head: {node, offset: 9}}
			const match: OverlayMatch = {...stubMatch, source: '@wo', range, option: {markup: '@[__value__]'}}
			store.overlay.match(match)

			store.overlay.choose('world')

			// The trigger span is handed back UNINSPECTED — the anchors that came in are the
			// anchors the write verb gets (spec S2 §4.5's `OverlayMatch.range` contract).
			expect(replace).toHaveBeenCalledWith(range.anchor, range.head, '@[world]')
			expect(store.tokens.value()).toBe('hello @[world]')
			expect(store.overlay.match()).toBeUndefined()
			store.props.set({options: []})
		})
	})
})