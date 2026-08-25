import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

import {createTokenTree} from '../tree/tree'
import {Parser} from './Parser'
import type {Markup, RowConfig, RowToken, Token} from './types'

/**
 * The two properties the row pipeline must never lose (issue 08; re-hosted from
 * phase7's BlockParser.property.spec, commit 011de777):
 * - round-trip: joining row contents reproduces the value byte-for-byte
 * - row-locality: an in-row edit changes that row alone; every other row is
 *   byte-identical, suffix rows shifted by the edit's delta
 */

const FAKER_SEED = 6_122_026
const ITERATIONS = 200
const SEPARATOR = '\n'
const INDENT = '\t'
const ROW_CONFIG: RowConfig = {separator: SEPARATOR, indent: INDENT}
const MARKUPS = ['**__slot__**', '@[__value__](__meta__)'] as const
/** The ROW kinds, ahead of the inline markups so their option indices are stable. */
const ROW_MARKUPS: Markup[] = ['# __slot__', '- [__meta__] __slot__', '> __slot__']

/**
 * THE parser every property below runs on: the row kinds ARE the subject. Built kindless, the
 * round-trip and locality properties never see an opener or a closing literal, so neither could
 * catch one leaking across a row boundary — which is the one thing they exist to catch.
 */
const typedParser = (): Parser =>
	new Parser(
		[...ROW_MARKUPS, ...MARKUPS],
		ROW_MARKUPS.map(() => true)
	)

beforeEach(() => {
	faker.seed(FAKER_SEED)
})

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
		slot: {...row.slot, start: row.slot.start + delta, end: row.slot.end + delta},
		children: row.children.map(child => shiftToken(child, delta)),
		rows: row.rows.map(child => shiftRow(child, delta)),
	}
}

/** Every row in document order, at every depth — what the value's pre-order join walks. */
function preorder(rows: readonly RowToken[]): RowToken[] {
	return rows.flatMap(row => [row, ...preorder(row.rows)])
}

/** A row with no bytes of its own — the one the nest pass refuses to make a parent. */
function isEmptyRow(row: RowToken): boolean {
	return row.lead === '' && row.descriptor === undefined && row.slot.start === row.slot.end
}

describe('parseRows properties', () => {
	it('reproduces any document from row contents byte-for-byte', () => {
		const parser = typedParser()
		let typedRows = 0

		for (let i = 0; i < ITERATIONS; i++) {
			const value = generateTypedDocument()
			const rows = parser.parseRows(value, ROW_CONFIG)
			typedRows += rows.filter(row => row.descriptor !== undefined).length

			const joined = rows.map(row => row.content).join('')
			expect(joined, `iteration ${i}, value ${JSON.stringify(value)}`).toBe(value)
		}

		// The corpus is generated, so the property degrades silently if it stops producing kinds.
		expect(typedRows).toBeGreaterThan(ITERATIONS)
	})

	/**
	 * Stated over ROOTS and their whole subtrees, which is what nesting made of it: a parent's
	 * span covers its children, so an edit inside a nested row necessarily rewrites its
	 * ancestors' `content` too. Excluding the root that CONTAINS the edit is the same claim the
	 * flat property made — everything the edit is not inside is untouched.
	 */
	it('keeps every other row subtree byte-identical across an in-row edit', () => {
		const parser = typedParser()

		for (let i = 0; i < ITERATIONS; i++) {
			const value = generateTypedDocument()
			const roots = parser.parseRows(value, ROW_CONFIG)

			// An insertion strictly inside one row's own BODY: never into a separator, never into
			// a lead, and a single alpha char can neither form nor break a '\n' or an opener.
			// EMPTY rows are excluded, and that exclusion is the nesting rule rather than a
			// convenience — an empty row takes no children, so filling one in re-parents the row
			// after it and the edit is legitimately not local.
			const all = preorder(roots).filter(row => !isEmptyRow(row))
			if (all.length === 0) continue
			const rowIndex = faker.number.int({min: 0, max: all.length - 1})
			const row = all[rowIndex]
			const offset = faker.number.int({min: row.slot.start, max: row.slot.end})
			const inserted = faker.string.alpha(1)
			const edited = value.slice(0, offset) + inserted + value.slice(offset)

			const editedRoots = parser.parseRows(edited, ROW_CONFIG)
			const context = `iteration ${i}, row ${rowIndex}, offset ${offset}, value ${JSON.stringify(value)}`
			const hit = roots.findIndex(root => root.position.start <= offset && offset <= root.position.end)

			expect(editedRoots.length, context).toBe(roots.length)
			for (let k = 0; k < hit; k++) {
				expect(editedRoots[k], context).toEqual(roots[k])
			}
			for (let k = hit + 1; k < roots.length; k++) {
				expect(editedRoots[k], context).toEqual(shiftRow(roots[k], inserted.length))
			}
		}
	})

	/**
	 * The TREE's round trip, which the two properties above cannot see: a typed row keeps no
	 * copy of its opener, so the projection has to re-annotate it from the kind. The corpus is
	 * scoped on purpose — its inline part is a pinned alphabet rather than arbitrary text,
	 * because the unrestricted property is false today for reasons that predate this parse and
	 * belong to the inline layer (`'==<status:>===='` re-annotates as `'==<status:>========'`,
	 * from `joinNodes`, `toString` and `parseRows` alike).
	 */
	it('re-annotates every typed row back to the bytes it was parsed from', () => {
		const parser = typedParser()

		for (let i = 0; i < ITERATIONS; i++) {
			const value = generateTypedDocument()
			const tree = createTokenTree(parser.parseRows(value, ROW_CONFIG))
			tree.config(ROW_CONFIG)

			expect(tree.value(), `iteration ${i}, value ${JSON.stringify(value)}`).toBe(value)
		}
	})

	/**
	 * A GROWTH factor, not a millisecond budget — re-homed from the row pass's own guard, whose
	 * reference implementation went with the fixpoint. Absolutes move ±35% between runs of the
	 * same code and further between machines, so a budget would either be flaky or so loose it
	 * pins nothing; what a quadratic pass costs is growth with rows × matches, which shows as
	 * cost outrunning its input.
	 */
	it('costs no more than its input grows', () => {
		const parser = typedParser()

		const base = costOf(parser, generateLargeDocument(1000))
		const quadruple = costOf(parser, generateLargeDocument(4000))
		const octuple = costOf(parser, generateLargeDocument(8000))

		const scale = `1000 rows ${base.toFixed(2)}ms, 4000 rows ${quadruple.toFixed(2)}ms, 8000 rows ${octuple.toFixed(2)}ms`
		expect(quadruple / base, scale).toBeLessThan(10)
		expect(octuple / base, scale).toBeLessThan(20)
	})
})

/**
 * The corpus is INDENTED, deliberately over-indented part of the time: the clamp and the surplus
 * bytes it leaves in `lead` are what the round trip has to survive, and a flat generator sees
 * neither.
 */
function generateTypedDocument(): string {
	const rows = Array.from({length: faker.number.int({min: 1, max: 8})}, () => {
		const words = () => faker.lorem.words({min: 1, max: 4})
		const lead = INDENT.repeat(faker.number.int({min: 0, max: 3}))
		switch (faker.number.int({min: 0, max: 4})) {
			case 0:
				return `${lead}# ${words()}`
			case 1:
				return `${lead}- [${faker.helpers.arrayElement(['x', ' '])}] ${words()}`
			case 2:
				return `${lead}> ${words()} **${words()}**`
			case 3:
				return ''
			default:
				return `${lead}${words()} @[${faker.string.alpha(4)}](${faker.string.alpha(3)})`
		}
	})
	return rows.join(SEPARATOR) + (faker.datatype.boolean() ? SEPARATOR : '')
}

/** Re-baselined at P3 (spec risk 7): a generator with no indent pins an intermediate shape. */
function generateLargeDocument(count: number): string {
	const rows: string[] = []
	for (let index = 0; index < count; index++) {
		const lead = INDENT.repeat(index % 3)
		switch (index % 5) {
			case 0:
				rows.push(`# Heading ${index}`)
				break
			case 1:
				rows.push(`${lead}text ${index} **bold ${index}** tail`)
				break
			case 2:
				rows.push(`${lead}hi @[user${index}](id${index}) there`)
				break
			case 3:
				rows.push(`${lead}- [ ] task ${index}`)
				break
			default:
				rows.push(`${lead}plain paragraph number ${index} with some filler words`)
		}
	}
	return rows.join(SEPARATOR)
}

/**
 * Median per-parse cost. Each sample times a batch: `performance.now()` is coarsened to 0.1 ms
 * in the browser, which alone would put ±20% on the thousand-row reading the ratios divide by.
 */
function costOf(parser: Parser, value: string): number {
	const BATCH = 4
	for (let round = 0; round < 3; round++) parser.parseRows(value, ROW_CONFIG)

	const samples: number[] = []
	for (let round = 0; round < 7; round++) {
		const started = performance.now()
		for (let call = 0; call < BATCH; call++) parser.parseRows(value, ROW_CONFIG)
		samples.push((performance.now() - started) / BATCH)
	}
	return samples.toSorted((a, b) => a - b)[3]
}