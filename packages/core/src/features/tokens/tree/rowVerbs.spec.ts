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

/**
 * The same store CONTROLLED, with a parent echoing every `onChange` back into `value` — the mode
 * every adapter's controlled field runs in, and the one where a verb's own post-edit caret is
 * DECLINED (`TokenModel.#applyCaret`: the tree has not moved when the verb returns) and adoption's
 * window arithmetic answers instead. A caret claim made only against `rowStore` proves nothing
 * about it.
 */
const controlledRowStore = (value: string, options: CoreOption[] = []) => {
	const store = new Store()
	store.props.set({
		value,
		separator: '\n',
		Mark: () => null,
		options,
		onChange: next => store.props.set({value: next}),
	})
	store.host.container(document.createElement('div'))
	return store
}

/** A kind that CARVES its body, and the anonymous kind its pieces take — a table line and a cell. */
const CELL: CoreOption = {row: {Component: 'td'}}
const TABLE: CoreOption = {markup: '|__slot__', row: {Component: 'tr', continues: true, split: {at: ' | ', as: CELL}}}

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

describe('addSibling', () => {
	/**
	 * The lead is the whole verb. `insertAfter(separator)` spliced a bare separator at the anchor's
	 * span end, which is the start of the NEXT line, so the row it opened carried no indent and
	 * left the subtree — `'- parent\n\t- child\n- tail'` became a list cut in two.
	 */
	it('opens the row at the anchor row’s own depth', () => {
		const store = rowStore('a\n\tb\nc')
		const child = rowsOf(store)[1]

		expect(child.addSibling()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\t\nc')
		expect(rowsOf(store).map(row => row.lead())).toEqual(['', '\t', '\t', ''])
		// The fresh row's line is the lone '\t' at 5..6; its body is the zero-width text at 6.
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	/**
	 * PAST THE SUBTREE, which is where a row written at this row's lead can go without adopting
	 * its children — {@link RowNode.splitAt}'s placement rule, read for an insert.
	 */
	it('opens it after the whole subtree, not between the row and its children', () => {
		const store = rowStore('a\n\tb\n\t\tc\nz')
		const nested = rowsOf(store)[1]

		expect(nested.addSibling()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\t\tc\n\t\nz')
		// The fresh line is the lone '\t' at 9..10; the row's own child row would have answered 3.
		expect(selectionRange(store)).toEqual({start: 10, end: 10})
	})

	/**
	 * The document-final row owns no separator, so one has to be written BEFORE the lead: the
	 * other order leaves the lead inside that row's own body instead of opening a line.
	 */
	it('terminates the document-final row before opening the next', () => {
		const store = rowStore('a\n\tb')
		const child = rowsOf(store)[1]

		expect(child.addSibling()).toBe(true)

		expect(store.tokens.value()).toBe('a\n\tb\n\t')
		expect(rowsOf(store)).toHaveLength(3)
		expect(selectionRange(store)).toEqual({start: 6, end: 6})
	})

	/** A blank row, whatever the anchor's kind: whether a kind continues is Enter's question. */
	it('carries the depth and not the KIND', () => {
		const store = rowStore('# a\n\t# b', [{markup: '# __slot__', row: {Component: 'h1', continues: true}}])
		const child = rowsOf(store)[1]

		expect(child.addSibling()).toBe(true)

		expect(store.tokens.value()).toBe('# a\n\t# b\n\t')
		expect(rowsOf(store)[2].option()).toBeUndefined()
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
		// MEASURED COST, not a claim, and NOT the one bounding the in-slot walk answers — that
		// landed and this stayed green. The boundary is `{1,3}` and the merged-away child spans
		// `[2,8]`, so it is INSIDE the window: no positional bound can pair the grandchild's token
		// with the grandchild's node, because that node sits one level DOWN, inside the child the
		// merge is deleting, while its token is now a sibling of the survivor's own text. Only a
		// cross-level claim could say so, and `Pairing` is a permutation — equal lengths on both
		// sides — which a merge that removes a row cannot be.
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
	 * THE SAME CLAIM CONTROLLED, which is the mode a split's caret was never asserted in. The verb's
	 * own `#enterRow` is declined there and adoption's map answers instead — and the map collapses
	 * every anchor INSIDE a window onto the window's END, so the untrimmed line-plus-subtree window
	 * threw the caret to the END of the tail: `'hello'` split at 2 emitted the right value and then
	 * typed `Z` into `'he\nlloZ'`. This is `turnInto`'s P4 defect on the other verb, and it shows on
	 * the commonest structural gesture in the editor.
	 *
	 * Both spellings, because the opener is what a trim has to keep on the correct side: a plain
	 * row's tail starts at the separator, a bullet's starts past a fresh `'- '`.
	 */
	it('leaves the caret at the TAIL’S START in controlled mode', () => {
		const store = controlledRowStore('hello')
		const row = rowsOf(store)[0]
		caretAt(store, 2)

		expect(row.splitAt(inBody(row, 2))).toBe(true)

		expect(store.tokens.value()).toBe('he\nllo')
		expect(selectionRange(store)).toEqual({start: 3, end: 3})
	})

	it('leaves the caret past the TAIL’S OWN OPENER in controlled mode', () => {
		const store = controlledRowStore('- alpha beta', [bullet])
		const row = rowsOf(store)[0]
		caretAt(store, 8)

		expect(row.splitAt(inBody(row, 6))).toBe(true)

		expect(store.tokens.value()).toBe('- alpha \n- beta')
		expect(selectionRange(store)).toEqual({start: 11, end: 11})
	})

	/**
	 * THE BOUND ON THE TRIM, pinned so it cannot be widened by accident. A head that KEEPS a
	 * subtree writes two disjoint pieces, so the window is the whole bound and the caret lands at
	 * the tail's end — which at a row's END is the tail's start, because the tail is empty. Trimming
	 * this shape as well moved the caret BACKWARDS, to the head's end, and nothing else noticed.
	 */
	it('opens the tail past a kept subtree and puts the caret in it, in controlled mode', () => {
		const store = controlledRowStore('abcd\n\tchild\ntail')
		const row = rowsOf(store)[0]
		caretAt(store, 4)

		expect(row.splitAt(inBody(row, 4))).toBe(true)

		expect(store.tokens.value()).toBe('abcd\n\tchild\n\ntail')
		expect(selectionRange(store)).toEqual({start: 12, end: 12})
	})

	/** Enter at a row's START, where the empty head keeps the opener and the tail keeps the text. */
	it('leaves the caret in the TAIL when the head empties, in controlled mode', () => {
		const store = controlledRowStore('- alpha\ntail', [bullet])
		const row = rowsOf(store)[0]
		caretAt(store, 2)

		expect(row.splitAt(inBody(row, 0))).toBe(true)

		expect(store.tokens.value()).toBe('- \n- alpha\ntail')
		expect(selectionRange(store)).toEqual({start: 5, end: 5})
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
	 * MEASURED, not claimed: the split adds a row, so no {@link Pairing} can describe it
	 * (`resolvePairing` needs a total bijection) and identity rests on adoption's retention walk.
	 * The trimmed window makes this splice a bare INSERTION of the separator at the cut, so the
	 * row that keeps the CONTENT keeps its object and the empty head is the fresh one. It used to
	 * be the other way round — the whole line-plus-subtree window handed the caller's node to the
	 * empty row and re-minted the one carrying the text, taking its DOM element, its grip and every
	 * consumer subscription keyed on `node.id` with it.
	 */
	it('gives the SUBTREE to the tail when the head empties, and keeps it nested', () => {
		const store = rowStore('ab\n\tc\n\t\td')
		const root = rowsOf(store)[0]

		expect(root.splitAt(inBody(root, 0))).toBe(true)

		expect(store.tokens.value()).toBe('\nab\n\tc\n\t\td')
		const after = rowsOf(store)
		expect(after.length).toBe(4)
		expect(after[1]).toBe(root)
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
	 * A DEAD row is what a consumer holds after an edit removed it. Both plans check liveness by
	 * looking the node up in the live pre-order walk, and nothing downstream re-checks —
	 * `applyRange` takes a window, not a node.
	 *
	 * The FIRST row is the one that proves it. A dead LAST row's stale window points past the
	 * shortened document and the transaction's own bound refuses it anyway; a dead first row's
	 * window still lands on live bytes, so without these checks it rewrites the row that took its
	 * place — measured `'# cd'` for the retype and `'a⏎b'` for the split, from a node that is not
	 * in the document.
	 */
	it('refuses a retype and a split of a row that has been removed', () => {
		const heading: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}
		const store = rowStore('ab\ncd', [heading])
		const first = rowsOf(store)[0]
		const at = inBody(first, 1)

		expect(first.remove()).toBe(true)
		expect(store.tokens.value()).toBe('cd')

		expect(first.turnInto(heading)).toBe(false)
		expect(first.splitAt(at)).toBe(false)
		expect(store.tokens.value()).toBe('cd')
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

describe('moveTo', () => {
	/**
	 * The narrow splice, read at the value: only the lines between the source and the destination
	 * change, and the whole subtree travels with the row that was named.
	 */
	it('carries the subtree under a new parent and re-indents every descendant', () => {
		const store = rowStore('host\nmover\n\tkid\ntail')
		const [host, mover, kid, tail] = rowsOf(store)

		expect(mover.moveTo({parent: host, index: 0})).toBe(true)

		expect(store.tokens.value()).toBe('host\n\tmover\n\t\tkid\ntail')
		expect(rowsOf(store)).toEqual([host, mover, kid, tail])
		expect(host.rows()).toEqual([mover])
		expect(mover.rows()).toEqual([kid])
	})

	/**
	 * A DEPTH-CHANGING move still carries the selection through untouched, which is the answer to
	 * the one doubt this verb raised: re-indenting rewrites bytes inside the moved span, so the
	 * question was whether adoption's verified-move short-circuit still holds there. It does, and
	 * the reason is structural rather than lucky — a lead is the ROW's bytes and lives in no text
	 * node, so no anchor can name one, and the row's own text child keeps its object and its
	 * content. The alternative, mapping the offset through the window, is strictly worse: the
	 * caret sits INSIDE the window, where the map collapses every offset onto its end.
	 */
	it('keeps the caret on its character when the move changes the row depth', () => {
		const store = rowStore('parent\nmover\nother')
		const [parent, mover] = rowsOf(store)
		const text = mover.inline()[0]
		if (text.kind !== 'text') throw new Error('expected a row text child')
		store.tokens.selection.select({node: text, offset: 3})

		expect(mover.moveTo({parent, index: 0})).toBe(true)

		// The same character, one byte further along because a tab went in before it.
		expect(store.tokens.value()).toBe('parent\n\tmover\nother')
		expect(selectionRange(store)).toEqual({start: 11, end: 11})
		const anchor = store.tokens.selection.anchors()?.anchor
		if (!anchor || typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
		expect(anchor.node).toBe(text)
		expect(anchor.offset).toBe(3)
	})

	/**
	 * A row cannot become its own descendant, and the refusal is what keeps the document whole:
	 * the splice re-emits the affected span from the moved rows, so accepting it would emit the
	 * subtree inside itself.
	 */
	it('refuses a placement inside the moved subtree, and changes nothing', () => {
		const store = rowStore('a\n\tb\n\t\tc')
		const [root, child, grandchild] = rowsOf(store)

		expect(root.moveTo({parent: root, index: 0})).toBe(false)
		expect(root.moveTo({parent: child, index: 0})).toBe(false)
		expect(root.moveTo({parent: grandchild, index: 0})).toBe(false)

		expect(store.tokens.value()).toBe('a\n\tb\n\t\tc')
		expect(rowsOf(store)).toEqual([root, child, grandchild])
	})

	/**
	 * AN EMPTY ROW TAKES NO CHILDREN — the scan's own clamp — so a placement under one is not
	 * expressible at all: the written lead would parse back one level shallower and the row would
	 * land beside its intended parent instead of under it. Refused rather than written and
	 * silently demoted.
	 */
	it('refuses a placement under an empty row', () => {
		const store = rowStore('\nb')
		const [empty, row] = rowsOf(store)

		expect(row.moveTo({parent: empty, index: 0})).toBe(false)
		expect(store.tokens.value()).toBe('\nb')
	})

	/**
	 * The same clamp read at the MOVED row instead of the destination. A blank row is non-empty
	 * only while it carries an indent, so re-leading it to depth 0 turns it into the empty row
	 * that takes no children — and the subtree the move was carrying is promoted out of it. The
	 * emitted `'a⏎⏎⇥b'` parsed as three roots, with `b` beside the row it travelled with.
	 */
	it('refuses a move that would re-lead a row carrying children into an empty one', () => {
		const store = rowStore('a\n\t\n\t\tb')
		const [, blank, kid] = rowsOf(store)

		expect(blank.moveTo({parent: null, index: 1})).toBe(false)

		expect(store.tokens.value()).toBe('a\n\t\n\t\tb')
		expect(blank.rows()).toEqual([kid])
	})

	/**
	 * A SURPLUS lead — one asking for more depth than the clamp granted — is held down by the row
	 * before it and by nothing else, so a splice that raises that ceiling re-parents a row the
	 * caller never named. Both documents here reached it, one through the shipped root-level drag
	 * and one through a nested placement: `'x⏎⏎⇥⇥b'` emitted `'⏎x⏎⇥⇥b'`, where the untouched root
	 * `b` became `x`'s child, and `'p⏎⇥q⏎r⏎⇥⇥s'` emitted `r[p[q, s]]` instead of `r[p[q], s]`.
	 */
	it('refuses a move that would re-parse the row after the splice', () => {
		const flat = rowStore('x\n\n\t\tb')
		const [x, blank, b] = rowsOf(flat)

		expect(x.moveTo({parent: null, index: 1})).toBe(false)

		expect(flat.tokens.value()).toBe('x\n\n\t\tb')
		expect(rowsOf(flat)).toEqual([x, blank, b])

		const nested = rowStore('p\n\tq\nr\n\t\ts')
		const [p, q, r, s] = rowsOf(nested)

		expect(p.moveTo({parent: r, index: 0})).toBe(false)

		expect(nested.tokens.value()).toBe('p\n\tq\nr\n\t\ts')
		expect(rowsOf(nested)).toEqual([p, q, r, s])
		expect(r.rows()).toEqual([s])
	})

	/**
	 * Three refusals the verb's own docblock states and nothing exercised — each consumer-reachable
	 * through the published method, and two of them the difference between `false` and a TypeError:
	 * the planner destructures the row config, and it indexes the pre-order list by the position it
	 * found the parent at.
	 */
	it('answers false for a dead parent, a fractional index and a separatorless editor', () => {
		const store = rowStore('a\nb\nc')
		const [first, , third] = rowsOf(store)

		// A fractional index is IN range and names no sibling: `siblings[0.5]` is `undefined`, and
		// without the guard the run is spliced to the FRONT and the verb answers `true`.
		expect(third.moveTo({parent: null, index: 0.5})).toBe(false)

		expect(third.remove()).toBe(true)
		expect(first.moveTo({parent: third, index: 0})).toBe(false)
		expect(store.tokens.value()).toBe('a\nb')

		// An editor with no separator has no rows to rejoin and no row list to place into.
		store.props.set({separator: null})
		expect(first.moveTo({parent: null, index: 1})).toBe(false)
	})

	/**
	 * THE CARVED HALF of the clamp above: a row whose kind carves its body takes no children
	 * either, for the same reason an empty one does not — the scan reads its lead run and grants
	 * none. Its `rows()` are its own PIECES, so a placement naming it as the parent asks to become
	 * a cell, and the lead the splice would write parses back one level shallower.
	 */
	it('refuses a placement under a CARVED row, whose children are its own body', () => {
		const store = rowStore('| a | b\nx', [TABLE, CELL])
		const [line, , , x] = rowsOf(store)

		expect(x.moveTo({parent: line, index: 0})).toBe(false)
		expect(x.setDepth(1)).toBe(false)

		expect(store.tokens.value()).toBe('| a | b\nx')
		expect(line.rows().map(cell => cell.slot())).toEqual([' a', 'b'])
	})

	/**
	 * A MOVED table line keeps its own node AND its cells', which is the pairing read at a depth
	 * the pre-order walk must not descend into: the pieces of a carved row are not rows of the
	 * document, so counting them on the token side alone leaves the two sides of the bijection
	 * disagreeing, the pairing refused, and the moved lines re-labelled by index — byte-identical
	 * either way, which is why only an object oracle sees it.
	 */
	it('carries a carved row and its pieces through a move with their nodes', () => {
		const store = rowStore('| a | b\n| c | d', [TABLE, CELL])
		const [first, a, b, second, c, d] = rowsOf(store)

		expect(second.moveTo({parent: null, index: 0})).toBe(true)

		expect(store.tokens.value()).toBe('| c | d\n| a | b')
		expect(rowsOf(store)).toEqual([second, c, d, first, a, b])
	})

	/** With nesting off there is no indent unit to write a lead with, so only root moves exist. */
	it('refuses a nested placement when the editor has no indent', () => {
		const store = rowStore('a\nb')
		store.props.set({indent: ''})
		const [first, second] = rowsOf(store)

		expect(second.moveTo({parent: first, index: 0})).toBe(false)
		expect(second.moveTo({parent: null, index: 0})).toBe(true)
		expect(store.tokens.value()).toBe('b\na')
	})
})
/**
 * THE SET, which is `moveTo` widened to what a multi-row drag names and lowered onto the same
 * plan. One splice for the whole set is forced rather than preferred: two verbs cannot compose in
 * controlled mode, where the tree has not moved when the first returns, and a per-row move would
 * also expose intermediate documents the scan re-reads differently from either end state.
 */
describe('moveRows', () => {
	/**
	 * Rows picked up from DIFFERENT depths land side by side at ONE depth, in document order —
	 * the claim a set makes that no sequence of single moves states.
	 */
	it('lands every named row as a sibling of the others, keeping each subtree', () => {
		const store = rowStore('host\nalpha\n\tkid\nbeta\ntail')
		const [host, alpha, kid, beta, tail] = rowsOf(store)

		expect(store.tokens.moveRows([alpha, beta], {parent: host, index: 0})).toBe(true)

		expect(store.tokens.value()).toBe('host\n\talpha\n\t\tkid\n\tbeta\ntail')
		expect(rowsOf(store)).toEqual([host, alpha, kid, beta, tail])
		expect(host.rows()).toEqual([alpha, beta])
	})

	/**
	 * A row named together with its own ancestor travels INSIDE that ancestor's run, so the set it
	 * really names is the ancestors alone. Without the normalization the inner run is spliced a
	 * second time and the document grows a copy of it.
	 */
	it('normalizes a parent named with its own child to the parent alone', () => {
		const store = rowStore('a\n\tb\ntail')
		const [a, b, tail] = rowsOf(store)

		expect(store.tokens.moveRows([a, b], {parent: null, index: 1})).toBe(true)

		expect(store.tokens.value()).toBe('tail\na\n\tb')
		expect(rowsOf(store)).toEqual([tail, a, b])
	})

	/**
	 * A CARVED PIECE IS NOT A ROW OF THE DOCUMENT — the pre-order walk names none of them — so a
	 * cell cannot be dragged out of the line that carved it, alone or in company. That is the
	 * whole answer for what selecting and dragging mean inside a table line: the LINE moves, the
	 * cells travel with it, and a cell addresses nothing this splice can write.
	 */
	it('refuses a carved piece, on its own and inside a set', () => {
		const store = rowStore('| a | b\nx', [TABLE, CELL])
		const [line, cellA, , x] = rowsOf(store)

		expect(cellA.moveTo({parent: null, index: 0})).toBe(false)
		expect(store.tokens.moveRows([cellA, x], {parent: null, index: 0})).toBe(false)
		// And a carved row is no destination either, at either end of its own piece list.
		expect(x.moveTo({parent: line, index: 0})).toBe(false)
		expect(x.moveTo({parent: line, index: 2})).toBe(false)

		expect(store.tokens.value()).toBe('| a | b\nx')
		expect(rowsOf(store)).toEqual([line, cellA, line.rows()[1], x])
	})

	/** An empty set names no rows, so there is nothing to splice. */
	it('refuses an empty set', () => {
		const store = rowStore('a\nb')
		expect(store.tokens.moveRows([], {parent: null, index: 0})).toBe(false)
		expect(store.tokens.value()).toBe('a\nb')
	})
})

describe('dropPlacements', () => {
	/**
	 * THE FLOOR IS THE LINE THE MOVE LEAVES AFTER THE GAP, not the one standing there now — and the
	 * difference is the commonest drag there is: picking a row up and dropping it at its own gap to
	 * change only its depth. Reading the floor off the current list makes the row in flight its own
	 * outdent's obstacle, and the mover accepting the placement is the oracle that says so.
	 *
	 * Depth 1 is the placement `c` already holds, and it is offered like any other: it is the one
	 * the pointer passes through on the way, and a gap that cannot answer "leave it where it was"
	 * moves the row at every horizontal position.
	 */
	it('offers the depths a row in flight vacates, and the mover takes them', () => {
		const store = rowStore('a\n\tb\n\tc\nd')
		const [, b, c] = rowsOf(store)

		expect(store.tokens.dropPlacements([c], b, 'after').map(each => each.depth)).toEqual([0, 1, 2])
		expect(store.tokens.moveRows([c], {parent: null, index: 1})).toBe(true)
		expect(store.tokens.value()).toBe('a\n\tb\nc\nd')
	})

	/**
	 * The whole remainder of the gap may be in flight, and then the floor is the document's own.
	 * Depth 1 is where the pair already sits, offered for the reason above.
	 */
	it('offers root depth when every line after the gap is leaving', () => {
		const store = rowStore('a\n\tb\n\tc')
		const [a, b, c] = rowsOf(store)

		expect(store.tokens.dropPlacements([b, c], a, 'after').map(each => each.depth)).toEqual([0, 1])
		expect(store.tokens.moveRows([b, c], {parent: null, index: 1})).toBe(true)
		expect(store.tokens.value()).toBe('a\nb\nc')
	})

	/** A line that STAYS after the gap still holds the floor up, which is the rule's own half. */
	it('refuses to go shallower than a line that is not leaving', () => {
		const store = rowStore('a\n\tb\n\tc\nd\ne')
		const [, b, , , e] = rowsOf(store)

		// `c` stays and sits at depth 1, so the gap before it offers nothing shallower: root depth
		// there addresses the slot AFTER `a`'s whole subtree, which is not the gap pointed at.
		expect(store.tokens.dropPlacements([e], b, 'after').map(each => each.depth)).toEqual([1, 2])
	})
})