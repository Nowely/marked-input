import {describe, it, expect, vi} from 'vitest'

import {replaceInString} from '../../shared/utils'
import {Store} from '../../store/Store'

/**
 * Tokens publish only on a mounted store; a bare container is enough — with
 * no aligned DOM every commit settles structurally and `current()` stays exactly
 * the reconciled parse of the accepted value. Mount AFTER props: the value's
 * lazy initial reads defaultValue at the model's first read, and mounting IS
 * a read (real adapters always set props before the container attaches).
 */
function mount(store: Store): Store {
	store.host.container(document.createElement('div'))
	return store
}

describe('ValueModel', () => {
	it('exposes accepted value state', () => {
		const store = new Store()

		expect(typeof store.value.current).toBe('function')
		expect('next' in store.value).toBe(false)
		expect(store.value.current()).toBe('')
	})

	it('initializes from controlled value on enable', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		mount(store)
		expect(store.value.current()).toBe('hello')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('initializes from defaultValue when uncontrolled', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		mount(store)
		expect(store.value.current()).toBe('hello')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('controlled prop echo commits current and tokens', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		mount(store)
		store.props.set({value: 'world'})

		expect(store.value.current()).toBe('world')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	it('falls back to defaultValue when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.set({value: 'hello', defaultValue: 'default'})
		mount(store)
		store.props.set({value: undefined})

		expect(store.props.value()).toBeUndefined()
		expect(store.value.current()).toBe('default')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'default', position: {start: 0, end: 7}}])
	})

	it('readOnly rejects editor-originated range replacement', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})
		mount(store)
		store.value.current('world')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('readOnly allows controlled prop updates to replace accepted value', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', readOnly: true, onChange})
		mount(store)
		store.props.set({value: 'world'})

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('world')
		expect(store.tokens.current()).toMatchObject([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	describe('replace()', () => {
		it('commits uncontrolled range replacement', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello world'})
			store.value.replace({start: 6, end: 11}, 'markput')

			expect(store.value.current()).toBe('hello markput')
		})

		it('rejects invalid ranges without calling onChange', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({defaultValue: 'hello', onChange})
			store.value.replace({start: 4, end: 2}, 'x')

			expect(onChange).not.toHaveBeenCalled()
			expect(store.value.current()).toBe('hello')
		})

		it('calls onChange and keeps old current until controlled echo', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({value: 'hello', onChange})
			store.value.replace({start: 0, end: 5}, 'world')

			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.value.current()).toBe('hello')

			store.props.set({value: 'world'})
			expect(store.value.current()).toBe('world')
		})

		it('returns replaced string for a valid range', () => {
			expect(replaceInString('hello world', {start: 6, end: 11}, 'markput')).toBe('hello markput')
		})

		it('returns undefined for invalid replacement ranges', () => {
			expect(replaceInString('hello', {start: -1, end: 1}, 'x')).toBeUndefined()
			expect(replaceInString('hello', {start: 4, end: 2}, 'x')).toBeUndefined()
			expect(replaceInString('hello', {start: 0, end: 6}, 'x')).toBeUndefined()
		})
	})

	describe('value hinge (S1.6a)', () => {
		it('an uncontrolled edit before control is taken is what dropping control returns to', () => {
			// The pin for the frozen-storage arm. 'falls back to defaultValue when
			// controlled value becomes undefined' above covers the OTHER arm (never
			// uncontrolled → the seed); this one is the only test that fails if the
			// restore point is replaced by the seed.
			const store = new Store()
			store.props.set({defaultValue: 'default'})
			mount(store)
			store.value.replace({start: 0, end: -1}, 'edited')
			expect(store.value.current()).toBe('edited')

			store.props.set({value: 'controlled'})
			expect(store.value.current()).toBe('controlled')

			store.props.set({value: undefined})
			expect(store.value.current()).toBe('edited')
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
						value: store.value.current(),
						tokens: store.tokens
							.current()
							.map(t => t.content)
							.join('|'),
					}),
			})
			mount(store)

			store.edit.replace({start: 9, end: 9}, '!')

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
			expect(() => store.edit.replace({start: 0, end: 0}, 'X')).not.toThrow()
			expect(store.value.current()).toBe('Xhello')
		})
	})
})