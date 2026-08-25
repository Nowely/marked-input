import {describe, expect, it} from 'vitest'

import type {Store} from '../../store/Store'
import type {TreeNode} from '../tokens'
import {mountNestedBlock, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * THE ROW SELECTION, end to end: the keys that widen it and the derivation that reads it back.
 * One spec for both halves on purpose — there is no store between them, so `store.block.selected`
 * IS what the keys wrote, and testing either alone would test a projection of the other.
 *
 * The document is one nested shape, `'aa\n\tbb\n\tcc\ndd'`, because every rule here is about
 * depth: root `aa` carries `bb` and `cc`, and `dd` is a second root. A flat document answers Esc's
 * second rung and Mod+A's new one with `undefined` and would leave both unproven. Two-character
 * bodies, so a span can start INSIDE one row's body and end inside another's.
 */
const DOCUMENT = 'aa\n\tbb\n\tcc\ndd'

const mount = () => mountNestedBlock({defaultValue: DOCUMENT})

/**
 * The row selection as SLOT TEXT, which is what makes the expectations readable: ids are minted
 * per document and say nothing about which row was selected.
 */
function selectedSlots(store: Store): string[] {
	const byId = new Map<number, string>()
	const collect = (node: TreeNode): void => {
		if (node.kind !== 'row') return
		byId.set(node.id, node.slot())
		node.rows().forEach(collect)
	}
	store.tokens.nodes().forEach(collect)
	return store.block.selected().map(id => byId.get(id) ?? '?')
}

/** A collapsed caret at a projection offset, stored — which is the tier these arms read. */
function caretAt(store: Store, offset: number): void {
	store.tokens.selection.select(store.tokens.anchorAt(offset))
}

function press(store: Store, container: HTMLElement, key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...modifiers})
	container.dispatchEvent(event)
	return event
}

describe('the row selection derives from the text selection', () => {
	it('answers nothing for a caret, and nothing for a partly covered row', () => {
		const {store} = mount()

		caretAt(store, 5)
		expect(selectedSlots(store)).toEqual([])

		// Half of `bb` and half of `cc`: two rows touched, neither held whole.
		store.tokens.selection.select(store.tokens.anchorAt(5), store.tokens.anchorAt(9))
		expect(selectedSlots(store)).toEqual([])
	})

	/**
	 * AN EMPTY ROW'S CONTENT IS ZERO-WIDTH, so a caret resting in one sits at both of its edges —
	 * and without the collapsed test would select the row it is merely being typed into, where the
	 * next character replaces it. The same shape `isAllSelected` refuses for the whole document.
	 * The declared cost: an empty row cannot be row-selected on its own, only inside a range that
	 * already spans its neighbours.
	 */
	it('refuses to hold an EMPTY row a caret merely rests in', () => {
		const {store} = mountNestedBlock({defaultValue: 'aa\n\ncc'})

		caretAt(store, 3)
		expect(selectedSlots(store)).toEqual([])

		store.tokens.selection.select(store.tokens.anchorAt(0), store.tokens.anchorAt(6))
		expect(selectedSlots(store)).toEqual(['aa', '', 'cc'])
	})

	it('answers the MAXIMAL rows a span covers, never a covered row inside a covered one', () => {
		const {store} = mount()

		// `bb` alone — from its ENTRY, past the lead no caret may enter, to its content end.
		store.tokens.selection.select(store.tokens.anchorAt(4), store.tokens.anchorAt(6))
		expect(selectedSlots(store)).toEqual(['bb'])

		// `aa` and everything under it: the parent answers, its two children do not.
		store.tokens.selection.select(store.tokens.anchorAt(0), store.tokens.anchorAt(10))
		expect(selectedSlots(store)).toEqual(['aa'])
	})
})

describe('Esc escalates, one level per press', () => {
	it('turns a caret into its own row, then climbs to the row it is nested in', () => {
		const {store, container} = mount()
		caretAt(store, 5)

		expect(press(store, container, 'Escape').defaultPrevented).toBe(true)
		expect(selectedSlots(store)).toEqual(['bb'])
		expect(selectionRange(store)).toEqual({start: 4, end: 6})

		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['aa'])
		expect(selectionRange(store)).toEqual({start: 0, end: 10})

		// At depth 0 there is nothing above the row, so the press re-states the row it holds
		// rather than reaching for the document.
		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['aa'])
	})

	it('defers to an open overlay, whose own Escape closes it', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		const anchors = store.tokens.selection.anchors()
		if (!anchors) throw new Error('expected a stored selection')
		store.overlay.match({
			value: '',
			source: '/',
			span: '/',
			node: container,
			range: anchors,
			option: {markup: '@[__value__]'},
		})

		expect(press(store, container, 'Escape').defaultPrevented).toBe(false)
		expect(selectedSlots(store)).toEqual([])
	})
})

describe('Shift+arrows grow the row selection', () => {
	it('absorbs the next row downward and the previous row upward', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')

		expect(press(store, container, 'ArrowDown', {shiftKey: true}).defaultPrevented).toBe(true)
		expect(selectedSlots(store)).toEqual(['bb', 'cc'])

		// Down again crosses out of the parent: `dd` is the next row past `cc`'s subtree.
		press(store, container, 'ArrowDown', {shiftKey: true})
		expect(selectedSlots(store)).toEqual(['bb', 'cc', 'dd'])
	})

	/**
	 * Upward from a FIRST CHILD reaches the parent, and absorbing it WHOLE is what keeps the
	 * gesture from getting stuck: the parent's subtree already covers the child, so a span that
	 * only reached the parent's start would cover neither of them and the key would do nothing.
	 */
	it('absorbs a parent whole when it grows past the first child', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')

		press(store, container, 'ArrowUp', {shiftKey: true})
		expect(selectedSlots(store)).toEqual(['aa'])
		expect(selectionRange(store)).toEqual({start: 0, end: 10})
	})

	it('leaves an arrow alone until a row selection stands', () => {
		const {store, container} = mount()
		caretAt(store, 5)

		expect(press(store, container, 'ArrowDown', {shiftKey: true}).defaultPrevented).toBe(false)
		expect(press(store, container, 'ArrowUp', {shiftKey: true}).defaultPrevented).toBe(false)

		// And a plain arrow is never this feature's, selection or no selection.
		press(store, container, 'Escape')
		expect(press(store, container, 'ArrowDown').defaultPrevented).toBe(false)
		expect(selectedSlots(store)).toEqual(['bb'])
	})
})

describe('Mod+A widens before it reaches for the document', () => {
	it('climbs to the parent while a nested row selection stands, then selects everything', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(selectedSlots(store)).toEqual(['aa'])
		expect(store.tokens.selection.isAllSelected()).toBe(false)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})

	it('selects everything from a plain caret, exactly as it always did', () => {
		const {store, container} = mount()
		caretAt(store, 5)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})
})