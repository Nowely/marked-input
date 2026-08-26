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