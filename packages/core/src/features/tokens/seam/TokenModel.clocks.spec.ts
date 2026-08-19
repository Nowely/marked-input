import {afterEach, describe, expect, it, vi} from 'vitest'

import {watch} from '../../../shared/signals/index.js'
import {Store} from '../../../store/Store'
import {anchorsAt, consignRendered, enableStructuralStore, mountInline} from '../__testing__/mountFixtures'

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
	consignRendered(store, container)
	store.host.rendered()
	return {store, container}
}

/** Stable identity of the token at a top-level index, read through its live handle. */
function handleId(store: Store, index: number): number {
	const handle = store.tokens.handle(store.tokens.nodes()[index].id!)
	if (!handle) throw new Error(`expected a handle at [${index}]`)
	return handle.id
}

describe('TokenModel commit clocks', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('mount pulses committed once and bound once per bind, and handles carry distinct stable ids', () => {
		const committedSpy = vi.fn()
		const boundSpy = vi.fn()
		const {store} = mountWithMark(s => {
			watch(s.tokens.committed, committedSpy)
			watch(s.tokens.bound, boundSpy)
		})

		// Both clocks, because mount is the one place their counts differ by construction:
		// attaching the container is ONE arrival and one commit, while `onMounted` binds
		// immediately (against a DOM nothing is consigned into yet) and the explicit
		// `rendered()` after consignment binds a second time.
		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(2)

		const ids = store.tokens.nodes().map((_, i) => handleId(store, i))
		expect(ids).toHaveLength(3)
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
		// stable across repeated reads
		expect(store.tokens.nodes().map((_, i) => handleId(store, i))).toEqual(ids)
	})

	it('edit.replace pulses committed once and the edited token’s handle identity survives', () => {
		const {store} = mountWithMark()
		const markId = handleId(store, 1)
		const tailId = handleId(store, 2)
		// `committed`, not `bound`: the subject is the commit and the ids it kept, and a
		// text-only edit reaches the DOM off the per-surface effect without a bind at all.
		const committedSpy = vi.fn()
		watch(store.tokens.committed, committedSpy)
		const boundSpy = vi.fn()
		watch(store.tokens.bound, boundSpy)

		// append '!' at the end of the trailing text: 'he@[x]llo' → 'he@[x]llo!'
		store.edit.replace(...anchorsAt(store, 9, 9), '!')

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(boundSpy).toHaveBeenCalledTimes(0)
		// identity survives the edit: the same handles answer for the new tree
		expect(handleId(store, 1)).toBe(markId)
		expect(handleId(store, 2)).toBe(tailId)
	})

	it('edit.replace before the mark shifts the suffix and keeps its ids', () => {
		const {store} = mountWithMark()
		const markId = handleId(store, 1)
		const tailId = handleId(store, 2)
		const committedSpy = vi.fn()
		watch(store.tokens.committed, committedSpy)

		// prepend 'X' at position 0: mark and tail shift right by 1
		store.edit.replace(...anchorsAt(store, 0, 0), 'X')

		expect(committedSpy).toHaveBeenCalledTimes(1)
		// A pure position shift is not a content change and must not re-mint identity.
		expect(handleId(store, 1)).toBe(markId)
		expect(handleId(store, 2)).toBe(tailId)
	})

	// Direct value sets carry no edit hint; the identity tracker derives the changed
	// window via findGap, so token identity survives a set the same way it survives an edit.
	it('direct value set keeps identity via the findGap-derived hint and pulses committed once', () => {
		const {store} = mountWithMark()
		const markId = handleId(store, 1)
		const committedSpy = vi.fn()
		watch(store.tokens.committed, committedSpy)

		store.tokens.setValue('he@[x]llo!')

		expect(committedSpy).toHaveBeenCalledTimes(1)
		// the mark id survived a set that carried no edit hint
		expect(handleId(store, 1)).toBe(markId)
	})
})

// ---------------------------------------------------------------------------
// The (value, parser, isBlock) tuple watch
// ---------------------------------------------------------------------------

describe('one watch over the props tuple', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('a simultaneous value+parser change is ONE wave: exactly one committed pulse', () => {
		// MARK-FREE on purpose: a commit whose `updated` holds a mark sets the render bit and so
		// drags a bind in behind it, and the value assertions below would then be reading a
		// re-rendered fixture this file does not build. With one text token the commit is the
		// whole of the wave.
		const {store, textSurface} = mountInline(
			enableStructuralStore('hello', {Mark: () => null, options: [{markup: '@[__value__]'}]})
		)
		const committedSpy = vi.fn()
		watch(store.tokens.committed, committedSpy)

		// props.set writes both signals inside ONE batch, and the model watches the tuple, so
		// the pair is one arrival and one commit. Measured on a probe that split the tuple into
		// a watch per prop: the value arrival commits, then the parser watch's reparse commits
		// again — 2 pulses.
		store.props.set({value: 'hello!', options: [{markup: '@[__value__]'}]})

		expect(committedSpy).toHaveBeenCalledTimes(1)
		expect(store.tokens.value()).toBe('hello!')
		expect(textSurface.textContent).toBe('hello!')
	})
})

// ---------------------------------------------------------------------------
// Render-count gates (design-spec headline numbers, against tree/committed)
// ---------------------------------------------------------------------------

describe('render-count gates: text edits bypass the renderer, structural edits invoke it', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	it('3 text edits → renderEpoch watcher 0 / committed 3 / bound 0; a structural edit moves the epoch and only rendered() pulses bound', () => {
		const {store, container} = mountWithMark()

		// A watch on renderEpoch pulls the signal every flush wave; its callback only
		// fires when the value differs (equality cutoff) — exactly the adapters'
		// subscription semantics (useSyncExternalStore / shallowRef).
		const treeSpy = vi.fn()
		watch(store.tokens.renderEpoch, treeSpy)
		// Both clocks: the gate is the DIFFERENCE between them. `committed` counts commits
		// whatever the DOM does; `bound` counts binds and so stays flat until the adapter paints.
		const committedSpy = vi.fn()
		watch(store.tokens.committed, committedSpy)
		const boundSpy = vi.fn()
		watch(store.tokens.bound, boundSpy)

		// Three consecutive tail text edits — the adapter never re-renders
		// (rendered() is deliberately not called): 'llo' → 'llo!' → 'llo!!' → 'llo!!!'
		store.edit.replace(...anchorsAt(store, 9, 9), '!')
		store.edit.replace(...anchorsAt(store, 10, 10), '!')
		store.edit.replace(...anchorsAt(store, 11, 11), '!')

		// Gate: text edit → 0 committed renderer invocations…
		expect(treeSpy).toHaveBeenCalledTimes(0)
		// …while every edit still committed, and none of them bound.
		expect(committedSpy).toHaveBeenCalledTimes(3)
		expect(boundSpy).toHaveBeenCalledTimes(0)
		// And the DOM was patched without the renderer.
		expect(container.children[2].textContent).toBe('llo!!!')

		// One structural edit: 'he@[x]llo!!!' → 'he@[x]llo!!!@[y]' (added tokens).
		store.edit.replace(...anchorsAt(store, 12, 12), '@[y]')

		// Gate: structural edit → ≥1 renderer invocation (the epoch moved).
		expect(treeSpy).toHaveBeenCalledTimes(1)
		// The commit is a commit whether or not the renderer has run, so the model clock
		// pulses here; the DOM clock cannot, because no element for '@[y]' exists yet.
		expect(committedSpy).toHaveBeenCalledTimes(4)
		expect(boundSpy).toHaveBeenCalledTimes(0)

		// The (manual) adapter re-renders from the new tree, consigns the fresh elements and
		// reports back. Re-consigning is the whole of the adapter's side: without it bind
		// would keep the elements this replaceChildren just detached.
		container.replaceChildren(
			...store.tokens.nodes().map(node => {
				const span = document.createElement('span')
				if (node.kind === 'mark') span.append(document.createTextNode(node.value()))
				return span
			})
		)
		consignRendered(store, container)
		store.host.rendered()

		// The bind is the second pulse of the SAME commit, on the other clock — no extra
		// commit, and no further renderer invalidation.
		expect(boundSpy).toHaveBeenCalledTimes(1)
		expect(committedSpy).toHaveBeenCalledTimes(4)
		expect(treeSpy).toHaveBeenCalledTimes(1)
	})
})