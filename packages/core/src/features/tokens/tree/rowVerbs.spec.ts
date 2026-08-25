import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import {selectionRange} from '../__testing__/mountFixtures'
import type {RowNode, TreeNode} from './types'

/**
 * THE row verbs under nesting, and every case here is stated over a NESTED document on purpose.
 * On a flat one the same assertions pass while proving nothing: a row's span then covers only its
 * own line, so the whole-node splice every verb used to take is already the right window and index
 * pairing alone carries the ids.
 *
 * Two oracles per verb, and neither implies the other. The VALUE says the bytes are right; the
 * OBJECTS say the verb addressed the row the caller named. A verb that re-mints a surviving row's
 * node while emitting the right string takes the caret, the DOM element, the drag grip and every
 * consumer subscription keyed on `node.id` with it, and only an identity assertion sees that.
 */

const rowStore = (defaultValue: string, options: CoreOption[] = []) => {
	const store = new Store()
	store.props.set({defaultValue, separator: '\n', Mark: () => null, options})
	store.host.container(document.createElement('div'))
	return store
}

/** Every row in the document, in pre-order — the space the verbs and the projection both speak. */
const rowsOf = (store: Store): RowNode[] => {
	const out: RowNode[] = []
	const collect = (node: TreeNode): void => {
		if (node.kind !== 'row') return
		out.push(node)
		node.rows().forEach(collect)
	}
	store.tokens.nodes().forEach(collect)
	return out
}

describe('remove', () => {
	/**
	 * The document-final row is the last row in PRE-ORDER, and under nesting that is not the last
	 * ROOT — the last root is its ancestor. Reading the root list left a nested final row's own
	 * span as the whole plan, which converts it into the trailing empty row instead of removing it.
	 */
	it('takes the boundary before a NESTED document-final row with it', () => {
		const store = rowStore('a\n\tb')
		const [root, child] = rowsOf(store)

		expect(child.remove()).toBe(true)

		expect(store.tokens.value()).toBe('a')
		expect(rowsOf(store)).toEqual([root])
		expect(selectionRange(store)).toEqual({start: 1, end: 1})
	})

	it('removes a nested row WITH its subtree, and keeps every row outside it', () => {
		const store = rowStore('a\n\tb\n\t\tc\nd')
		const [first, nested, , last] = rowsOf(store)

		expect(nested.remove()).toBe(true)

		expect(store.tokens.value()).toBe('a\nd')
		expect(rowsOf(store)).toEqual([first, last])
	})

	it('refuses the only row of an empty document', () => {
		const store = rowStore('')

		expect(rowsOf(store)[0].remove()).toBe(false)
		expect(store.tokens.value()).toBe('')
	})
})

describe('duplicate', () => {
	/**
	 * A copy of the document-final row needs a separator put back in front of it, and "final" is
	 * again a pre-order question: reading the root list fused the copies of a NESTED final row into
	 * one row.
	 */
	it('does not fuse the copies of a NESTED document-final row', () => {
		const store = rowStore('a\n\tb')
		const [root, child] = rowsOf(store)

		expect(child.duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\tb')
		const after = rowsOf(store)
		expect(after.length).toBe(3)
		expect([after[0], after[1]]).toEqual([root, child])
		expect(after[2]).not.toBe(child)
	})

	it('copies a row WITH its subtree, at its own depth', () => {
		const store = rowStore('a\n\tb\n\t\tc\nd')
		const [first, nested, grand, last] = rowsOf(store)

		expect(nested.duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\t\tc\n\tb\n\t\tc\nd')
		const after = rowsOf(store)
		expect([after[0], after[1], after[2], after[5]]).toEqual([first, nested, grand, last])
	})

	it('duplicates the LAST ROOT, whose subtree also ends the document', () => {
		const store = rowStore('a\n\tb')
		const [root, child] = rowsOf(store)

		expect(root.duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\na\n\tb')
		expect(rowsOf(store).slice(0, 2)).toEqual([root, child])
	})
})

describe('insertAfter', () => {
	/**
	 * The caret used to be named by ROOT index, so a nested anchor answered `-1` and the caret
	 * never moved into the row the verb had just created — the slash menu's whole insert gesture
	 * on a nested row.
	 */
	it('puts the caret in the fresh row when the anchor is NESTED', () => {
		const store = rowStore('a\n\tb')
		const child = rowsOf(store)[1]

		expect(child.insertAfter('\n\tc')).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\tc')
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	/**
	 * The insertion point is the anchor's SPAN end, which under nesting is past every descendant,
	 * so the row that follows a parent is the one after its LAST one. Naming the row one past the
	 * anchor instead puts the caret in the anchor's own first child.
	 */
	it('names the row after the anchor SUBTREE, not the one after its line', () => {
		const store = rowStore('a\n\tb\n\t\tc\nz')
		const nested = rowsOf(store)[1]

		expect(nested.insertAfter('\tfresh\n')).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\t\tc\n\tfresh\nz')
		// The fresh row's body starts at 10; the anchor's own child row would have answered 7.
		expect(selectionRange(store)).toEqual({start: 10, end: 10})
	})

	it('lands INSIDE a typed row slot at depth, not before its opener', () => {
		const store = rowStore('# a\n\t# b\n\t# c', [{markup: '# __slot__', row: {Component: 'h1'}}])
		const child = rowsOf(store)[1]

		expect(child.insertAfter('\t# \n')).toBe(true)

		expect(store.tokens.value()).toBe('# a\n\t# b\n\t# \n\t# c')
		// The fresh row spans [9,13]; its slot is the zero-width text at 12, past the '# '.
		expect(selectionRange(store)).toEqual({start: 12, end: 12})
	})
})

describe('mergeWith', () => {
	/**
	 * A parent's boundary is with its FIRST CHILD, whose span begins INSIDE the parent's own —
	 * so the span-adjacency test refused every parent/child pair, which is every Backspace at the
	 * start of an indented row.
	 */
	it('merges a parent with its first CHILD', () => {
		const store = rowStore('a\n\tb\n\t\tc')
		const [root, child, grand] = rowsOf(store)

		expect(root.mergeWith(child)).toBe(true)

		// The grandchild re-parents onto the survivor at the clamp, keeping its surplus indent.
		expect(store.tokens.value()).toBe('ab\n\t\tc')
		expect(selectionRange(store)).toEqual({start: 1, end: 1})

		const after = rowsOf(store)
		expect(after.length).toBe(2)
		expect(after[0]).toBe(root)
		// MEASURED COST, not a claim: the grandchild shifts up one slot in the parent's child
		// list, and in-slot pairing is unbounded index pairing (`adopt.ts`), so the node that
		// continues as the grandchild is the merged-away CHILD's. Bounding that walk is P9's,
		// and this is the pin that turns red when it lands.
		expect(after[1]).toBe(child)
		expect(after[1]).not.toBe(grand)
	})

	/**
	 * The next row's OPENER leaves with the boundary, because the lead and the opener are one
	 * structural run with no anchor between them. Keeping it turned the merged row's markup into
	 * literal text — `'a# b'` — where the Backspace boundary at the same place answered `'ab'`.
	 */
	it('takes the next row KIND with the boundary, so the survivor keeps its own', () => {
		const heading: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}
		const into = rowStore('a\n# b', [heading])
		const from = rowStore('# a\nb', [heading])

		expect(rowsOf(into)[0].mergeWith(rowsOf(into)[1])).toBe(true)
		expect(rowsOf(from)[0].mergeWith(rowsOf(from)[1])).toBe(true)

		expect(into.tokens.value()).toBe('ab')
		expect(from.tokens.value()).toBe('# ab')
	})

	it('refuses a pair that is not adjacent in pre-order', () => {
		const store = rowStore('a\n\tb\nc')
		const [root, , last] = rowsOf(store)

		expect(root.mergeWith(last)).toBe(false)
		expect(store.tokens.value()).toBe('a\n\tb\nc')
	})
})