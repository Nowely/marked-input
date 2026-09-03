import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../shared/types'
import {Store} from '../../store/Store'
import type {RowNode, TreeNode} from '../tokens'
import {anchorsAt, caretAt, selectionRange} from '../tokens/__testing__/mountFixtures'

/**
 * THE ROW MENU. Its subject is the gesture a slash menu IS — one keystroke opens it, one click
 * turns the caret's row into a kind — and the whole point of the phase is that neither half is
 * written by a consumer: the rows come from the options, and the write is one splice through
 * `turnInto`.
 *
 * Every case types the `/` the way a user does, rather than setting a match by hand: the trigger
 * span is what `choose` has to remove, so a stubbed match would prove nothing about the removal.
 */

const HEADING: CoreOption = {
	markup: '# __slot__',
	row: {Component: 'h1'},
	menu: {label: 'Heading 1', keywords: ['h1', 'title']},
}
const BULLET: CoreOption = {
	markup: '- __slot__',
	row: {Component: 'li', continues: true, indents: true},
	menu: {label: 'Bulleted list', keywords: ['ul']},
}
const TABLE: CoreOption = {
	markup: '|__value__',
	row: {Component: 'table'},
	menu: {label: 'Table', text: 'Task | Status | Owner'},
}
/** A kind with a META gap, which is what `menu.meta` exists to seed. */
const TODO: CoreOption = {
	markup: '- [__meta__] __slot__',
	row: {Component: 'li', continues: true},
	menu: {label: 'To-do list', keywords: ['task', 'check'], meta: 'x'},
}
/** The option that owns the trigger, and it declares no markup: it inserts nothing itself. */
const SLASH: CoreOption = {overlay: {trigger: '/'}}

const MENU_OPTIONS = [SLASH, HEADING, BULLET, TABLE, TODO]

/** A row document with a caret at `offset` and a `/` typed there — what an open slash menu IS. */
function typedSlash(value: string, offset: number, options: CoreOption[] = MENU_OPTIONS) {
	const store = new Store()
	store.props.set({defaultValue: value, separator: '\n', indent: '\t', Mark: () => null, options})
	store.host.container(document.createElement('div'))
	caretAt(store, offset)
	store.edit.replace(...anchorsAt(store, offset, offset), '/')
	return store
}

/** Every row in the document, in pre-order — the space the value and the verbs both speak. */
function rowsOf(store: Store): RowNode[] {
	const out: RowNode[] = []
	const collect = (node: TreeNode): void => {
		if (node.kind !== 'row') return
		out.push(node)
		node.rows().forEach(collect)
	}
	store.tokens.nodes().forEach(collect)
	return out
}

describe('the row menu rows', () => {
	it('is assembled from the options that declare a menu, in option order', () => {
		const store = typedSlash('plain row', 9)

		expect(store.overlay.list.rows().map(row => row.label)).toEqual([
			'Heading 1',
			'Bulleted list',
			'Table',
			'To-do list',
		])
	})

	it('carries the option itself, which is what `choose` names a kind by', () => {
		const store = typedSlash('plain row', 9)

		expect(store.overlay.list.rows()[0].pick.option).toBe(HEADING)
	})

	it('has no rows at all with no overlay open', () => {
		const store = typedSlash('plain row', 9)

		store.overlay.close()

		expect(store.overlay.list.rows()).toEqual([])
	})

	/**
	 * The query pass is `filterSuggestions`, so it is the same rule the built-in suggestion list
	 * runs — over the label AND the entry's hidden keywords, which is how `h1` reaches Heading 1.
	 */
	it('narrows to what was typed after the trigger, by label or by a hidden keyword', () => {
		const store = typedSlash('', 0)

		store.edit.replace(...anchorsAt(store, 1, 1), 'ul')

		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Bulleted list'])
	})

	it('narrows by a keyword that appears in no label', () => {
		const store = typedSlash('', 0)

		store.edit.replace(...anchorsAt(store, 1, 1), 'h1')

		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Heading 1'])
	})

	/**
	 * A LABEL IS TYPEABLE IN FULL, hyphen, space and all — the query's alphabet is the labels', not
	 * `\w`. Typed character by character, because the defect was in what each keystroke left of the
	 * MATCH: `/To` narrowed to one row, and the very next `-` closed the menu outright, so every
	 * multi-word entry the row menu offers could only be reached by stopping at the first word and
	 * arrowing. Asserted at every step, since the row list alone reads the same whether the menu is
	 * open on `To-do` or has fallen back to nothing.
	 */
	it('keeps narrowing through the hyphen and the space of a multi-word label', () => {
		const store = typedSlash('', 0)
		const typed: [string, string[]][] = []

		for (const [index, character] of Array.from('To-do list').entries()) {
			store.edit.replace(...anchorsAt(store, index + 1, index + 1), character)
			typed.push([store.overlay.match()?.value ?? '<closed>', store.overlay.list.rows().map(row => row.label)])
		}

		expect(typed.at(-1)).toEqual(['To-do list', ['To-do list']])
		expect(typed.map(([query]) => query)).toEqual([
			'T',
			'To',
			'To-',
			'To-d',
			'To-do',
			'To-do ',
			'To-do l',
			'To-do li',
			'To-do lis',
			'To-do list',
		])
	})

	/**
	 * AND THE TRIGGER NEAREST THE CARET IS STILL THE ONE THAT OPENS. The query may hold spaces now,
	 * so it may not be a plain greedy run: read leftmost-first, `'/a /b'` would query `'a /b'` and
	 * the menu would narrow on text the user typed before ever opening it.
	 */
	it('opens on the LAST trigger left of the caret, not the first', () => {
		const store = typedSlash('', 0)

		store.edit.replace(...anchorsAt(store, 1, 1), 'x /ul')

		expect(store.overlay.match()?.value).toBe('ul')
		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Bulleted list'])
	})

	/**
	 * A query nothing matches is what the narrow alphabet was really doing, and it needs no
	 * alphabet: the list empties, `consumes` declines every key for an empty list, and both
	 * adapters' built-in list paints nothing.
	 */
	it('offers nothing, and claims no key, for a query no entry matches', () => {
		const store = typedSlash('', 0)

		store.edit.replace(...anchorsAt(store, 1, 1), 'nothing at all')

		expect(store.overlay.list.rows()).toEqual([])
		expect(store.overlay.list.consumes('Enter')).toBe(false)
		expect(store.overlay.list.consumes('ArrowDown')).toBe(false)
	})

	/**
	 * AN EXACT MATCH IS THE FIRST ROW, whatever the option array's order. Enter picks the first row
	 * (`OverlayListModel.active`), so declaration order was a WRONG COMMIT on the first try, not
	 * merely an odd list: measured on the Notion showcase, `/table` gave **Table of contents**.
	 *
	 * `Table of contents` is declared BEFORE `Table` here for the same reason the showcase declares
	 * it first — a longer opener wins the parse whatever the order — so the case would pass on
	 * declaration order alone if it were declared the other way round.
	 */
	it('ranks an exact label match above a prefix of a longer one', () => {
		const toc: CoreOption = {markup: '@toc __slot__', row: {Component: 'nav'}, menu: {label: 'Table of contents'}}
		const store = typedSlash('', 0, [SLASH, toc, TABLE])

		store.edit.replace(...anchorsAt(store, 1, 1), 'table')

		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['Table', 'Table of contents'])
	})

	/**
	 * A HIDDEN KEYWORD RANKS BELOW EVERY LABEL, because a keyword is not what the user is reading.
	 * `/to` matched **Table of contents** through its `toc` keyword and offered it first, ahead of
	 * two entries whose own labels start with what was typed.
	 */
	it('ranks a label match above a keyword match', () => {
		const toc: CoreOption = {
			markup: '@toc __slot__',
			row: {Component: 'nav'},
			menu: {label: 'Table of contents', keywords: ['toc']},
		}
		const store = typedSlash('', 0, [SLASH, toc, TODO])

		store.edit.replace(...anchorsAt(store, 1, 1), 'to')

		expect(store.overlay.list.rows().map(row => row.label)).toEqual(['To-do list', 'Table of contents'])
	})

	/** An empty query reorders nothing: every row lands in one band and the sort is stable. */
	it('leaves declaration order alone before anything is typed', () => {
		const store = typedSlash('plain row', 9)

		expect(store.overlay.list.rows().map(row => row.label)).toEqual([
			'Heading 1',
			'Bulleted list',
			'Table',
			'To-do list',
		])
	})
})

describe('choose an option', () => {
	/**
	 * TICKET 11, and the assertion the probe could not make. The menu wrote over the TRIGGER's
	 * span, which is wherever the caret is, so a row that already had text got the markup dropped
	 * mid-row — `'plain row# '`. Converting the row instead is reachable only because `turnInto`
	 * takes the body text: the trigger leaves and the kind arrives in ONE splice, which is what
	 * controlled mode requires of a gesture that does two things.
	 */
	it('turns a row that already has text INTO the kind, keeping the text', () => {
		const store = typedSlash('Intro paragraph\n\nplain row', 26)

		expect(store.overlay.choose({option: HEADING})).toBe(true)

		expect(store.tokens.value()).toBe('Intro paragraph\n\n# plain row')
	})

	it('keeps the row itself, so nothing keyed on its id moves', () => {
		const store = typedSlash('Intro paragraph\n\nplain row', 26)
		const before = rowsOf(store)

		store.overlay.choose({option: HEADING})

		expect(rowsOf(store)).toEqual(before)
	})

	it('closes the overlay once it has written', () => {
		const store = typedSlash('Intro paragraph\n\nplain row', 26)

		store.overlay.choose({option: HEADING})

		expect(store.overlay.match()).toBeUndefined()
	})

	it('applies the kind on an empty row, which is the insert gesture', () => {
		const store = typedSlash('Intro paragraph\n\n', 17)

		expect(store.overlay.choose({option: HEADING})).toBe(true)

		expect(store.tokens.value()).toBe('Intro paragraph\n\n# ')
	})

	/** `menu.text` and `menu.meta` are DATA on the entry: what the row this entry writes starts as. */
	it('seeds an empty row from the entry, its body and its meta alike', () => {
		const table = typedSlash('a\n', 2)
		table.overlay.choose({option: TABLE})
		expect(table.tokens.value()).toBe('a\n|Task | Status | Owner')

		const todo = typedSlash('a\n', 2)
		todo.overlay.choose({option: TODO})
		expect(todo.tokens.value()).toBe('a\n- [x] ')
	})

	/**
	 * The seed applies where there is nothing to keep, and NOWHERE else: a turn-into on a row with
	 * text must not discard what the user typed for a placeholder.
	 */
	it('never overwrites a row that already has text with the seed', () => {
		const store = typedSlash('a\nreal content', 14)

		store.overlay.choose({option: TABLE})

		expect(store.tokens.value()).toBe('a\n|real content')
	})

	/**
	 * The empty NESTED row, which is where an insert has to move the caret to be usable at all:
	 * the trigger and the caret leave together, so the caret must land inside the kind the row
	 * just became rather than in front of its opener.
	 */
	it('puts the caret inside the new row on an empty NESTED row', () => {
		const store = typedSlash('- a\n\t', 5)

		expect(store.overlay.choose({option: HEADING})).toBe(true)

		expect(store.tokens.value()).toBe('- a\n\t# ')
		expect(selectionRange(store)).toEqual({start: 7, end: 7})
	})

	/** Nesting survives the retype: the row keeps its lead, so a converted child stays a child. */
	it('keeps a nested row nested', () => {
		const store = typedSlash('- a\n\tnested text', 16)

		store.overlay.choose({option: HEADING})

		expect(store.tokens.value()).toBe('- a\n\t# nested text')
	})

	/**
	 * The verb's own gate, unchanged and asked here because the menu is the one caller that can
	 * reach it: an option this editor compiles no ROW KIND from writes nothing, and the overlay
	 * stays open so the user still has the menu they were pointing at.
	 */
	it('refuses an option that declares no row kind, and leaves the overlay open', () => {
		const mark: CoreOption = {markup: '@[__value__]', menu: {label: 'Mention'}}
		const store = typedSlash('plain row', 9, [SLASH, HEADING, mark])

		expect(store.overlay.choose({option: mark})).toBe(false)

		expect(store.tokens.value()).toBe('plain row/')
		expect(store.overlay.match()?.source).toBe('/')
	})

	it('refuses an option that is not in this editor at all', () => {
		const store = typedSlash('plain row', 9, [SLASH, BULLET])

		expect(store.overlay.choose({option: HEADING})).toBe(false)

		expect(store.tokens.value()).toBe('plain row/')
	})

	/**
	 * THE WAY BACK TO PLAIN TEXT. An option with a `menu` and NO `markup` names the row with no
	 * kind — the paragraph, which is `slots.paragraph` and which no option can declare — so it is
	 * the one entry a block menu could not carry. A row turned into a quote or a toggle stayed one:
	 * `/text` matched nothing and Enter split the row instead.
	 *
	 * It is the `markup === undefined` spelling `choose`'s value arm already reads as "this option
	 * inserts nothing", so no new field carries it. Declared APART from the refusal above, which is
	 * a DECLARED markup that compiles to no kind — a typo, and still refused.
	 */
	it('un-types a row through an entry that declares no markup', () => {
		const text: CoreOption = {menu: {label: 'Text', keywords: ['paragraph']}}
		const store = typedSlash('# a heading', 11, [SLASH, HEADING, text])
		expect(store.overlay.list.rows().map(row => row.label)).toContain('Text')

		expect(store.overlay.choose({option: text})).toBe(true)

		expect(store.tokens.value()).toBe('a heading')
		expect(rowsOf(store)[0].descriptor()).toBeUndefined()
	})

	/**
	 * ON A ROW THAT IS ALREADY A PARAGRAPH IT STILL WRITES, and what it writes is the removal of the
	 * trigger — `turnInto` compares the row's bytes, and `'plain row/'` is not `'plain row'`. That
	 * is the same answer every other entry gives on a row of its own kind, and it is what keeps the
	 * gesture from leaving a stray `/` in the document.
	 */
	it('removes the trigger when the un-typing entry is chosen on a paragraph', () => {
		const text: CoreOption = {menu: {label: 'Text'}}
		const store = typedSlash('plain row', 9, [SLASH, HEADING, text])

		expect(store.overlay.choose({option: text})).toBe(true)

		expect(store.tokens.value()).toBe('plain row')
	})

	/**
	 * `#target`'s no-row arm, and the only case that reaches it. A `null` separator says the value
	 * never splits, so the document parses NO rows at all — the trigger still matches and the
	 * overlay still opens, but there is nothing to retype and the write declines.
	 */
	it('refuses in a document that parses no rows, and leaves the value alone', () => {
		const store = new Store()
		store.props.set({defaultValue: 'plain row', separator: null, Mark: () => null, options: MENU_OPTIONS})
		store.host.container(document.createElement('div'))
		caretAt(store, 9)
		store.edit.replace(...anchorsAt(store, 9, 9), '/')
		expect(store.overlay.match()?.source).toBe('/')

		expect(store.overlay.choose({option: HEADING})).toBe(false)

		expect(store.tokens.value()).toBe('plain row/')
	})

	it('refuses with no overlay open', () => {
		const store = typedSlash('plain row', 9)

		store.overlay.close()

		expect(store.overlay.choose({option: HEADING})).toBe(false)
		expect(store.tokens.value()).toBe('plain row/')
	})

	/**
	 * The two arms are EXCLUSIVE, and the TYPE is what says so — this pin reddens `typecheck`,
	 * not the runtime. The runtime assertions below are the damage the old optional bag let a
	 * caller write: `{option, value}` retyped the row and dropped `value` on the floor, and `{}`
	 * reached the value arm carrying nothing at all.
	 *
	 * A bare `A | B` is NOT enough: excess-property checking against a union accepts any key
	 * declared by any arm, so `{option, value}` passed. The `?: never` members are what refuse it.
	 */
	it('forbids a pick that names both arms, or neither', () => {
		const both = typedSlash('plain row', 9)
		// @ts-expect-error -- a pick names a kind or a value, never both
		expect(both.overlay.choose({option: HEADING, value: 'dropped'})).toBe(true)
		expect(both.tokens.value()).toBe('# plain row')

		const neither = typedSlash('plain row', 9)
		// @ts-expect-error -- and never neither
		expect(neither.overlay.choose({})).toBe(false)
		expect(neither.tokens.value()).toBe('plain row/')
	})
})