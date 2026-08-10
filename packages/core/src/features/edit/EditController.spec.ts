import {describe, it, expect, vi} from 'vitest'

import {Store} from '../../store/Store'
import {anchorsAt} from '../tokens/__testing__/mountFixtures'

describe('EditController', () => {
	it('exposes replace on the store', () => {
		const store = new Store()

		expect(typeof store.edit.replace).toBe('function')
	})

	it('replaces value and places caret after replacement', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.edit.replace(...anchorsAt(store, 6, 11), 'markput')

		expect(store.tokens.value()).toBe('hello markput')
		expect(store.selection.range()).toEqual({start: 13, end: 13})
	})

	it('places caret at range start when deleting', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.edit.replace(...anchorsAt(store, 5, 11), '')

		expect(store.tokens.value()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 5, end: 5})
	})

	it('normalizes a reversed anchor pair instead of rejecting it', () => {
		// BEHAVIOR CHANGE (S2.5): the numeric verb rejected `{start: 4, end: 2}` outright.
		// `replaceBetween` normalizes, so the two ends are interchangeable — the contract
		// `MarkputApi.replaceRange` already documented.
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', onChange})

		store.edit.replace(...anchorsAt(store, 4, 2), 'x')

		expect(onChange).toHaveBeenCalledWith('hexo')
		expect(store.tokens.value()).toBe('hexo')
		expect(store.selection.range()).toEqual({start: 3, end: 3})
	})

	it('does not move caret or change value when readOnly', () => {
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({defaultValue: 'hello', readOnly: true, onChange})
		store.selection.position(1)

		store.edit.replace(...anchorsAt(store, 1, 4), 'i')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.tokens.value()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 1, end: 1})
	})

	it('emits without moving the caret in controlled mode — the echo repairs it', () => {
		// BEHAVIOR CHANGE (spec D6): the caret intent used to be written here, in the OLD
		// coordinate space, and then clamped against the un-echoed props value. It is now
		// repaired once, at the echo's adoption, through selectionBefore + map.
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({value: 'hello', onChange})
		store.selection.position(1)

		store.edit.replace(...anchorsAt(store, 0, 5), 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.tokens.value()).toBe('hello')
		expect(store.selection.range()).toEqual({start: 1, end: 1})
	})

	it('still honours an explicit setValue caret in controlled mode', () => {
		// The D-e exemption. `caretOffset` is a caller INTENT map cannot reconstruct; dropping
		// it deleted a block row (Drag.{react,vue}.spec "backspace on empty row"). Controlled +
		// no echo here, so the intent is the only writer.
		const store = new Store()
		store.props.set({value: 'hello', onChange: vi.fn()})
		store.selection.position(0)

		store.edit.setValue('world', 2)

		expect(store.selection.range()).toEqual({start: 2, end: 2})
	})

	it('honors an explicit setValue caret over the end of the new value', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.edit.setValue('hi world', 0)

		expect(store.tokens.value()).toBe('hi world')
		expect(store.selection.range()).toEqual({start: 0, end: 0})
	})

	it('setValue replaces the whole value and lands the caret at its end', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello world'})
		store.edit.setValue('replaced')

		expect(store.tokens.value()).toBe('replaced')
		expect(store.selection.range()).toEqual({start: 8, end: 8})
	})

	it('setValue works on an empty value', () => {
		const store = new Store()
		store.edit.setValue('first')

		expect(store.tokens.value()).toBe('first')
		expect(store.selection.range()).toEqual({start: 5, end: 5})
	})
})