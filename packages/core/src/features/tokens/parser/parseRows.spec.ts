import {describe, expect, it} from 'vitest'

import {rowsToDebugTree} from './__testing__/tokensToDebugTree'
import {Parser} from './Parser'

const SEPARATOR = '\n\n'

describe('parseRows', () => {
	describe('plain text', () => {
		it('splits plain text into rows at each separator', () => {
			const rows = new Parser([]).parseRows('alpha\n\nbeta', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "alpha↲↲" [0-7]
					0.0: TEXT "alpha" [0-5]
				 1: ROW "beta" [7-11] unterminated
					1.0: TEXT "beta" [7-11]"
			`)
		})

		it('keeps the piece after a final separator as an empty unterminated row', () => {
			const rows = new Parser([]).parseRows('alpha\n\n', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "alpha↲↲" [0-7]
					0.0: TEXT "alpha" [0-5]
				 1: ROW "" [7-7] unterminated
					1.0: TEXT "" [7-7]"
			`)
		})

		it('yields one empty unterminated row for an empty document', () => {
			const rows = new Parser([]).parseRows('', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "" [0-0] unterminated
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
				 2: ROW "beta" [9-13] unterminated
					2.0: TEXT "beta" [9-13]"
			`)
		})
	})

	describe('open trailing gaps', () => {
		it('closes an open trailing slot at the row boundary', () => {
			const rows = new Parser(['# __slot__']).parseRows('# Title\n\nBody', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# Title↲↲" [0-9]
					0.0: TEXT "" [0-0]
					0.1: MARK "# Title" [0-7] [value="", slot="Title"]
						0.1.0: TEXT "Title" [2-7]
					0.2: TEXT "" [7-7]
				 1: ROW "Body" [9-13] unterminated
					1.0: TEXT "Body" [9-13]"
			`)
		})

		it('never extends a leading marker backwards', () => {
			const rows = new Parser(['# __slot__']).parseRows('lead\n\n# Title\n\n', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "lead↲↲" [0-6]
					0.0: TEXT "lead" [0-4]
				 1: ROW "# Title↲↲" [6-15]
					1.0: TEXT "" [6-6]
					1.1: MARK "# Title" [6-13] [value="", slot="Title"]
						1.1.0: TEXT "Title" [8-13]
					1.2: TEXT "" [13-13]
				 2: ROW "" [15-15] unterminated
					2.0: TEXT "" [15-15]"
			`)
		})

		it('closes the trailing slot of the document-final row at end of input', () => {
			const rows = new Parser(['# __slot__']).parseRows('# Last', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# Last" [0-6] unterminated
					0.0: TEXT "" [0-0]
					0.1: MARK "# Last" [0-6] [value="", slot="Last"]
						0.1.0: TEXT "Last" [2-6]
					0.2: TEXT "" [6-6]"
			`)
		})

		it('closes an open trailing value at the row boundary', () => {
			const rows = new Parser(['- __value__']).parseRows('- alpha\n- beta\n', '\n')

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "- alpha↲" [0-8]
					0.0: TEXT "" [0-0]
					0.1: MARK "- alpha" [0-7] [value="alpha"]
					0.2: TEXT "" [7-7]
				 1: ROW "- beta↲" [8-15]
					1.0: TEXT "" [8-8]
					1.1: MARK "- beta" [8-14] [value="beta"]
					1.2: TEXT "" [14-14]
				 2: ROW "" [15-15] unterminated
					2.0: TEXT "" [15-15]"
			`)
		})

		it('nests inline marks inside a closed trailing slot', () => {
			const rows = new Parser(['# __slot__', '**__slot__**']).parseRows('# a **b** c\n\nrest', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# a **b** c↲↲" [0-13]
					0.0: TEXT "" [0-0]
					0.1: MARK "# a **b** c" [0-11] [value="", slot="a **b** c"]
						0.1.0: TEXT "a " [2-4]
						0.1.1: MARK "**b**" [4-9] [value="", slot="b"]
							0.1.1.0: TEXT "b" [6-7]
						0.1.2: TEXT " c" [9-11]
					0.2: TEXT "" [11-11]
				 1: ROW "rest" [13-17] unterminated
					1.0: TEXT "rest" [13-17]"
			`)
		})

		it('closes adjacent same-markup rows without loss', () => {
			const rows = new Parser(['# __slot__']).parseRows('# a\n\n# b\n\n', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "# a↲↲" [0-5]
					0.0: TEXT "" [0-0]
					0.1: MARK "# a" [0-3] [value="", slot="a"]
						0.1.0: TEXT "a" [2-3]
					0.2: TEXT "" [3-3]
				 1: ROW "# b↲↲" [5-10]
					1.0: TEXT "" [5-5]
					1.1: MARK "# b" [5-8] [value="", slot="b"]
						1.1.0: TEXT "b" [7-8]
					1.2: TEXT "" [8-8]
				 2: ROW "" [10-10] unterminated
					2.0: TEXT "" [10-10]"
			`)
		})
	})

	describe('separator precedence', () => {
		it('keeps a paragraph with inline marks as one row', () => {
			const rows = new Parser(['**__slot__**']).parseRows('text **bold** tail\n\nnext', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "text **bold** tail↲↲" [0-20]
					0.0: TEXT "text " [0-5]
					0.1: MARK "**bold**" [5-13] [value="", slot="bold"]
						0.1.0: TEXT "bold" [7-11]
					0.2: TEXT " tail" [13-18]
				 1: ROW "next" [20-24] unterminated
					1.0: TEXT "next" [20-24]"
			`)
		})

		it('hides a separator inside an opaque value gap', () => {
			const rows = new Parser(['```__meta__\n__value__```']).parseRows(
				'```js\ncode\n\nmore```\n\nafter',
				SEPARATOR
			)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "\`\`\`js↲code↲↲more\`\`\`↲↲" [0-21]
					0.0: TEXT "" [0-0]
					0.1: MARK "\`\`\`js↲code↲↲more\`\`\`" [0-19] [value="code↲↲more", meta="js"]
					0.2: TEXT "" [19-19]
				 1: ROW "after" [21-26] unterminated
					1.0: TEXT "after" [21-26]"
			`)
		})

		it('hides a separator inside an opaque meta gap', () => {
			const rows = new Parser(['@[__value__](__meta__)']).parseRows('@[a](x\n\ny)\n\nnext', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "@[a](x↲↲y)↲↲" [0-12]
					0.0: TEXT "" [0-0]
					0.1: MARK "@[a](x↲↲y)" [0-10] [value="a", meta="x↲↲y"]
					0.2: TEXT "" [10-10]
				 1: ROW "next" [12-16] unterminated
					1.0: TEXT "next" [12-16]"
			`)
		})

		it('keeps a closed slot interior whole across a separator', () => {
			const rows = new Parser(['**__slot__**']).parseRows('**a\n\nb**', SEPARATOR)

			expect(rowsToDebugTree(rows)).toMatchInlineSnapshot(`
				"0: ROW "**a↲↲b**" [0-8] unterminated
					0.0: TEXT "" [0-0]
					0.1: MARK "**a↲↲b**" [0-8] [value="", slot="a↲↲b"]
						0.1.0: TEXT "a↲↲b" [2-6]
					0.2: TEXT "" [8-8]"
			`)
		})
	})

	describe('contract', () => {
		it('rejects an empty separator', () => {
			expect(() => new Parser([]).parseRows('alpha', '')).toThrow('separator must be non-empty')
		})

		it('reproduces the value from row contents byte-for-byte', () => {
			const parser = new Parser(['# __slot__', '**__slot__**'])
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
	})
})