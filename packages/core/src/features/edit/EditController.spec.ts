import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'

describe('EditController', () => {
	it('exposes replace on the store', () => {
		const store = new Store()

		expect(typeof store.edit.replace).toBe('function')
	})

	it('replaces value and places caret after replacement', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.host.mounted()

		store.edit.replace({start: 6, end: 11}, 'markput')

		expect(store.value.current()).toBe('hello markput')
		expect(store.selection.range()).toEqual({start: 13, end: 13})
	})

	it('places caret at range start when deleting', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.host.mounted()

		store.edit.replace({start: 5, end: 11}, '')

		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 5, end: 5})
	})

	it('does not move caret or change value for invalid ranges', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', onChange})
		store.host.mounted()
		store.selection.position(2)

		store.edit.replace({start: 4, end: 2}, 'x')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 2, end: 2})
	})

	it('does not move caret or change value when readOnly', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})
		store.host.mounted()
		store.selection.position(1)

		store.edit.replace({start: 1, end: 4}, 'i')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 1, end: 1})
	})

	it('calls onChange and records caret intent in controlled mode', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.host.mounted()

		store.edit.replace({start: 0, end: 5}, 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.value.current()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 5, end: 5})
	})

	it('honors explicit caretAt over the natural end of the replacement', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.host.mounted()

		store.edit.replace({start: 0, end: 5}, 'hi', 0)

		expect(store.value.current()).toBe('hi world')
		expect(store.selection.range()).toEqual({start: 0, end: 0})
	})

	it('normalizes negative range.end to the current value length', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.host.mounted()

		store.edit.replace({start: 0, end: -1}, 'replaced')

		expect(store.value.current()).toBe('replaced')
		expect(store.selection.range()).toEqual({start: 8, end: 8})
	})

	it('normalizes negative range.end on an empty value', () => {
		const store = new Store()
		store.host.mounted()

		store.edit.replace({start: 0, end: -1}, 'first')

		expect(store.value.current()).toBe('first')
		expect(store.selection.range()).toEqual({start: 5, end: 5})
	})
})