import {describe, it, expect, vi} from 'vitest'

import {watch} from '../../shared/signals'
import {Store} from '../../store/Store'
import type {EditRecord} from '../tokens'
import {
	anchorsAt,
	caretAt,
	enableStructuralStore,
	mountInline,
	mountStructuralInline,
	selectionRange,
} from '../tokens/__testing__/mountFixtures'

describe('EditController', () => {
	it('replaces value and places caret after replacement', () => {
		const store = new Store()
		store.props.set({separator: null, defaultValue: 'hello world'})
		store.edit.replace(...anchorsAt(store, 6, 11), 'markput')

		expect(store.tokens.value()).toBe('hello markput')
		expect(selectionRange(store)).toEqual({start: 13, end: 13})
	})

	it('places caret at range start when deleting', () => {
		const store = new Store()
		store.props.set({separator: null, defaultValue: 'hello world'})
		store.edit.replace(...anchorsAt(store, 5, 11), '')

		expect(store.tokens.value()).toBe('hello')
		expect(selectionRange(store)).toEqual({start: 5, end: 5})
	})

	it('normalizes a reversed anchor pair instead of rejecting it', () => {
		// BEHAVIOR CHANGE (S2.5): the numeric verb rejected `{start: 4, end: 2}` outright.
		// `replaceBetween` normalizes, so the two ends are interchangeable — the contract
		// `MarkputHandle.replaceRange` already documented.
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({separator: null, defaultValue: 'hello', onChange})

		store.edit.replace(...anchorsAt(store, 4, 2), 'x')

		expect(onChange).toHaveBeenCalledWith('hexo')
		expect(store.tokens.value()).toBe('hexo')
		expect(selectionRange(store)).toEqual({start: 3, end: 3})
	})

	it('does not move caret or change value when readOnly', () => {
		// MOUNTED, with the DOM caret somewhere else on purpose: the gate brings the stored
		// anchors up to DOM truth before it commits, so a refusal that ran the sync anyway would
		// move the selection on an edit that never happened. Unmounted, the sync declines for
		// want of a DOM and the case cannot tell the two apart.
		const onChange = vi.fn()
		const store = enableStructuralStore('hello', {readOnly: true, onChange})
		const {container, textNode} = mountInline(store)
		caretAt(store, 1)
		window.getSelection()?.collapse(textNode, 4)

		store.edit.replace(...anchorsAt(store, 1, 4), 'i')

		expect(onChange).not.toHaveBeenCalled()
		expect(store.tokens.value()).toBe('hello')
		expect(selectionRange(store)).toEqual({start: 1, end: 1})
		container.remove()
	})

	it('emits without moving the caret in controlled mode — the echo repairs it', () => {
		// BEHAVIOR CHANGE (spec D6): the caret intent used to be written here, in the OLD
		// coordinate space, and then clamped against the un-echoed props value. It is now
		// repaired once, at the echo's adoption, through selectionBefore + map.
		const store = new Store()
		const onChange = vi.fn()
		store.props.set({separator: null, value: 'hello', onChange})
		caretAt(store, 1)

		store.edit.replace(...anchorsAt(store, 0, 5), 'world')

		expect(onChange).toHaveBeenCalledWith('world')
		expect(store.tokens.value()).toBe('hello')
		expect(selectionRange(store)).toEqual({start: 1, end: 1})
	})

	it('moves no caret on a controlled setValue', () => {
		// The D-e exemption went with `caretOffset`. Its callers were row edits that
		// wanted the caret inside a row of the RESULT, and they address their own nodes now;
		// the measurement that justified the exemption had gone stale, so nothing is left
		// asking `setValue` to write a caret the echo will re-map.
		const store = new Store()
		store.props.set({separator: null, value: 'hello', onChange: vi.fn()})
		caretAt(store, 0)

		store.edit.setValue('world')

		expect(selectionRange(store)).toEqual({start: 0, end: 0})
	})

	it('setValue replaces the whole value and lands the caret at its end', () => {
		const store = new Store()
		store.props.set({separator: null, defaultValue: 'hello world'})
		store.edit.setValue('replaced')

		expect(store.tokens.value()).toBe('replaced')
		expect(selectionRange(store)).toEqual({start: 8, end: 8})
	})

	it('setValue works on an empty value', () => {
		const store = new Store()
		store.edit.setValue('first')

		expect(store.tokens.value()).toBe('first')
		expect(selectionRange(store)).toEqual({start: 5, end: 5})
	})

	it('records the caret the DOM holds, not the reading a selectionchange has yet to deliver', () => {
		// The gap is REAL and it is the browser's: `selectionchange` arrives on a task, so a
		// caret that has moved since the last one leaves the stored anchors naming where it was.
		// The edit itself is addressed from DOM truth — `beforeinput` names its own span — so
		// the two readings disagree exactly here, and the record is what carries the difference
		// forward: an undo goes back to the caret its edit was made from.
		const {store, textNode, container} = mountStructuralInline('Undo me')
		caretAt(store, 0)
		window.getSelection()?.collapse(textNode, 4)

		const records: EditRecord[] = []
		const stop = watch(store.tokens.edits, record => records.push(record))
		store.edit.replace(...anchorsAt(store, 4, 4), 'X')
		stop()

		expect(store.tokens.value()).toBe('UndoX me')
		expect(records.at(-1)?.selectionBefore).toEqual({anchor: 4, head: 4})
		container.remove()
	})
})