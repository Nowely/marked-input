import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

import {Parser} from './Parser'
import type {RowToken, Token} from './types'

/**
 * The two properties the row pipeline must never lose (issue 08; re-hosted from
 * phase7's BlockParser.property.spec, commit 011de777):
 * - round-trip: joining row contents reproduces the value byte-for-byte
 * - row-locality: an in-row edit changes that row alone; every other row is
 *   byte-identical, suffix rows shifted by the edit's delta
 */

const FAKER_SEED = 6_122_026
const ITERATIONS = 200
const SEPARATOR = '\n\n'
const MARKUPS = ['# __slot__', '**__slot__**', '@[__value__](__meta__)'] as const

beforeEach(() => {
	faker.seed(FAKER_SEED)
})

function generateRowContent(): string {
	const words = () => faker.lorem.words({min: 1, max: 4})
	switch (faker.number.int({min: 0, max: 3})) {
		case 0:
			return words()
		case 1:
			return `# ${words()}`
		case 2:
			return `${words()} **${words()}** ${words()}`
		default:
			return `@[${faker.string.alpha(4)}](${faker.string.alpha(3)}) ${words()}`
	}
}

function generateDocument(): string {
	const rows = Array.from({length: faker.number.int({min: 1, max: 8})}, generateRowContent)
	const trailing = faker.datatype.boolean() ? SEPARATOR : ''
	return rows.join(SEPARATOR) + trailing
}

function shiftToken(token: Token, delta: number): Token {
	const shifted: Token = {
		...token,
		position: {start: token.position.start + delta, end: token.position.end + delta},
	}
	if (shifted.type === 'mark') {
		if (shifted.slot) {
			shifted.slot = {...shifted.slot, start: shifted.slot.start + delta, end: shifted.slot.end + delta}
		}
		shifted.children = shifted.children.map(child => shiftToken(child, delta))
	}
	return shifted
}

function shiftRow(row: RowToken, delta: number): RowToken {
	return {
		...row,
		position: {start: row.position.start + delta, end: row.position.end + delta},
		children: row.children.map(child => shiftToken(child, delta)),
	}
}

describe('parseRows properties', () => {
	it('reproduces any document from row contents byte-for-byte', () => {
		const parser = new Parser([...MARKUPS])

		for (let i = 0; i < ITERATIONS; i++) {
			const value = generateDocument()
			const rows = parser.parseRows(value, SEPARATOR)

			const joined = rows.map(row => row.content).join('')
			expect(joined, `iteration ${i}, value ${JSON.stringify(value)}`).toBe(value)
		}
	})

	it('keeps every other row byte-identical across an in-row edit', () => {
		const parser = new Parser([...MARKUPS])

		for (let i = 0; i < ITERATIONS; i++) {
			const value = generateDocument()
			const rows = parser.parseRows(value, SEPARATOR)

			// An insertion strictly inside one row's content (never into its separator):
			// a single alpha char cannot form or break a '\n\n' separator.
			const rowIndex = faker.number.int({min: 0, max: rows.length - 1})
			const row = rows[rowIndex]
			const contentLength = row.content.length - (row.terminated ? SEPARATOR.length : 0)
			const offset = row.position.start + faker.number.int({min: 0, max: contentLength})
			const inserted = faker.string.alpha(1)
			const edited = value.slice(0, offset) + inserted + value.slice(offset)

			const editedRows = parser.parseRows(edited, SEPARATOR)
			const context = `iteration ${i}, row ${rowIndex}, offset ${offset}, value ${JSON.stringify(value)}`

			expect(editedRows.length, context).toBe(rows.length)
			for (let k = 0; k < rowIndex; k++) {
				expect(editedRows[k], context).toEqual(rows[k])
			}
			for (let k = rowIndex + 1; k < rows.length; k++) {
				expect(editedRows[k], context).toEqual(shiftRow(rows[k], inserted.length))
			}
		}
	})
})