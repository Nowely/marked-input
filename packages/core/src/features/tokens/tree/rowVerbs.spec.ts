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