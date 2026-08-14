import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../../store/Store'
import {anchorsAt} from '../__testing__/mountFixtures'
import {treeShape} from '../__testing__/tokenFactories'
import {joinNodes} from '../tree/tree'

/**
 * Tokens publish only on a mounted store; a bare container is enough — with
 * no aligned DOM every commit settles structurally and the live tree stays exactly
 * the reconciled parse of the accepted value. Mount AFTER props: the value's
 * lazy initial reads defaultValue at the model's first read, and mounting IS
 * a read (real adapters always set props before the container attaches).
 */
function mount(store: Store): Store {
	store.host.container(document.createElement('div'))
	return store
}

/**
 * Ported from `features/state/ValueModel.spec.ts` at S1.8 step 5. The facade was a
 * one-phase delegation to the token layer (`current` → {@link TokenModel.value},
 * `replace` → the internal offset shim), so every behavior it pinned is the token
 * layer's. Three cases did NOT move here: two were unit tests of `replaceInString`,
 * deleted with the helper, and the third ("rejects invalid ranges") went with the shim
 * at S2.6 — an anchor pair cannot be out of range, and a REVERSED one is normalized
 * rather than refused (`EditController.spec`'s "normalizes a reversed anchor pair
 * instead of rejecting it").
 */
describe('TokenModel value boundary', () => {
	it('exposes accepted value state', () => {
		const store = new Store()

		expect(typeof store.tokens.value).toBe('function')
		expect(store.tokens.value()).toBe('')
	})

	it('initializes from controlled value on enable', () => {
		const store = new Store()
		store.props.update({value: 'hello'})
		mount(store)
		expect(store.tokens.value()).toBe('hello')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
		])
	})

	it('an unmounted store reads defaultValue before anything has committed', () => {
		// THE gate on TokenModel.value's `#seeded` arm, which S1.6c took over from two
		// selection cases (now in `tree/selection.spec`; they seed the tree through
		// `anchorAt`). Measured:
		// reducing the getter to `props.value() ?? this.#committed()` returns '' here,
		// because nothing has committed yet.
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(store.tokens.value()).toBe('hello')
	})

	it('initializes from defaultValue when uncontrolled', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		mount(store)
		expect(store.tokens.value()).toBe('hello')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
		])
	})

	it('controlled prop echo commits current and tokens', () => {
		const store = new Store()
		store.props.update({value: 'hello'})
		mount(store)
		store.props.update({value: 'world'})

		expect(store.tokens.value()).toBe('world')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'world', position: {start: 0, end: 5}},
		])
	})

	it('falls back to defaultValue when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.update({value: 'hello', defaultValue: 'default'})
		mount(store)
		store.props.update({value: undefined})

		expect(store.props.value()).toBeUndefined()
		expect(store.tokens.value()).toBe('default')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'default', position: {start: 0, end: 7}},
		])
	})

	it('readOnly rejects editor-originated range replacement', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})
		mount(store)
		store.tokens.setValue('world')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.tokens.value()).toBe('hello')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'hello', position: {start: 0, end: 5}},
		])
	})

	it('readOnly allows controlled prop updates to replace accepted value', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.update({value: 'hello', readOnly: true, onChange})
		mount(store)
		store.props.update({value: 'world'})

		expect(onChange).not.toHaveBeenCalled()
		expect(store.tokens.value()).toBe('world')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'world', position: {start: 0, end: 5}},
		])
	})

	describe('replaceBetween()', () => {
		it('commits uncontrolled range replacement', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello world'})
			store.tokens.replaceBetween(store.tokens.anchorAt(6), store.tokens.anchorAt(11), 'markput')

			expect(store.tokens.value()).toBe('hello markput')
		})

		it('calls onChange and keeps old current until controlled echo', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.update({value: 'hello', onChange})
			store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'world')

			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.tokens.value()).toBe('hello')

			store.props.update({value: 'world'})
			expect(store.tokens.value()).toBe('world')
		})
	})

	describe('value hinge (S1.6a)', () => {
		// RESOLVED AT S1.8 step 5. The S1.6a note here recorded a behavior change that only
		// the deleted facade could produce: `ValueModel.current` was a WRITABLE computed, so
		// writing the value the store already held short-circuited before the setter and
		// never emitted. There is no writable computed any more — every write is
		// `tokens.replaceBetween`, which emits for a no-op splice exactly as it always did
		// (`tree/valueBoundary.spec.ts`'s 'emits an unchanged value in both modes'). The
		// divergence is gone rather than merely untested.
		it('an uncontrolled edit before control is taken is what dropping control returns to', () => {
			// The pin for the frozen-storage arm. 'falls back to defaultValue when
			// controlled value becomes undefined' above covers the OTHER arm (never
			// uncontrolled → the seed); this one is the only test that fails if the
			// restore point is replaced by the seed.
			const store = new Store()
			store.props.set({defaultValue: 'default'})
			mount(store)
			store.tokens.setValue('edited')
			expect(store.tokens.value()).toBe('edited')

			store.props.update({value: 'controlled'})
			expect(store.tokens.value()).toBe('controlled')

			store.props.update({value: undefined})
			expect(store.tokens.value()).toBe('edited')
		})

		it('a container re-attach keeps the uncontrolled edit, not the defaultValue', () => {
			// `Host.onMounted` disposes and rebuilds its scope per container, so attaching a new
			// element re-runs the props watch's IMMEDIATE arm. That run has no `previous`, so it
			// always takes the arrival arm — with `value === undefined` on an uncontrolled store,
			// which is the only arm that can fall back to the seed.
			const store = new Store()
			store.props.set({defaultValue: 'default'})
			mount(store)
			store.tokens.setValue('edited')
			expect(store.tokens.value()).toBe('edited')

			mount(store)

			expect(store.tokens.value()).toBe('edited')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'edited', position: {start: 0, end: 6}},
			])
		})

		it('an uncontrolled edit made BEFORE mount survives the mount arrival', () => {
			// The SECOND behavior of recording `#restore` on the uncontrolled edge, and the
			// defect the pre-cutover code recorded in prose instead of fixing. The write seeds
			// the tree through `#ensureSeeded` while unmounted, so mounting brings a FIRST
			// arrival — `value === undefined`, `#seeded()` already true. Recorded on the
			// uncontrolled edge, `#restore` is the edit by then and the arrival resolves to it;
			// recorded only on the controlled edge it is still `undefined` here, and the
			// arrival falls back to `#seed()` — 'default', discarding the edit.
			const store = new Store()
			store.props.set({defaultValue: 'default'})
			store.tokens.setValue('edited')
			expect(store.tokens.value()).toBe('edited')

			mount(store)

			expect(store.tokens.value()).toBe('edited')
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'edited', position: {start: 0, end: 6}},
			])
		})

		it('onChange runs AFTER the commit, with the value and the tokens already new', () => {
			// BEHAVIOR CHANGE, measured before the cutover: onChange fired from inside the
			// signal setter, so a handler saw value 'he@[x]llo' and tokens 'he|@[x]|llo'
			// while being handed 'he@[x]llo!'.
			const store = new Store()
			const seen: {value: string; tokens: string}[] = []
			store.props.set({
				defaultValue: 'he@[x]llo',
				options: [{markup: '@[__value__]'}],
				Mark: () => null,
				onChange: () =>
					seen.push({
						value: store.tokens.value(),
						tokens: store.tokens
							.nodes()
							.map(node => joinNodes([node]))
							.join('|'),
					}),
			})
			mount(store)

			store.edit.replace(...anchorsAt(store, 9, 9), '!')

			expect(seen).toEqual([{value: 'he@[x]llo!', tokens: 'he|@[x]|llo!'}])
		})

		it('constructing a Store and editing immediately does not touch selection during construction', () => {
			// Store's selection thunk closes over a field declared BELOW `tokens`. If
			// anything called it during construction this would be a TypeError, not a
			// failed assertion. That is the Store-level gate on the D7 channel — the
			// discriminating tests (a capture moved after adoption) live at the boundary,
			// which is the only layer where the TransactionResult is observable.
			const store = new Store()
			store.props.set({defaultValue: 'hello'})
			expect(() => mount(store)).not.toThrow()
			expect(() => store.edit.replace(...anchorsAt(store, 0, 0), 'X')).not.toThrow()
			expect(store.tokens.value()).toBe('Xhello')
		})
	})

	/**
	 * The clipboard's markup entry (`ClipboardController`'s markput MIME) and the block rows'
	 * text read (`keyboard/blockEdit.ts`). `block/operations.spec` stubs the read with a plain
	 * `doc.slice`, so the delegation to `tree/sliceNodes` — and the anchor resolution in front
	 * of it — is pinned only here.
	 */
	describe('valueBetween()', () => {
		// The browser `Clipboard.spec`'s own fixture value, so the answers below are the unit
		// side of its end-to-end assertions.
		const INLINE = 'hello @[world](1) foo'

		const inlineStore = (): Store => {
			const store = new Store()
			store.props.set({
				defaultValue: INLINE,
				options: [{markup: '@[__value__](__meta__)'}],
				Mark: () => null,
			})
			return mount(store)
		}

		it('slices within a single text token', () => {
			const store = inlineStore()
			// The layout every offset literal in this block is read off.
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'hello ', position: {start: 0, end: 6}},
				{kind: 'mark', content: '@[world](1)', position: {start: 6, end: 17}},
				{kind: 'text', content: ' foo', position: {start: 17, end: 21}},
			])

			expect(store.tokens.valueBetween(...anchorsAt(store, 2, 4))).toBe('ll')
		})

		it('trims the boundary text tokens and keeps the mark whole', () => {
			// `Clipboard.spec`'s 'cross-token partial selection … trimmed text and full mark'.
			// [3, 20) cuts one character into each text token, and the mark between them is
			// emitted whole either way — its `value`/`meta` have no sub-spans to cut.
			const store = inlineStore()
			expect(store.tokens.valueBetween(...anchorsAt(store, 3, 20))).toBe('lo @[world](1) fo')
		})

		it('expands to the whole mark when an end lands inside its markup', () => {
			// The expansion is the ANCHOR's here, not the slice's: offset 10 sits inside
			// `@[world](1)`, which is not anchorable, so `anchorAt` answers the mark's own end
			// (17). A window touching a SLOTLESS mark is therefore always mark-aligned by the
			// time `sliceNodes` sees it.
			const store = inlineStore()
			expect(store.tokens.valueBetween(...anchorsAt(store, 3, 10))).toBe('lo @[world](1)')
		})

		it('answers exactly the markup for a window on the mark boundaries', () => {
			const store = inlineStore()
			const mark = store.tokens.nodes()[1]
			// `{before}`/`{after}` is the form `blockEdit` reads a row with; the offsets are the
			// same window through `anchorAt`.
			expect(store.tokens.valueBetween({before: mark}, {after: mark})).toBe('@[world](1)')
			expect(store.tokens.valueBetween(...anchorsAt(store, 6, 17))).toBe('@[world](1)')
		})

		it('answers empty for a collapsed pair', () => {
			// Three different guards: offset 3 is INSIDE a text token, so only the slice clamp
			// answers ''; 6 and 17 are the mark's own edges, where each half of the half-open
			// overlap test is the one thing keeping the whole markup out.
			const store = inlineStore()
			expect(store.tokens.valueBetween(...anchorsAt(store, 3))).toBe('')
			expect(store.tokens.valueBetween(...anchorsAt(store, 6))).toBe('')
			expect(store.tokens.valueBetween(...anchorsAt(store, 17))).toBe('')
		})

		it('reads the same window from a reversed pair', () => {
			// A selection carries `anchor`/`head` in the order the USER dragged, so a
			// right-to-left selection hands the pair over backwards. `ClipboardController`
			// passes them straight through, which is what makes the normalisation load-bearing.
			const store = inlineStore()
			expect(store.tokens.valueBetween(...anchorsAt(store, 20, 3))).toBe('lo @[world](1) fo')
			expect(store.tokens.valueBetween('end', 'start')).toBe(INLINE)
		})

		it('projects the whole document between the edges', () => {
			const store = inlineStore()
			expect(store.tokens.valueBetween('start', 'end')).toBe(INLINE)
			expect(store.tokens.valueBetween('start', 'end')).toBe(store.tokens.value())
		})

		it('trims a SLOT mark to the covered part of its nested content', () => {
			// The only partially covered mark reachable through anchors: a slot's children are
			// anchorable, so a window can end inside the mark. The mark still contributes its
			// whole markup with the slot cut — half a slot copies as a valid annotation, not as
			// a truncated one.
			const store = new Store()
			store.props.set({
				defaultValue: 'a#[hello]b',
				options: [{markup: '#[__slot__]'}],
				Mark: () => null,
			})
			mount(store)
			expect(treeShape(store.tokens.nodes())).toMatchObject([
				{kind: 'text', content: 'a', position: {start: 0, end: 1}},
				{kind: 'mark', content: '#[hello]', position: {start: 1, end: 9}},
				{kind: 'text', content: 'b', position: {start: 9, end: 10}},
			])

			expect(store.tokens.valueBetween(...anchorsAt(store, 3, 6))).toBe('#[hel]')
		})
	})
})