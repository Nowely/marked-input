import {describe, expect, it} from 'vitest'

import type {Store} from '../../store/Store'
import type {TreeNode} from '../tokens'
import {mountNestedRowDoc, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * THE ROW SELECTION, end to end: the keys that widen it and the derivation that reads it back.
 * One spec for both halves on purpose — there is no store between them, so `store.rows.selected`
 * IS what the keys wrote, and testing either alone would test a projection of the other.
 *
 * The document is one nested shape, `'aa\n\tbb\n\tcc\ndd'`, because every rule here is about
 * depth: root `aa` carries `bb` and `cc`, and `dd` is a second root. A flat document answers Esc's
 * second rung and Mod+A's new one with `undefined` and would leave both unproven. Two-character
 * bodies, so a span can start INSIDE one row's body and end inside another's.
 */
const DOCUMENT = 'aa\n\tbb\n\tcc\ndd'

const mount = () => mountNestedRowDoc({defaultValue: DOCUMENT})

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
	return store.rows.selected().map(id => byId.get(id) ?? '?')
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
		const {store} = mountNestedRowDoc({defaultValue: 'aa\n\ncc'})

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

	/**
	 * A ROW'S END IS A BOUNDARY, NOT AN OFFSET, and this is the shape every selection the BROWSER
	 * forms has: Shift+ArrowDown from a row's start — and a mouse sweep down one line — lands the
	 * focus at the NEXT row's first typable position, so the span reads `[entry(bb), entry(cc)]`
	 * where a row gesture would have written `[entry(bb), end(bb)]`. Nothing separates the two but
	 * the separator and the next row's lead, which no caret may occupy.
	 *
	 * Compared against `end(bb)` alone this answered NO ROWS, and the gesture that then wrote over
	 * the raw span rather than through a row verb — typing — took the boundary with the text and
	 * merged `cc` into `bb`. See `keyboard/rowKeys.spec`'s type-over case for the write.
	 */
	it('holds a row whose selection ends at the NEXT row entry, which is the same boundary', () => {
		const {store} = mount()

		store.tokens.selection.select(store.tokens.anchorAt(4), store.tokens.anchorAt(8))
		expect(selectedSlots(store)).toEqual(['bb'])

		// AND STILL NOT A PARTIAL ONE: half of `bb` into the entry of `cc` names bytes of `bb` the
		// selection does not hold, so it stays a text selection.
		store.tokens.selection.select(store.tokens.anchorAt(5), store.tokens.anchorAt(8))
		expect(selectedSlots(store)).toEqual([])
	})

	/**
	 * AND THE OTHER EDGE IS A BOUNDARY TOO, which is what a row selection written across a row's own
	 * ELEMENT names: `{before}`/`{after}` resolve to `position.start` and `position.end`, and the
	 * first of those sits AHEAD of the row's lead and its opener. That is the pair a click on a
	 * frozen row writes (`TokenModel.#selectRow`) and the pair a Shift+arrow over one widens.
	 *
	 * Its own case because the storybook is where the shape occurs and core is where the rule lives:
	 * with the low edge left unresolved the whole core suite stayed green and three browser pins
	 * carried it alone.
	 */
	it('holds a row selected across its own ELEMENT, opener and separator included', () => {
		const {store} = mount()
		const bb = store.tokens.nodes()[0]
		if (bb.kind !== 'row') throw new Error('expected a row')
		const child = bb.rows()[0]

		store.tokens.selection.select({before: child}, {after: child})

		expect(selectedSlots(store)).toEqual(['bb'])
	})

	/**
	 * AN EMPTY ROW SWEPT OVER IS HELD, and it is the one shape where BOTH edges move: the span runs
	 * from the row above's content end to the row below's entry, and the row it names has no content
	 * of its own to reach.
	 */
	it('holds an empty row a sweep crossed, from the end above to the entry below', () => {
		const {store} = mountNestedRowDoc({defaultValue: 'aa\n\ncc'})

		store.tokens.selection.select(store.tokens.anchorAt(2), store.tokens.anchorAt(4))

		expect(selectedSlots(store)).toEqual([''])
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

	/**
	 * A SELECTION MAY SPAN TWO PARENTS, and then the widening rung's own parent — the FIRST covered
	 * row's — covers only part of what is held. Answering it verbatim drops every covered row
	 * outside it, so the answer is the union: Esc may climb, and may not lose a row.
	 */
	it('keeps the rows outside the parent it climbs to', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')
		press(store, container, 'ArrowDown', {shiftKey: true})
		press(store, container, 'ArrowDown', {shiftKey: true})
		expect(selectedSlots(store)).toEqual(['bb', 'cc', 'dd'])

		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['aa', 'dd'])
		expect(selectionRange(store)).toEqual({start: 0, end: 13})
	})

	/**
	 * Once every covered row is a root there is nothing above them, and the ENTRY rung is not a
	 * fallback for that: re-stating the anchor's own row would shrink a selection of two roots to
	 * one. The press does nothing and does not claim the key.
	 */
	it('leaves a root-level selection alone rather than falling back to the anchor row', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')
		press(store, container, 'ArrowDown', {shiftKey: true})
		press(store, container, 'ArrowDown', {shiftKey: true})
		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['aa', 'dd'])

		expect(press(store, container, 'Escape').defaultPrevented).toBe(false)
		expect(selectedSlots(store)).toEqual(['aa', 'dd'])
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

	/**
	 * The SAME deferral for the row menu, whose own Escape closes it from a `document`
	 * listener this container one runs before — so without the guard one press both dismissed the
	 * menu and row-selected underneath it, leaving the next character typed to replace the row.
	 */
	it('defers to an open row menu the same way', () => {
		const {store, container} = mount()
		const rows = store.tokens.nodes()
		caretAt(store, 5)
		store.rows.openMenu(rows[0].id, new DOMRect(0, 0, 24, 20))

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

	/**
	 * AT THE DOCUMENT'S EDGE THERE IS NOTHING TO ABSORB, and that is not the same "nothing" as no
	 * row selection: leaving the key native lets the browser move the focus end off the row
	 * boundary, which collapses the very selection the gesture was extending. The press consumes
	 * the key and changes nothing.
	 */
	it('consumes the key at both document edges rather than letting the browser take it', () => {
		const {store, container} = mount()
		caretAt(store, 1)
		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['aa'])

		expect(press(store, container, 'ArrowUp', {shiftKey: true}).defaultPrevented).toBe(true)
		expect(selectedSlots(store)).toEqual(['aa'])
		expect(selectionRange(store)).toEqual({start: 0, end: 10})

		caretAt(store, 12)
		press(store, container, 'Escape')
		expect(selectedSlots(store)).toEqual(['dd'])

		expect(press(store, container, 'ArrowDown', {shiftKey: true}).defaultPrevented).toBe(true)
		expect(selectedSlots(store)).toEqual(['dd'])
	})

	/**
	 * A DERIVED SELECTION HAS NO ESC IN IT, and this is the declared consequence: a plain text
	 * selection that happens to cover one row WHOLE already holds that row, so the next Shift+arrow
	 * is a row gesture. Nothing escalated it — "once a row selection stands" is a fact about the
	 * span, not a mode the user entered.
	 */
	it('is a row gesture from a text selection that covers a row whole, with no Esc', () => {
		const {store, container} = mountNestedRowDoc({defaultValue: 'aaa\nbbb\nccc'})
		store.tokens.selection.select(store.tokens.anchorAt(0), store.tokens.anchorAt(3))
		expect(store.rows.selected()).toHaveLength(1)

		expect(press(store, container, 'ArrowDown', {shiftKey: true}).defaultPrevented).toBe(true)
		expect(selectionRange(store)).toEqual({start: 0, end: 7})
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

	/**
	 * DECLARED BEHAVIOUR CHANGE. The first press used to take the whole value from a plain caret —
	 * one keystroke from wiping the document, by the gesture a user makes most often by reflex. It
	 * takes the caret's ROW now, which is the rung Esc has always had, and reaches everything on the
	 * way up rather than in one step.
	 */
	it('climbs from a plain caret: the row, then the row above it, then everything', () => {
		const {store, container} = mount()
		caretAt(store, 5)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(selectedSlots(store)).toEqual(['bb'])
		expect(store.tokens.selection.isAllSelected()).toBe(false)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(selectedSlots(store)).toEqual(['aa'])
		expect(store.tokens.selection.isAllSelected()).toBe(false)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})

	/** A ROOT row has nothing above it, so the second press is already the document. */
	it('reaches everything on the second press from a caret in a root row', () => {
		const {store, container} = mount()
		caretAt(store, 12)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(selectedSlots(store)).toEqual(['dd'])

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})

	/**
	 * AN EMPTY ROW HAS NO ROW RUNG, so the key falls straight through to select-all. Its content is
	 * zero-width, so the `'row'` scope answers a COLLAPSED span there — and a collapsed span was
	 * "widened" enough to consume the key and write nothing, which left `rowSelection` empty, left
	 * `entering` true forever, and made Mod+A permanently inert in the single most common transient
	 * state a row document has: every Enter opens one.
	 */
	it('takes the whole document from a caret in an EMPTY row, on the first press', () => {
		const {store, container} = mountNestedRowDoc({defaultValue: 'aa\n\ncc'})
		caretAt(store, 3)

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})

	/** The rung Esc shares, and it may not lose a row here either — a widening that narrows is not one. */
	it('never answers less than the selection it was given', () => {
		const {store, container} = mount()
		caretAt(store, 5)
		press(store, container, 'Escape')
		press(store, container, 'ArrowDown', {shiftKey: true})
		press(store, container, 'ArrowDown', {shiftKey: true})

		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(selectedSlots(store)).toEqual(['aa', 'dd'])
		expect(selectionRange(store)).toEqual({start: 0, end: 13})

		// And the rung above it still reaches the whole document.
		press(store, container, 'a', {code: 'KeyA', metaKey: true})
		expect(store.tokens.selection.isAllSelected()).toBe(true)
	})
})