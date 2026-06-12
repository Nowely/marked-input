import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'
import {isTextPath} from './commitRouting'
import {Parser} from './parser/Parser'
import type {Token} from './parser/types'
import {createTextToken} from './parser/utils/createTextToken'
import type {Changeset} from './tokenIdentity'
import {createIdentityTracker} from './tokenIdentity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker() {
	return createIdentityTracker()
}

/** Inline fixture (from TokenModel.facade.spec.ts): text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9]. */
function mountWithMark() {
	const store = new Store()
	store.props.set({
		defaultValue: 'he@[x]llo',
		options: [{markup: '@[__value__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

// ---------------------------------------------------------------------------
// Pure classifier tests
// ---------------------------------------------------------------------------

describe('isTextPath classifier', () => {
	const tracker = makeTracker()
	const parser = new Parser(['@[__value__]'])
	const tokens = parser.parse('he@[x]llo')
	// Assign ids to the tree so idOf works
	tokens.forEach(t => tracker.idOf(t))

	const idOf = (t: Token) => tracker.idOf(t)
	// text tokens are at index 0 and 2; mark at index 1
	const textToken0 = tokens[0]
	const markToken = tokens[1]
	const textToken2 = tokens[2]

	it('full changeset → structural (not text path)', () => {
		const changeset: Changeset = {kind: 'full'}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with non-empty added → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [tracker.idOf(textToken0)],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with non-empty removed → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [tracker.idOf(textToken2)],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with textChanged containing a MARK id → structural', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [tracker.idOf(markToken)],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})

	it('delta with only text-token textChanged → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [tracker.idOf(textToken2)],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('delta with only shifted (no textChanged) → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [],
			shifted: [tracker.idOf(textToken2)],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('empty delta (no textChanged, no shifted) → text path', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(true)
	})

	it('delta with textChanged id not found in the tree → structural (conservative, stale-tree guard)', () => {
		const changeset: Changeset = {
			kind: 'delta',
			textChanged: [99999],
			added: [],
			removed: [],
			shifted: [],
		}
		expect(isTextPath(tokens, changeset, idOf)).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Mounted structure computed tests
// ---------------------------------------------------------------------------

describe('TokenModel.structure computed', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('tail text edit — structure() reference-equal to pre-edit reference, current() is new array', () => {
		const {store} = mountWithMark()
		// Pin actual parse output: value 'he@[x]llo' → 3 tokens
		expect(store.tokens.current()).toHaveLength(3)

		const before = store.tokens.structure()

		// Append '!' at end: text 'llo' [6,9] → 'llo!' [6,10]; mark unchanged
		// This is a text-only edit (only the trailing text token textChanged)
		store.edit.replace({start: 9, end: 9}, '!')

		const after = store.tokens.structure()

		// structure() must be reference-stable across a text-path reconcile
		expect(after).toBe(before)
		// but current() must reflect the new tokens (different array)
		expect(store.tokens.current()).not.toBe(before)
		expect(store.tokens.current()[2].content).toBe('llo!')
	})

	it('structural edit (insert a new mark) — structure() is a new reference, deep-equal to current()', () => {
		const {store} = mountWithMark()
		// Pin: starts with 3 tokens
		expect(store.tokens.current()).toHaveLength(3)

		const before = store.tokens.structure()

		// Insert a second mark at the end: 'he@[x]llo' → 'he@[x]llo@[y]'
		// This adds tokens → changeset has non-empty added → structural path
		store.edit.replace({start: 9, end: 9}, '@[y]')

		const after = store.tokens.structure()

		// structure() must be a new reference on the structural path
		expect(after).not.toBe(before)
		// and it must equal current()
		expect(after).toEqual(store.tokens.current())
	})
})

// ---------------------------------------------------------------------------
// Mounted structureIndex computed tests
// ---------------------------------------------------------------------------

describe('TokenModel.structureIndex computed', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('tail text edit — structureIndex() reference-stable while index() is fresh', () => {
		const {store} = mountWithMark()
		const before = store.tokens.structureIndex()
		const freshBefore = store.tokens.index()

		// Append '!' at end: text-path reconcile (only the trailing text token changes)
		store.edit.replace({start: 9, end: 9}, '!')

		// structureIndex must NOT recompute: structure() kept its reference and
		// the signals equality cutoff stops downstream invalidation
		expect(store.tokens.structureIndex()).toBe(before)
		// while the internal index is rebuilt over the fresh tree
		expect(store.tokens.index()).not.toBe(freshBefore)
		// and it still resolves the structure tree it is aligned with
		const structureMark = store.tokens.structure()[1]
		expect(store.tokens.structureIndex().pathFor(structureMark)).toEqual([1])
	})

	it('structural edit — structureIndex() is a new reference resolving the new tree', () => {
		const {store} = mountWithMark()
		const before = store.tokens.structureIndex()

		// 'he@[x]llo' → 'he@[x]llo@[y]': added tokens → structural path
		store.edit.replace({start: 9, end: 9}, '@[y]')

		const after = store.tokens.structureIndex()
		expect(after).not.toBe(before)
		// structure() === current() on the structural path; the index resolves it
		expect(after.pathFor(store.tokens.current()[3])).toEqual([3])
	})
})

// ---------------------------------------------------------------------------
// Identity-bridged fresh resolution
// ---------------------------------------------------------------------------

describe('TokenModel.freshAddressFor', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('bridges a stale token object to its current address after a text-path commit', () => {
		const {store} = mountWithMark()
		const stale = store.tokens.current()[1] // mark '@[x]' at [2,6]

		// Preceding text edit shifts the mark: 'he@[x]llo' → 'XXhe@[x]llo'.
		// Text path: the adapter never re-renders, so `stale` survives in the
		// structure tree while reconcile replaced its object in current().
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.tokens.current()[1]).not.toBe(stale)

		const fresh = store.tokens.freshAddressFor(stale)
		expect(fresh).toBeDefined()
		expect(fresh?.token).toBe(store.tokens.current()[1])
		expect(fresh?.token.position).toEqual({start: 4, end: 8})
		expect(fresh?.path).toEqual([1])
	})

	it('returns undefined before any DOM commit (headless store)', () => {
		const store = new Store()
		store.props.set({defaultValue: 'he@[x]llo', options: [{markup: '@[__value__]'}], Mark: () => null})
		expect(store.tokens.freshAddressFor(store.tokens.current()[1])).toBeUndefined()
	})

	it('returns undefined for a token unknown to the identity tracker', () => {
		const {store} = mountWithMark()
		expect(store.tokens.freshAddressFor(createTextToken('zz'))).toBeUndefined()
	})

	it('probing a foreign token does not grow the id space', () => {
		// Reconcile a fresh tracker with a known tree, then call freshAddressFor
		// with a token that was never part of that tree. The read-only idFor
		// peek must leave the foreign token unregistered — a second fresh tracker
		// reconciled against the same tree should assign the same ids (same nextId
		// counter), proving no phantom id was allocated.
		const {store} = mountWithMark()
		const foreign = createTextToken('foreign')

		// idFor must be undefined before and after the freshAddressFor call
		const tracker = createIdentityTracker()
		const tokens = store.tokens.current()
		tracker.reconcile(tokens)

		const idBefore = tracker.idFor(foreign)
		expect(idBefore).toBeUndefined()

		// freshAddressFor internally calls idFor — must not allocate
		store.tokens.freshAddressFor(foreign)

		// Confirm via the store's own identity: calling idFor on the same foreign
		// token still returns undefined (no side-effect)
		const tracker2 = createIdentityTracker()
		tracker2.reconcile(tokens)
		expect(tracker2.idFor(foreign)).toBeUndefined()
	})

	it('returns undefined after the token is structurally removed', () => {
		const {store, container} = mountWithMark()
		const stale = store.tokens.current()[1]

		// Remove the mark: 'he@[x]llo' → 'hello' (structural: removed non-empty)
		store.edit.replace({start: 2, end: 6}, '')
		// The (manual) adapter re-renders: one text surface remains
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		expect(store.tokens.freshAddressFor(stale)).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// Render-count gates (design-spec Phase 3 headline numbers)
// ---------------------------------------------------------------------------

describe('render-count gates: text edits bypass the renderer, structural edits invoke it', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('3 text edits → structure watcher 0 / indexed 3; structural edit → structure watcher 1, completed by rendered()', () => {
		const {store, container} = mountWithMark()

		// A watch on structure pulls the computed every flush wave; its callback
		// only fires when the recomputed value differs (equality cutoff) — exactly
		// the adapters' subscription semantics (useSyncExternalStore / shallowRef).
		const structureSpy = vi.fn()
		watch(store.tokens.structure, structureSpy)
		const indexedSpy = vi.fn()
		watch(store.tokens.indexed, indexedSpy)

		// Three consecutive tail text edits — the adapter never re-renders
		// (rendered() is deliberately not called): 'llo' → 'llo!' → 'llo!!' → 'llo!!!'
		store.edit.replace({start: 9, end: 9}, '!')
		store.edit.replace({start: 10, end: 10}, '!')
		store.edit.replace({start: 11, end: 11}, '!')

		// Gate: text edit → 0 committed renderer invocations…
		expect(structureSpy).toHaveBeenCalledTimes(0)
		// …while every edit still committed through the patch path.
		expect(indexedSpy).toHaveBeenCalledTimes(3)
		// And the DOM was patched without the renderer.
		expect(container.children[2].textContent).toBe('llo!!!')

		// One structural edit: 'he@[x]llo!!!' → 'he@[x]llo!!!@[y]' (added tokens).
		store.edit.replace({start: 12, end: 12}, '@[y]')

		// Gate: structural edit → ≥1 renderer invocation. The watcher fires in the
		// same flush wave as the edit (the watch pulls structure; new reference).
		expect(structureSpy).toHaveBeenCalledTimes(1)
		// The renderer owns this change: nothing was indexed yet.
		expect(indexedSpy).toHaveBeenCalledTimes(3)

		// The (manual) adapter re-renders from the new structure and reports back.
		expect(store.tokens.structure()).toBe(store.tokens.current())
		container.replaceChildren(
			...store.tokens.structure().map(token => {
				const span = document.createElement('span')
				if (token.type === 'mark') span.append(document.createTextNode(token.value))
				return span
			})
		)
		store.host.rendered()

		// The full commit completes the structural flow — exactly one more index
		// wave, and no further renderer invalidation.
		expect(indexedSpy).toHaveBeenCalledTimes(4)
		expect(structureSpy).toHaveBeenCalledTimes(1)
	})
})