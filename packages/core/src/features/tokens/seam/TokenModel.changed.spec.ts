import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {anchorsAt} from '../__testing__/mountFixtures'

/** Inline fixture (from TokenModel.facade.spec.ts): text 'he' [0,2], mark '@[x]' [2,6], text 'llo' [6,9]. */
function mountWithMark(beforeMount?: (store: Store) => void) {
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
	beforeMount?.(store)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

/** Stable identity of the token at a top-level index, read through its live handle. */
function handleId(store: Store, index: number): number {
	const handle = store.tokens.handle(store.tokens.current()[index].id!)
	if (!handle) throw new Error(`expected a handle at [${index}]`)
	return handle.id
}

describe('TokenModel changed event', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('the first bind announces full and handles carry distinct stable ids', () => {
		const changedSpy = vi.fn()
		const {store} = mountWithMark(s => watch(s.tokens.changed, changedSpy))

		// Mount binds the pre-built DOM immediately and announces the cold start,
		// then the explicit rendered() re-binds idempotently — two announcements
		// (the count is the contract here; the payload is pinned in the cases below).
		expect(changedSpy).toHaveBeenCalledTimes(2)

		const ids = store.tokens.current().map((_, i) => handleId(store, i))
		expect(ids).toHaveLength(3)
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
		// stable across repeated reads
		expect(store.tokens.current().map((_, i) => handleId(store, i))).toEqual(ids)
	})

	it('edit.replace fires changed once and the edited token’s handle identity survives', () => {
		const {store} = mountWithMark()
		const markId = handleId(store, 1)
		const tailId = handleId(store, 2)
		const changedSpy = vi.fn()
		watch(store.tokens.changed, changedSpy)

		// append '!' at the end of the trailing text: 'he@[x]llo' → 'he@[x]llo!'
		store.edit.replace(...anchorsAt(store, 9, 9), '!')

		// One announcement per commit, carrying the delta (spec §2.3): a pure text
		// edit reports the edited token as updated and adds/removes nothing.
		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy.mock.lastCall?.[0]).toEqual({added: [], removed: [], updated: [tailId]})
		// identity survives the edit: the same handles answer for the new tree
		expect(handleId(store, 1)).toBe(markId)
		expect(handleId(store, 2)).toBe(tailId)
	})

	it('edit.replace before the mark flows the precise hint: suffix tokens shifted, ids stable', () => {
		const {store} = mountWithMark()
		const headId = handleId(store, 0)
		const markId = handleId(store, 1)
		const tailId = handleId(store, 2)
		const changedSpy = vi.fn()
		watch(store.tokens.changed, changedSpy)

		// prepend 'X' at position 0: mark and tail shift right by 1
		store.edit.replace(...anchorsAt(store, 0, 0), 'X')

		// One announcement; only the head's CONTENT changed. A pure position shift
		// is not a content change, so the mark and tail are in no list — their
		// contract (the ids survive) is the handle-identity survival asserted below.
		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy.mock.lastCall?.[0]).toEqual({added: [], removed: [], updated: [headId]})
		expect(handleId(store, 1)).toBe(markId)
		expect(handleId(store, 2)).toBe(tailId)
	})

	// Direct value sets carry no edit hint; the identity tracker derives the
	// changed window via findGap, so the announcement is a precise 'delta'
	// (only the very first bind reports 'full') and token identity survives.
	it('direct value.current set keeps identity via the findGap-derived hint and announces delta', () => {
		const {store} = mountWithMark()
		const markId = handleId(store, 1)
		const tailId = handleId(store, 2)
		const changedSpy = vi.fn()
		watch(store.tokens.changed, changedSpy)

		store.tokens.replace({start: 0, end: -1}, 'he@[x]llo!')

		expect(changedSpy).toHaveBeenCalledTimes(1)
		expect(changedSpy.mock.lastCall?.[0]).toEqual({added: [], removed: [], updated: [tailId]})
		// the mark id survived a set that carried no edit hint
		expect(handleId(store, 1)).toBe(markId)
	})
})

// ---------------------------------------------------------------------------
// Render-count gates (design-spec headline numbers, against tree/changed)
// ---------------------------------------------------------------------------

describe('render-count gates: text edits bypass the renderer, structural edits invoke it', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('3 text edits → renderTree watcher 0 / changed 3; structural edit → renderTree watcher 1, completed by rendered()', () => {
		const {store, container} = mountWithMark()

		// A watch on renderTree pulls the signal every flush wave; its callback only
		// fires when the value differs (equality cutoff) — exactly the adapters'
		// subscription semantics (useSyncExternalStore / shallowRef).
		const treeSpy = vi.fn()
		watch(store.tokens.renderTree, treeSpy)
		const changedSpy = vi.fn()
		watch(store.tokens.changed, changedSpy)

		// Three consecutive tail text edits — the adapter never re-renders
		// (rendered() is deliberately not called): 'llo' → 'llo!' → 'llo!!' → 'llo!!!'
		store.edit.replace(...anchorsAt(store, 9, 9), '!')
		store.edit.replace(...anchorsAt(store, 10, 10), '!')
		store.edit.replace(...anchorsAt(store, 11, 11), '!')

		// Gate: text edit → 0 committed renderer invocations…
		expect(treeSpy).toHaveBeenCalledTimes(0)
		// …while every edit still committed through the patch branch.
		expect(changedSpy).toHaveBeenCalledTimes(3)
		// And the DOM was patched without the renderer.
		expect(container.children[2].textContent).toBe('llo!!!')

		// One structural edit: 'he@[x]llo!!!' → 'he@[x]llo!!!@[y]' (added tokens).
		store.edit.replace(...anchorsAt(store, 12, 12), '@[y]')

		// Gate: structural edit → ≥1 renderer invocation (renderTree reference changed).
		expect(treeSpy).toHaveBeenCalledTimes(1)
		// The renderer owns this change: consistency is not announced yet.
		expect(changedSpy).toHaveBeenCalledTimes(3)

		// The (manual) adapter re-renders from the new tree and reports back.
		container.replaceChildren(
			...store.tokens.current().map(token => {
				const span = document.createElement('span')
				if (token.type === 'mark') span.append(document.createTextNode(token.value))
				return span
			})
		)
		store.host.rendered()

		// The bind completes the structural flow — exactly one more consistency
		// announcement, and no further renderer invalidation.
		expect(changedSpy).toHaveBeenCalledTimes(4)
		expect(treeSpy).toHaveBeenCalledTimes(1)
	})
})