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
		store.props.set({value: 'hello'})
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
		store.props.set({value: 'hello'})
		mount(store)
		store.props.set({value: 'world'})

		expect(store.tokens.value()).toBe('world')
		expect(treeShape(store.tokens.nodes())).toMatchObject([
			{kind: 'text', content: 'world', position: {start: 0, end: 5}},
		])
	})

	it('falls back to defaultValue when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.set({value: 'hello', defaultValue: 'default'})
		mount(store)
		store.props.set({value: undefined})

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
		store.props.set({value: 'hello', readOnly: true, onChange})
		mount(store)
		store.props.set({value: 'world'})

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
			store.props.set({value: 'hello', onChange})
			store.tokens.replaceBetween(store.tokens.anchorAt(0), store.tokens.anchorAt(5), 'world')

			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.tokens.value()).toBe('hello')

			store.props.set({value: 'world'})
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

			store.props.set({value: 'controlled'})
			expect(store.tokens.value()).toBe('controlled')

			store.props.set({value: undefined})
			expect(store.tokens.value()).toBe('edited')
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
})