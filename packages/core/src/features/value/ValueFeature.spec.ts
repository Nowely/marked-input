import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('ValueFeature', () => {
	it('exposes accepted value state', () => {
		const store = new Store()

		expect(typeof store.value.current).toBe('function')
		expect(typeof store.value.isControlledMode).toBe('function')
		expect('next' in store.value).toBe(false)
		expect(store.value.current()).toBe('')
		expect(store.value.isControlledMode()).toBe(false)
	})

	it('initializes from controlled value on enable', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		store.lifecycle.mounted()

		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('initializes from defaultValue when uncontrolled', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		store.lifecycle.mounted()

		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('controlled prop echo commits current and tokens', () => {
		const store = new Store()
		store.props.set({value: 'hello'})
		store.lifecycle.mounted()

		store.props.set({value: 'world'})

		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	it('falls back to defaultValue when controlled value becomes undefined', () => {
		const store = new Store()
		store.props.set({value: 'hello', defaultValue: 'default'})
		store.lifecycle.mounted()

		store.props.set({value: undefined})

		expect(store.value.isControlledMode()).toBe(false)
		expect(store.value.current()).toBe('default')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'default', position: {start: 0, end: 7}}])
	})

	it('readOnly rejects editor-originated range replacement', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})
		store.lifecycle.mounted()

		store.value.current('world')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'hello', position: {start: 0, end: 5}}])
	})

	it('readOnly allows controlled prop updates to replace accepted value', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', readOnly: true, onChange})
		store.lifecycle.mounted()

		store.props.set({value: 'world'})

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('world')
		expect(store.parsing.tokens()).toEqual([{type: 'text', content: 'world', position: {start: 0, end: 5}}])
	})

	describe('replace()', () => {
		it('commits uncontrolled range replacement', () => {
			const store = new Store()
			store.props.set({defaultValue: 'hello world'})
			store.lifecycle.mounted()

			store.value.replace({start: 6, end: 11}, 'markput')

			expect(store.value.current()).toBe('hello markput')
		})

		it('rejects invalid ranges without calling onChange', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({defaultValue: 'hello', onChange})
			store.lifecycle.mounted()

			store.value.replace({start: 4, end: 2}, 'x')

			expect(onChange).not.toHaveBeenCalled()
			expect(store.value.current()).toBe('hello')
		})

		it('calls onChange and keeps old current until controlled echo', () => {
			const store = new Store()
			const onChange = vi.fn()
			store.props.set({value: 'hello', onChange})
			store.lifecycle.mounted()

			store.value.replace({start: 0, end: 5}, 'world')

			expect(onChange).toHaveBeenCalledWith('world')
			expect(store.value.current()).toBe('hello')

			store.props.set({value: 'world'})
			expect(store.value.current()).toBe('world')
		})
	})
})