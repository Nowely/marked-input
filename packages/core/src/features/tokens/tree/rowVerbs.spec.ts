import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import {caretAt, selectionRange} from '../__testing__/mountFixtures'
import type {NodeAnchor, RowNode, TreeNode} from './types'

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

/** The anchor at `offset` inside a row's own body, which is what a caret in that row is. */
const inBody = (row: RowNode, offset: number): NodeAnchor => {
	const text = row.inline()[0]
	if (text.kind !== 'text') throw new Error('expected a row text child')
	return {node: text, offset}
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

	/**
	 * A removal takes the row's whole SUBTREE, so the row that owns no trailing separator is not
	 * only the pre-order LAST one — every ancestor of it owns none either. Testing the leaf alone
	 * sent the last root with children down the plain structural splice, which leaves the boundary
	 * before it dangling and turns it into the trailing empty row.
	 */
	it('takes the boundary before the last ROOT, whose subtree ends the document', () => {
		const store = rowStore('a\nb\n\tc')
		const [first, root] = rowsOf(store)

		expect(root.remove()).toBe(true)

		expect(store.tokens.value()).toBe('a')
		expect(rowsOf(store)).toEqual([first])
	})

	it('refuses the only row of an empty document', () => {
		const store = rowStore('')

		expect(rowsOf(store)[0].remove()).toBe(false)
		expect(store.tokens.value()).toBe('')
	})

	/**
	 * The document's first row has no boundary in front of it, so the plan declines and the plain
	 * structural splice takes the row's own span — which is the whole document here. Stated over a
	 * NON-empty document: on the empty one the downstream `start === end` refusal answers `false`
	 * whether the guard is there or not.
	 */
	it('clears the document when the only row is the first one', () => {
		const store = rowStore('a')

		expect(rowsOf(store)[0].remove()).toBe(true)
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
describe('turnInto', () => {
	const heading: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}
	const todo: CoreOption = {markup: '- [__meta__] __slot__', row: {Component: 'li'}}

	/**
	 * THE identity claim a retype exists for: the splice is the row's own LINE, so the child rows
	 * are outside it and the row itself is adopted kind-blind. Splicing its `position` instead —
	 * the whole-node window every other structural verb takes — would delete the children outright.
	 */
	it('retypes a row with two children and keeps all three objects', () => {
		const store = rowStore('a\n\tb\n\tc', [heading])
		const [root, first, second] = rowsOf(store)
		const body = root.inline()[0]

		expect(root.turnInto(heading)).toBe(true)

		expect(store.tokens.value()).toBe('# a\n\tb\n\tc')
		expect(rowsOf(store)).toEqual([root, first, second])
		expect(root.inline()[0]).toBe(body)
	})

	it('keeps a nested row LEAD, which the window starts past', () => {
		const store = rowStore('a\n\t# b', [heading])
		const child = rowsOf(store)[1]

		expect(child.turnInto(undefined)).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb')
		expect(rowsOf(store)[1]).toBe(child)
	})

	/**
	 * Ticket 11's gesture: a row that already reads `'plain row/'` becomes a heading whose body is
	 * the text minus the trigger, in ONE splice. Two verbs could not do it — the intermediate
	 * state is a document the parse would see and the caret would be repaired against.
	 */
	it('takes the new body TEXT, so a strip-and-retype is one splice', () => {
		const store = rowStore('a\n\tplain row/', [heading])
		const child = rowsOf(store)[1]

		expect(child.turnInto(heading, {text: 'plain row'})).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t# plain row')
		expect(rowsOf(store)[1]).toBe(child)
	})

	/** The showcase's checkbox: only the kind's meta moves, and the body is byte-identical. */
	it('sets, keeps and clears META without touching the body', () => {
		const store = rowStore('a\n\t- [ ] task', [todo])
		const child = rowsOf(store)[1]

		expect(child.turnInto(todo, {meta: 'x'})).toBe(true)
		expect(store.tokens.value()).toBe('a\n\t- [x] task')

		expect(child.turnInto(todo, {text: 'done'})).toBe(true)
		expect(store.tokens.value()).toBe('a\n\t- [x] done')

		expect(child.turnInto(todo, {meta: null})).toBe(true)
		expect(store.tokens.value()).toBe('a\n\t- [] done')
		expect(rowsOf(store)[1]).toBe(child)
	})

	/**
	 * A retype leaves the body alone, so the caret has to keep naming the character it named —
	 * shifted by the structural delta and nothing more. The window is what decides it: adoption
	 * collapses every anchor INSIDE a window onto the window's end, so a window spanning the body
	 * put the caret at the row's end on every heading retype and every checkbox toggle.
	 */
	it('leaves the caret on its own character, moved by the structural delta', () => {
		const store = rowStore('a\n\tbcdef', [heading])
		const child = rowsOf(store)[1]
		caretAt(store, 4)

		expect(child.turnInto(heading)).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t# bcdef')
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	it('does not move the caret at all when only META changes', () => {
		const store = rowStore('- [ ] task', [todo])
		const row = rowsOf(store)[0]
		caretAt(store, 8)

		expect(row.turnInto(todo, {meta: 'x'})).toBe(true)

		expect(store.tokens.value()).toBe('- [x] task')
		expect(selectionRange(store)).toEqual({start: 8, end: 8})
	})

	it('types an EMPTY nested row, which is the slash menu insert gesture', () => {
		const store = rowStore('a\n\t', [heading])
		const child = rowsOf(store)[1]

		expect(child.turnInto(heading)).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t# ')
		expect(rowsOf(store)[1]).toBe(child)
	})

	it('retypes a RAW body, which the parse never re-enters', () => {
		const table: CoreOption = {markup: '|__value__', row: {Component: 'div'}}
		const store = rowStore('a\n\tx | y', [table])
		const child = rowsOf(store)[1]

		expect(child.turnInto(table)).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t|x | y')
		expect(rowsOf(store)[1]).toBe(child)
		expect(child.slot()).toBe('x | y')
	})

	/**
	 * A kind is not a markup a caller may invent: an option this editor compiles no row kind from
	 * would write bytes the scan reads back as a paragraph, so the verb declines instead.
	 */
	it('refuses a mark option, an unregistered markup and a no-op', () => {
		const mark: CoreOption = {markup: '**__slot__**'}
		const foreign: CoreOption = {markup: '> __slot__', row: {Component: 'blockquote'}}
		const store = rowStore('# a', [heading, mark])
		const row = rowsOf(store)[0]

		expect(row.turnInto(mark)).toBe(false)
		expect(row.turnInto(foreign)).toBe(false)
		expect(row.turnInto(heading)).toBe(false)
		expect(store.tokens.value()).toBe('# a')
	})

	/**
	 * The option is resolved by its MARKUP, not by object identity — because the object a consumer
	 * holds is not always the object the store holds. The Vue adapter rebuilds every option on
	 * every prop sync (`MarkedInput.vue`'s `options: props.options?.map(opt => ({...opt, …}))`),
	 * so a reference lookup answered `-1` there and this verb returned `false` in Vue for the
	 * consumer code that returns `true` in React.
	 */
	it('resolves an option the adapter re-built, which is every option in Vue', () => {
		const store = rowStore('a', [heading])
		store.props.set({options: [{...heading, row: {...heading.row!}}]})

		expect(rowsOf(store)[0].turnInto(heading)).toBe(true)
		expect(store.tokens.value()).toBe('# a')
	})

	/**
	 * The scan orders its kinds by OPENER LENGTH so `'- [ ] x'` is read as a todo and not as a
	 * bullet with a bracket, which means a kind's position in the scan's list is not its option's
	 * index. Every other row spec in the repo registers ONE row option, where the two agree.
	 */
	it('picks the right kind when two are registered and the scan reorders them', () => {
		const bullet: CoreOption = {markup: '- __slot__', row: {Component: 'li'}}
		const todo: CoreOption = {markup: '- [__meta__] __slot__', row: {Component: 'li'}}
		const store = rowStore('x\ny', [bullet, todo])
		const [first, second] = rowsOf(store)

		expect(first.turnInto(bullet)).toBe(true)
		expect(second.turnInto(todo, {meta: ' '})).toBe(true)

		expect(store.tokens.value()).toBe('- x\n- [ ] y')
	})

	/** Declared, not fixed: the reparse owns the answer, exactly as it does for a merge. */
	it('lets the reparse decide, so a body carrying the separator becomes two rows', () => {
		const store = rowStore('a')

		expect(rowsOf(store)[0].turnInto(undefined, {text: 'x\ny'})).toBe(true)

		expect(store.tokens.value()).toBe('x\ny')
		expect(rowsOf(store).length).toBe(2)
	})

	/**
	 * The one case where "the child rows are untouched" is FALSE, and it is the encoding rather
	 * than the splice: a paragraph at depth 0 with an empty body is an empty LINE, an empty row
	 * takes no children (`depthCeiling`), and the scan promotes them. Nothing the verb can write
	 * expresses an empty parent — `splitAt` meets the same wall and gives the subtree to its tail.
	 * The surplus indent survives verbatim in each promoted child's `lead`.
	 */
	it('promotes the children of a row it empties, which the encoding cannot avoid', () => {
		const store = rowStore('# \n\tb\nz', [heading])
		const [root, , last] = rowsOf(store)

		expect(root.turnInto(undefined)).toBe(true)

		expect(store.tokens.value()).toBe('\n\tb\nz')
		const after = rowsOf(store)
		expect(after.map(row => row.slot())).toEqual(['', 'b', 'z'])
		expect(after.map(row => row.rows().length)).toEqual([0, 0, 0])
		expect(after[1].lead()).toBe('\t')
		expect([after[0], after[2]]).toEqual([root, last])
	})
})
describe('splitAt', () => {
	const bullet: CoreOption = {markup: '- __slot__', row: {Component: 'li', continues: true}}
	const heading: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}

	it('leaves the head, opens the tail, and puts the caret in it', () => {
		const store = rowStore('a\n\tbcd')
		const child = rowsOf(store)[1]

		expect(child.splitAt(inBody(child, 2))).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tbc\n\td')
		expect(rowsOf(store)[1]).toBe(child)
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
	})

	/**
	 * A row written directly under a parent AT THE PARENT'S LEAD adopts every child the parent
	 * has, because nesting is indentation and nothing else — so the tail lands past the subtree
	 * and the split re-parents nothing. Every surviving row keeps its object across it: the
	 * descendants are re-emitted at the same indices in the row's child list.
	 */
	it('never re-parents the head CHILDREN: the tail follows the whole subtree', () => {
		const store = rowStore('ab\n\tc\n\t\td')
		const [root, child, grand] = rowsOf(store)

		expect(root.splitAt(inBody(root, 1))).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tc\n\t\td\nb')
		const after = rowsOf(store)
		expect([after[0], after[1], after[2]]).toEqual([root, child, grand])
		expect(after.length).toBe(4)
		expect(selectionRange(store)).toEqual({start: 9, end: 9})
	})

	it('gives the tail THIS kind when the kind continues, and a plain row when it does not', () => {
		const list = rowStore('a\n\t- bc', [bullet])
		const title = rowStore('a\n\t# bc', [heading])

		expect(rowsOf(list)[1].splitAt(inBody(rowsOf(list)[1], 1))).toBe(true)
		expect(rowsOf(title)[1].splitAt(inBody(rowsOf(title)[1], 1))).toBe(true)

		expect(list.tokens.value()).toBe('a\n\t- b\n\t- c')
		expect(title.tokens.value()).toBe('a\n\t# b\n\tc')
	})

	/**
	 * A continuing kind carries its META into the tail with it, so splitting a checked to-do gives
	 * two checked to-dos. Declared rather than derived: `continues` says "the tail gets the same
	 * kind" and meta is not kind, so the reading is stated here and can be argued with.
	 */
	it('carries the kind META into the tail of a continuing row', () => {
		const todo: CoreOption = {markup: '- [__meta__] __slot__', row: {Component: 'li', continues: true}}
		const store = rowStore('- [x] ab', [todo])
		const row = rowsOf(store)[0]

		expect(row.splitAt(inBody(row, 1))).toBe(true)

		expect(store.tokens.value()).toBe('- [x] a\n- [x] b')
	})

	it('splits at the row START, which pushes the row down under an empty one', () => {
		const store = rowStore('a\n\t- b', [bullet])
		const child = rowsOf(store)[1]

		expect(child.splitAt(inBody(child, 0))).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t- \n\t- b')
	})

	/**
	 * Enter at the start of a PLAIN row that has children, where the head empties. An empty row
	 * takes no children (`depthCeiling`), so the subtree cannot stay under the head: written there
	 * it clamps to depth 0 and the tail lands below its own former children — `'⏎⇥c⏎⇥⇥d⏎ab'`. The
	 * subtree follows the TAIL instead, and the nesting survives.
	 *
	 * MEASURED COST, not a claim: the split adds a row, so no {@link Pairing} can describe it
	 * (`resolvePairing` needs a total bijection) and identity rests on adoption's index pairing —
	 * which hands the caller's node to the EMPTY row and re-mints the one that carries the content.
	 * Stated so the pin turns red if it ever stops being true.
	 */
	it('gives the SUBTREE to the tail when the head empties, and keeps it nested', () => {
		const store = rowStore('ab\n\tc\n\t\td')
		const root = rowsOf(store)[0]

		expect(root.splitAt(inBody(root, 0))).toBe(true)

		expect(store.tokens.value()).toBe('\nab\n\tc\n\t\td')
		const after = rowsOf(store)
		expect(after.length).toBe(4)
		expect(after[0]).toBe(root)
		expect(after[1].slot()).toBe('ab')
		expect(after[1].rows().map(row => row.slot())).toEqual(['c'])
		expect(selectionRange(store)).toEqual({start: 1, end: 1})
	})

	it('splits the document-final row, which has no separator of its own', () => {
		const store = rowStore('ab')
		const row = rowsOf(store)[0]

		expect(row.splitAt(inBody(row, 1))).toBe(true)

		expect(store.tokens.value()).toBe('a\nb')
		expect(rowsOf(store)[0]).toBe(row)
	})

	it('refuses an anchor that is not in this row own body', () => {
		const store = rowStore('a\nb')
		const [first, second] = rowsOf(store)

		expect(first.splitAt(inBody(second, 0))).toBe(false)
		expect(first.splitAt('end')).toBe(false)
		expect(store.tokens.value()).toBe('a\nb')
	})
})
/**
 * The inputs a verb meets once and gets wrong forever. Each one is a shape the flat world could
 * not produce, so none of them is covered by the per-verb cases above.
 */
describe('awkward inputs', () => {
	/**
	 * A re-parented row keeps its OBJECT (that is P3's whole mechanism) while its `position` and
	 * `lead` are rewritten under it by adoption — so a verb that cached anything off the node
	 * before the Tab would splice against a document that no longer exists.
	 */
	it('answers for a row that has just been re-parented by a Tab', () => {
		const store = rowStore('a\nb\nc')
		const [first, second, third] = rowsOf(store)

		expect(second.setDepth(1)).toBe(true)
		expect(store.tokens.value()).toBe('a\n\tb\nc')

		expect(second.duplicate()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\tb\nc')
		const after = rowsOf(store)
		expect([after[0], after[1], after[3]]).toEqual([first, second, third])
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	it('splits an EMPTY nested row into two empty rows', () => {
		const store = rowStore('a\n\t')
		const child = rowsOf(store)[1]

		expect(child.splitAt('start')).toBe(false)
		expect(child.splitAt(inBody(child, 0))).toBe(true)

		expect(store.tokens.value()).toBe('a\n\t\n\t')
		expect(rowsOf(store).length).toBe(3)
	})

	/**
	 * The document-final row is UNTERMINATED — it owns no separator — and every verb that writes
	 * one has to put it back on the correct side. Read at depth 0, where the row is also the last
	 * sibling and the last root.
	 */
	it('writes the missing separator on the correct side of the final row', () => {
		const store = rowStore('a\nb')
		const last = rowsOf(store)[1]

		expect(last.duplicate()).toBe(true)
		expect(store.tokens.value()).toBe('a\nb\nb')

		expect(rowsOf(store)[2].remove()).toBe(true)
		expect(store.tokens.value()).toBe('a\nb')
	})
})