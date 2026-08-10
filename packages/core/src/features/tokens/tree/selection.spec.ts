import {describe, expect, it, vi} from 'vitest'

import {Store} from '../../../store/Store'
import {anchorsAt, enableStructuralStore, mountInline} from '../__testing__/mountFixtures'
import {Parser} from '../parser/Parser'
import {anchorAt, offsetOfAnchor} from './anchors'
import {createSelection} from './selection'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__]'])

/**
 * The unit as spec S2 AC-5.1 reads it: `createSelection` over a tree built straight from
 * the parser — no `Store`, no host, no DOM. The three closures are the ones
 * `SelectionController` supplies, resolved against the same tree the deps would see.
 */
function build(source: string) {
	const tree = createTokenTree(parser.parse(source))
	const selection = createSelection({
		offsetOf: anchor => offsetOfAnchor(tree.roots(), anchor),
		anchorAt: offset => anchorAt(tree.roots(), offset),
		value: () => tree.value(),
	})
	return {tree, selection}
}

/**
 * A store whose tree is built by `props.set` alone — no container, so nothing below is
 * mounted. The repair cases still need the real transaction/adoption pipeline (that is
 * what they gate), but not one line of DOM.
 */
function unmountedStoreWithMark(value: string) {
	return enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__value__]'}]})
}

describe('createSelection', () => {
	it('exposes range', () => {
		expect(typeof build('').selection.range).toBe('function')
	})

	it('range starts undefined', () => {
		expect(build('').selection.range()).toBeUndefined()
	})

	describe('position', () => {
		it('is undefined when range is undefined', () => {
			expect(build('').selection.position()).toBeUndefined()
		})
		it('returns start when collapsed', () => {
			// The value is load-bearing now (plan decision D-f): an anchor addresses a
			// NODE, so offset 5 has to exist in the document for the write to resolve.
			const {selection} = build('hello')
			selection.position(5)
			expect(selection.position()).toBe(5)
		})
		it('write collapses range to {pos, pos}', () => {
			const {selection} = build('hello')
			selection.position(5)
			expect(selection.range()).toEqual({start: 5, end: 5})
		})
		it('write does not change isUserSelecting', () => {
			// The one case here that is NOT DOM-free by construction: `isUserSelecting` is the
			// DRIVER's signal, so the claim — that a `position` write leaves it alone — only
			// exists where the two halves are composed.
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.isUserSelecting(true)
			store.selection.position(5)
			expect(store.selection.isUserSelecting()).toBe(true)
		})
		it('write collapses an extended range', () => {
			const {selection} = build('hello')
			selection.selectAll()
			selection.position(3)
			expect(selection.range()).toEqual({start: 3, end: 3})
		})
	})

	describe('isAllSelected', () => {
		it('returns false when value is empty', () => {
			expect(build('').selection.isAllSelected()).toBe(false)
		})
		it('returns false when range is collapsed', () => {
			const {selection} = build('hello')
			selection.position(2)
			expect(selection.isAllSelected()).toBe(false)
		})
		it('returns false for a partial range', () => {
			const {tree, selection} = build('hello')
			selection.select(anchorAt(tree.roots(), 1), anchorAt(tree.roots(), 3))
			expect(selection.isAllSelected()).toBe(false)
		})
		it('returns true when range spans the entire value', () => {
			// STORE-based on purpose, and measured: this case is the second killer of
			// `selectAll`'s node anchors (replacing them with the `'start'`/`'end'` edges fails
			// it), and it only kills through an UNMOUNTED store, where `offsetOf('end')` has no
			// root to answer from and degenerates to 0. The DOM-free harness below resolves
			// `'end'` against a real last root, so there the two forms are indistinguishable and
			// the mutation survives.
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			store.selection.selectAll()
			expect(store.selection.isAllSelected()).toBe(true)
		})
	})

	describe('caret repair (spec S1 D7, AC-3.2/3.3/3.4)', () => {
		/**
		 * `store.tokens.replace` — NOT `store.edit.replace` (it was `store.value.replace`
		 * until S1.8 step 5 deleted the facade). EditController writes the caret itself
		 * afterwards, which would mask everything these cases assert.
		 */
		it('keeps node and offset when the edit is outside the anchor, and still reports the NEW offset', () => {
			// AC-3.2 and the #generation gate in one case, hand-traced:
			//   'ab@[x]cd' → text[0,2] mark[2,6] text[6,8]; caret 7 = {node: cd, offset: 1}.
			//   insert 'Z' at 0 → window {0,0,1} → map(7) = 8 → anchorAt(8) → cd is now [7,9]
			//   → {node: cd, offset: 1} — the SAME node object and the SAME local offset, so
			//   the `#anchors` write is deduped and notifies nothing. Only the generation bump
			//   makes range() answer 8; without it the computed returns the cached 7.
			const store = unmountedStoreWithMark('ab@[x]cd')
			store.selection.position(7)
			expect(store.selection.range()).toEqual({start: 7, end: 7})

			store.tokens.replace({start: 0, end: 0}, 'Z')

			expect(store.tokens.value()).toBe('Zab@[x]cd')
			expect(store.selection.range()).toEqual({start: 8, end: 8})
		})

		it('maps a caret inside the edited region to the end of the inserted text', () => {
			// AC-3.3. Caret 7 (inside 'cd'), replace [6,8] with 'ZZZZ' → window {6,8,4} →
			// map(7) → 6 + 4 = 10.
			const store = unmountedStoreWithMark('ab@[x]cd')
			store.selection.position(7)

			store.tokens.replace({start: 6, end: 8}, 'ZZZZ')

			expect(store.selection.range()).toEqual({start: 10, end: 10})
		})

		it('survives the anchor node being REMOVED by the transaction', () => {
			// AC-3.3's second half. Whole-value write: gapWindow('ab@[x]cd','zz') = {0,8,2};
			// adoption pairs by index, so root 0 is retained and the mark AND 'cd' — the
			// anchor's node — are removed. map(7) → inside the window → 0 + 2 = 2.
			const store = unmountedStoreWithMark('ab@[x]cd')
			store.selection.position(7)

			store.tokens.replace({start: 0, end: -1}, 'zz')

			expect(store.tokens.value()).toBe('zz')
			expect(store.selection.range()).toEqual({start: 2, end: 2})
		})

		it('maps a cross-node replacement spanning a mark to the end of the replacement', () => {
			// AC-3.4. Caret 8 (document end), replace [1,7] with 'Q' → 'aQd', window {1,7,1},
			// delta -5 → map(8) = 3.
			const store = unmountedStoreWithMark('ab@[x]cd')
			store.selection.position(8)

			store.tokens.replace({start: 1, end: 7}, 'Q')

			expect(store.tokens.value()).toBe('aQd')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
		})

		it('repairs the caret through the EXACT edit window, not a narrowed one', () => {
			// Gates the offset shim's whole-value-only narrowing (S1.6a mutation 6, spec S1 D8).
			// 'hello' + replace [0,3) with 'hey': the exact window {0,3,3} maps a caret at 1 to 3
			// (inside → start + insertedLength). Narrowing to the shared-prefix gap window
			// {2,3,1} maps it to 1 instead, because 1 is then strictly BEFORE the window.
			const store = enableStructuralStore('hello')
			store.selection.position(1)

			store.tokens.replace({start: 0, end: 3}, 'hey')

			expect(store.tokens.value()).toBe('heylo')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
		})

		it('leaves the selection alone when there was none', () => {
			const store = unmountedStoreWithMark('ab@[x]cd')
			expect(store.selection.range()).toBeUndefined()
			store.tokens.replace({start: 0, end: 0}, 'Z')
			expect(store.selection.range()).toBeUndefined()
		})
	})

	describe('controlled caret (spec S1 AC-4.4)', () => {
		// MOUNTED, and measured to have to be: in controlled mode the echo arrives through the
		// host, so with no container three of these four answer the pre-edit offset instead.
		it('repairs at the echo, once, with no optimistic move', () => {
			// THE integration gate for plan decisions D-a AND D-e simultaneously:
			//   left affinity answers 3 → range {2,2} after the echo;
			//   keeping the optimistic write answers {4,4} (the captured caret is already 3).
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next})})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace(...anchorsAt(store, 2, 2), 'X')

			expect(store.tokens.value()).toBe('heXllo')
			expect(store.selection.range()).toEqual({start: 3, end: 3})
			container.remove()
		})

		it('a rejecting parent moves no caret at all', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({value: 'hello', onChange})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace(...anchorsAt(store, 2, 2), 'X')

			expect(onChange).toHaveBeenCalledWith('heXllo')
			expect(store.tokens.value()).toBe('hello')
			expect(store.selection.range()).toEqual({start: 2, end: 2})
			container.remove()
		})

		it("captures an 'end' anchor in TREE space, not against the props value", () => {
			// The only case that separates `offsetOfAnchor('end')` (the last root's end) from a
			// `value.current().length` read: during an ECHO's capture the tree still holds the
			// pre-edit projection while `value.current()` is already the parent's next string.
			// An out-of-range intent is the idiom that produces an `'end'` anchor (see the two
			// out-of-range cases above). A DELETION is required — under an insertion the
			// over-read and `map`'s shift saturate back onto the same document end.
			//   correct: capture 5 → window {0,1,0} → map(5) = 4;
			//   props-length read: capture 4 → map(4) = 3.
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next})})
			const {container} = mountInline(store)
			store.selection.position(999)

			store.edit.replace(...anchorsAt(store, 0, 1), '')

			expect(store.tokens.value()).toBe('ello')
			expect(store.selection.range()).toEqual({start: 4, end: 4})
			container.remove()
		})

		it('a transforming parent still repairs, through the gap window', () => {
			const store = new Store()
			store.props.set({value: 'hello', onChange: next => store.props.set({value: next.toUpperCase()})})
			const {container} = mountInline(store)
			store.selection.position(2)

			store.edit.replace(...anchorsAt(store, 2, 2), 'X')

			expect(store.tokens.value()).toBe('HEXLLO')
			// gapWindow('hello','HEXLLO') = {0,5,6}; map(2) is inside → 0 + 6 = 6. Best effort,
			// which is what AC-4.2/4.4 promise for a transform.
			expect(store.selection.range()).toEqual({start: 6, end: 6})
			container.remove()
		})
	})
})