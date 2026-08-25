import {describe, expect, it} from 'vitest'

import {rowsToDebugTree} from './__testing__/tokensToDebugTree'
import {Parser} from './Parser'
import type {Markup, RowConfig} from './types'

const SEPARATOR: RowConfig = {separator: '\n\n', indent: '\t'}
const LINE: RowConfig = {separator: '\n', indent: '\t'}

/** Every markup a row kind, which is what an option carrying `row` compiles to. */
const rowParser = (markups: Markup[]) =>
	new Parser(
		markups,
		markups.map(() => true)
	)

describe('parseRows', () => {
	describe('plain text', () => {
		it('splits plain text into rows at each separator', () => {
			const rows = new Parser([]).parseRows('alpha\n\nbeta', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "alpha↲↲" [0-7]
					0.0: TEXT "alpha" [0-5]
				 1: ROW "beta" [7-11]
					1.0: TEXT "beta" [7-11]"
			`)
		})

		it('keeps the piece after a final separator as an empty row', () => {
			const rows = new Parser([]).parseRows('alpha\n\n', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "alpha↲↲" [0-7]
					0.0: TEXT "alpha" [0-5]
				 1: ROW "" [7-7]
					1.0: TEXT "" [7-7]"
			`)
		})

		it('yields one empty row for an empty document', () => {
			const rows = new Parser([]).parseRows('', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "" [0-0]
					0.0: TEXT "" [0-0]"
			`)
		})

		it('keeps an empty row between adjacent separators', () => {
			const rows = new Parser([]).parseRows('alpha\n\n\n\nbeta', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "alpha↲↲" [0-7]
					0.0: TEXT "alpha" [0-5]
				 1: ROW "↲↲" [7-9]
					1.0: TEXT "" [7-7]
				 2: ROW "beta" [9-13]
					2.0: TEXT "beta" [9-13]"
			`)
		})
	})

	describe('row kinds', () => {
		it('types a row from its opener and keeps only the body as children', () => {
			const rows = rowParser(['# __slot__']).parseRows('# Title\n\nBody', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# Title↲↲" [0-9] kind=0
					0.0: TEXT "Title" [2-7]
				 1: ROW "Body" [9-13]
					1.0: TEXT "Body" [9-13]"
			`)
		})

		it('types a row wherever a row starts, not only at offset 0', () => {
			const rows = rowParser(['# __slot__']).parseRows('lead\n\n# Title\n\n', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "lead↲↲" [0-6]
					0.0: TEXT "lead" [0-4]
				 1: ROW "# Title↲↲" [6-15] kind=0
					1.0: TEXT "Title" [8-13]
				 2: ROW "" [15-15]
					2.0: TEXT "" [15-15]"
			`)
		})

		it('closes an open body at end of input on the document-final row', () => {
			const rows = rowParser(['# __slot__']).parseRows('# Last', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# Last" [0-6] kind=0
					0.0: TEXT "Last" [2-6]"
			`)
		})

		it('never re-parses a RAW body, and reads the kind meta beside it', () => {
			const rows = new Parser(['- [__meta__] __value__', '**__slot__**'], [true, false]).parseRows(
				'- [x] a **b**',
				LINE
			)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- [x] a **b**" [0-13] kind=0 meta="x"
					0.0: TEXT "a **b**" [6-13]"
			`)
		})

		it('prefers the LONGEST opener, so a todo beats the bullet it starts like', () => {
			const rows = rowParser(['- [__meta__] __slot__', '- __slot__']).parseRows('- [x] done\n- plain', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- [x] done↲" [0-11] kind=0 meta="x"
					0.0: TEXT "done" [6-10]
				 1: ROW "- plain" [11-18] kind=1
					1.0: TEXT "plain" [13-18]"
			`)
		})

		it('parses inline marks inside a typed row, at absolute positions', () => {
			const rows = new Parser(['# __slot__', '**__slot__**'], [true, false]).parseRows(
				'# a **b** c\n\nrest',
				SEPARATOR
			)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# a **b** c↲↲" [0-13] kind=0
					0.0: TEXT "a " [2-4]
					0.1: MARK "**b**" [4-9] [value="", slot="b"]
						0.1.0: TEXT "b" [6-7]
					0.2: TEXT " c" [9-11]
				 1: ROW "rest" [13-17]
					1.0: TEXT "rest" [13-17]"
			`)
		})
	})

	/**
	 * The four defects the inversion closes, each one a ticket in
	 * `docs/scratch/notion-like/issues/`. Snapshots rather than round-trip assertions on purpose:
	 * every one of these documents round-trips under a scanner that types nothing at all, so only
	 * the tree shape tells the two apart.
	 */
	describe('the recognizer only ever looks at a row start (tickets 01, 06, 07, 09)', () => {
		it('leaves a mid-line opener as plain text (01)', () => {
			const rows = rowParser(['# __slot__']).parseRows('load 5# peak', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "load 5# peak" [0-12]
					0.0: TEXT "load 5# peak" [0-12]"
			`)
		})

		it('gives a tight list one row per item instead of a staircase (06)', () => {
			const rows = rowParser(['- __slot__']).parseRows('- a\n- b', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- a↲" [0-4] kind=0
					0.0: TEXT "a" [2-3]
				 1: ROW "- b" [4-7] kind=0
					1.0: TEXT "b" [6-7]"
			`)
		})

		it('matches a fence away from offset 0 (07)', () => {
			const rows = rowParser(['```__meta__\n__value__\n```']).parseRows('x\n```js\nq\n```', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "x↲" [0-2]
					0.0: TEXT "x" [0-1]
				 1: ROW "\`\`\`js↲q↲\`\`\`" [2-13] kind=0 meta="js"
					1.0: TEXT "q" [8-9]"
			`)
		})

		it('matches frontmatter away from offset 0 (09)', () => {
			const rows = rowParser(['---\n__value__\n---']).parseRows('pre\n---\na: 1\n---', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "pre↲" [0-4]
					0.0: TEXT "pre" [0-3]
				 1: ROW "---↲a: 1↲---" [4-16] kind=0
					1.0: TEXT "a: 1" [8-12]"
			`)
		})
	})

	/**
	 * SNAPSHOTS, not a round trip. `[A, B]` and `[A[B]]` join to the SAME string, so the
	 * round-trip property is structurally blind to every assertion in this block; the debug tree
	 * is the only thing that sees depth at all.
	 */
	describe('nesting is indentation and nothing else', () => {
		it('makes a deeper indent run a child of the row before it', () => {
			const rows = rowParser(['- __slot__']).parseRows('- a\n\t- b\n\t\t- c\n- d', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- a↲⇥- b↲⇥⇥- c↲" [0-15] kind=0
					0.0: TEXT "a" [2-3]
					0.1: ROW "⇥- b↲⇥⇥- c↲" [4-15] lead="⇥" kind=0
						0.1.0: TEXT "b" [7-8]
						0.1.1: ROW "⇥⇥- c↲" [9-15] lead="⇥⇥" kind=0
							0.1.1.0: TEXT "c" [13-14]
				 1: ROW "- d" [15-18] kind=0
					1.0: TEXT "d" [17-18]"
			`)
		})

		it('clamps an over-indented row to one level and keeps its surplus bytes in the lead', () => {
			// The two children are SIBLINGS at the same depth with DIFFERENT leads — the whole
			// reason `lead` is the round-trip bytes and depth is the tree, with no function
			// from one to the other.
			const rows = rowParser(['- __slot__']).parseRows('- a\n\t\t- b\n\t- c', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- a↲⇥⇥- b↲⇥- c" [0-14] kind=0
					0.0: TEXT "a" [2-3]
					0.1: ROW "⇥⇥- b↲" [4-10] lead="⇥⇥" kind=0
						0.1.0: TEXT "b" [8-9]
					0.2: ROW "⇥- c" [10-14] lead="⇥" kind=0
						0.2.0: TEXT "c" [13-14]"
			`)
		})

		it('gives an empty row no children, so a blank line does not adopt the row below it', () => {
			const rows = rowParser(['- __slot__']).parseRows('- a\n\n\t- b', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- a↲" [0-4] kind=0
					0.0: TEXT "a" [2-3]
				 1: ROW "↲" [4-5]
					1.0: TEXT "" [4-4]
				 2: ROW "⇥- b" [5-9] lead="⇥" kind=0
					2.0: TEXT "b" [8-9]"
			`)
		})

		it('turns nesting AND row typing off on an indented line at an empty indent', () => {
			// Declared cost, not an oversight: with no indent unit a line whose first character
			// is not the opener is a paragraph, so a consumer storing leading tabs as content
			// loses the kind on those lines too.
			const rows = rowParser(['- __slot__']).parseRows('- a\n\t- b', {separator: '\n', indent: ''})

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- a↲" [0-4] kind=0
					0.0: TEXT "a" [2-3]
				 1: ROW "⇥- b" [4-8]
					1.0: TEXT "⇥- b" [4-8]"
			`)
		})

		it('nests a paragraph under a typed row, and a typed row under a paragraph', () => {
			const rows = rowParser(['> __slot__']).parseRows('> quote\n\tloose line\nplain\n\t> deep', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "> quote↲⇥loose line↲" [0-20] kind=0
					0.0: TEXT "quote" [2-7]
					0.1: ROW "⇥loose line↲" [8-20] lead="⇥"
						0.1.0: TEXT "loose line" [9-19]
				 1: ROW "plain↲⇥> deep" [20-33]
					1.0: TEXT "plain" [20-25]
					1.1: ROW "⇥> deep" [26-33] lead="⇥" kind=0
						1.1.0: TEXT "deep" [29-33]"
			`)
		})
	})

	describe('the two bounds on a candidate', () => {
		/**
		 * ONLY THE BODY GAP MAY CROSS A SEPARATOR. Without the rule the todo's `__meta__` closes
		 * at the `]` on the next line and one row swallows two.
		 */
		it('refuses a candidate whose META closes past the row own separator', () => {
			const rows = rowParser(['- [__meta__] __slot__']).parseRows('- [x hi\nthere] more', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- [x hi↲" [0-8]
					0.0: TEXT "- [x hi" [0-7]
				 1: ROW "there] more" [8-19]
					1.0: TEXT "there] more" [8-19]"
			`)
		})

		/**
		 * A CLOSED KIND MUST END AT A SEPARATOR OR AT END OF INPUT. The fence closes mid-line
		 * here, so the candidate is refused and every row still starts at a line start — without
		 * the rule the fence takes [0,11) and the next row opens at the space before `tail`,
		 * which contradicts the premise the whole scan rests on.
		 */
		it('refuses a candidate that would end mid-line', () => {
			const rows = rowParser(['```__meta__\n__value__\n```']).parseRows('```ts\nq\n``` tail\nnext', LINE)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "\`\`\`ts↲" [0-6]
					0.0: TEXT "\`\`\`ts" [0-5]
				 1: ROW "q↲" [6-8]
					1.0: TEXT "q" [6-7]
				 2: ROW "\`\`\` tail↲" [8-17]
					2.0: TEXT "\`\`\` tail" [8-16]
				 3: ROW "next" [17-21]
					3.0: TEXT "next" [17-21]"
			`)
		})

		it('accepts a candidate whose meta closes ON the row own separator', () => {
			// The fence's `__meta__` closer IS the separator, so the bound is where the closer
			// STARTS — testing its end would refuse every fence ever written.
			const rows = rowParser(['```__meta__\n__value__\n```']).parseRows('```js\nq\n```', LINE)

			expect(rows.map(row => row.descriptor?.index)).toEqual([0])
		})
	})

	/**
	 * BEHAVIOUR CHANGE (ADR-0010). An inline mark can no longer span a row boundary: the rows are
	 * carved first and each body is matched on its own. What used to make these shapes work — a
	 * match hiding the separator occurrences inside its extent — is exactly the mutual dependence
	 * the inversion removes. A markup that means to span rows declares `row` and gets a closing
	 * literal instead, which then matches ANYWHERE rather than only at offset 0.
	 */
	describe('an inline mark is bounded by its row', () => {
		it('leaves a fence whose interior crosses a separator as plain text', () => {
			const rows = new Parser(['```__meta__\n__value__```']).parseRows(
				'```js\ncode\n\nmore```\n\nafter',
				SEPARATOR
			)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "\`\`\`js↲code↲↲" [0-12]
					0.0: TEXT "\`\`\`js↲code" [0-10]
				 1: ROW "more\`\`\`↲↲" [12-21]
					1.0: TEXT "more\`\`\`" [12-19]
				 2: ROW "after" [21-26]
					2.0: TEXT "after" [21-26]"
			`)
		})

		it('leaves a meta gap that crosses a separator as plain text', () => {
			const rows = new Parser(['@[__value__](__meta__)']).parseRows('@[a](x\n\ny)\n\nnext', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "@[a](x↲↲" [0-8]
					0.0: TEXT "@[a](x" [0-6]
				 1: ROW "y)↲↲" [8-12]
					1.0: TEXT "y)" [8-10]
				 2: ROW "next" [12-16]
					2.0: TEXT "next" [12-16]"
			`)
		})

		it('leaves a closed slot that crosses a separator as plain text', () => {
			const rows = new Parser(['**__slot__**']).parseRows('**a\n\nb**', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "**a↲↲" [0-5]
					0.0: TEXT "**a" [0-3]
				 1: ROW "b**" [5-8]
					1.0: TEXT "b**" [5-8]"
			`)
		})

		it('keeps a paragraph with inline marks as one row', () => {
			const rows = new Parser(['**__slot__**']).parseRows('text **bold** tail\n\nnext', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "text **bold** tail↲↲" [0-20]
					0.0: TEXT "text " [0-5]
					0.1: MARK "**bold**" [5-13] [value="", slot="bold"]
						0.1.0: TEXT "bold" [7-11]
					0.2: TEXT " tail" [13-18]
				 1: ROW "next" [20-24]
					1.0: TEXT "next" [20-24]"
			`)
		})
	})

	describe('contract', () => {
		it('rejects an empty separator', () => {
			expect(() => new Parser([]).parseRows('alpha', {separator: '', indent: '\t'})).toThrow(
				'separator must be non-empty'
			)
		})

		it('reproduces the value from row contents byte-for-byte', () => {
			const parser = new Parser(['# __slot__', '**__slot__**'], [true, false])
			const value = '# a **b**\n\nplain\n\n'

			const rows = parser.parseRows(value, SEPARATOR)

			expect(rows.map(row => row.content).join('')).toBe(value)
		})

		it('leaves parse() untouched by the row pipeline', () => {
			const parser = new Parser(['**__slot__**'])
			const value = 'text **bold** tail'

			const inline = parser.parse(value)
			parser.parseRows(value, SEPARATOR)

			expect(parser.parse(value)).toEqual(inline)
		})

		it('keeps a row markup out of the inline alternation', () => {
			// The same markup as a row kind and as an inline mark: as a kind it must never be
			// matched inside a line, which is what registering its literals in the alternation
			// would do.
			const asRow = rowParser(['# __slot__']).parse('load 5# peak')
			const asMark = new Parser(['# __slot__']).parse('load 5# peak')

			expect(asRow.map(token => token.type)).toEqual(['text'])
			expect(asMark.map(token => token.type)).toEqual(['text', 'mark', 'text'])
		})
	})
})