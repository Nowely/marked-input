import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {incrementalParse} from './incrementalParse'
import {Parser} from './parser/Parser'
import type {Markup, Token} from './parser/types'
import {
	applyEdit,
	editHintOf,
	generateDocument,
	generateEdit,
	generateInRowEdit,
	generateInSlotEdit,
	generateSlotLeadingDocument,
	generateSlotLeadingEdit,
} from './tokenIdentity.property.spec'

// Equivalence property (Phase 2 plan, Task 6 — the gate for the windowed
// incremental reparse):
//
//   For ANY document and ANY single edit,
//     incrementalParse(parser, prevTokens, prevValue, nextValue, hint)
//   deep-equals parser.parse(nextValue).
//
// Reuses the Task 5 generator (adversarial classes: markup-completing /
// markup-breaking edits, boundary-crossing deletes, edge inserts, full
// replaces). Edits CHAIN: each round feeds the windowed output back in as the
// previous tree — exactly how TokenModel's #lastParsed bookkeeping uses it.
// On failure the error carries seed + document + edit for reproduction with
// `faker.seed(<seed>)`.

// Seed chosen 2026-06-12; change only when re-baselining the property run.
const BASE_SEED = 6_122_026
/** ~200 keeps CI-tolerable runtime; bump locally (e.g. 1000) for soak runs. */
const ITERATIONS = 200

function runProperty(markup: Markup, sigil: string, iterations: number, inSlot = false): void {
	const parser = new Parser([markup])
	for (let i = 0; i < iterations; i++) {
		const seed = BASE_SEED + i
		faker.seed(seed)
		let value = generateDocument(sigil)
		let tokens: Token[] = parser.parse(value)
		// every other iteration chains a second edit so the windowed output of
		// round 0 becomes the previous tree of round 1 (splice-of-splice)
		const rounds = 1 + (i % 2)
		for (let round = 0; round < rounds; round++) {
			// every 3rd edit of an in-slot run targets a slot interior (descend class)
			const edit =
				(inSlot && (i + round) % 3 === 0 ? generateInSlotEdit(value, sigil) : undefined) ??
				generateEdit(value, sigil)
			const next = applyEdit(value, edit)
			const actual = incrementalParse(parser, tokens, value, next, editHintOf(edit))
			const expected = parser.parse(next)
			try {
				expect(actual).toEqual(expected)
			} catch (error) {
				const detail = [
					`seed=${seed} iteration=${i} round=${round} markup=${markup}`,
					`document: ${JSON.stringify(value)}`,
					`edit:     ${JSON.stringify(edit)}`,
					`next:     ${JSON.stringify(next)}`,
				].join('\n')
				throw new Error(
					`incrementalParse equivalence property failed\n${detail}\n\n${error instanceof Error ? error.message : String(error)}`,
					{cause: error}
				)
			}
			value = next
			tokens = actual
		}
	}
}

// --- Slot-leading run ----------------------------------------------------------
// Documents and edits come from the shared generators (tokenIdentity.property):
// the sigil-based generateDocument/generateEdit API cannot express `\n\n`
// separators.

function runSlotLeadingProperty(iterations: number): void {
	const markup = '__slot__\n\n' as Markup
	const parser = new Parser([markup])
	for (let i = 0; i < iterations; i++) {
		const seed = BASE_SEED + i
		faker.seed(seed)
		let value = generateSlotLeadingDocument()
		let tokens: Token[] = parser.parse(value)
		// chain a second edit on every other iteration (splice-of-splice)
		const rounds = 1 + (i % 2)
		for (let round = 0; round < rounds; round++) {
			// every 3rd edit stays inside a row (the descend class); the rest
			// exercise row split/merge
			const edit =
				((i + round) % 3 === 0 ? generateInRowEdit(value) : undefined) ?? generateSlotLeadingEdit(value)
			const next = value.slice(0, edit.start) + edit.insert + value.slice(edit.end)
			const hint = {start: edit.start, end: edit.end, insertedLength: edit.insert.length}
			const actual = incrementalParse(parser, tokens, value, next, hint)
			const expected = parser.parse(next)
			try {
				expect(actual).toEqual(expected)
			} catch (error) {
				const detail = [
					`seed=${seed} iteration=${i} round=${round} markup=${markup}`,
					`document: ${JSON.stringify(value)}`,
					`edit:     ${JSON.stringify(edit)}`,
					`next:     ${JSON.stringify(next)}`,
				].join('\n')
				throw new Error(
					`incrementalParse equivalence property failed\n${detail}\n\n${error instanceof Error ? error.message : String(error)}`,
					{cause: error}
				)
			}
			value = next
			tokens = actual
		}
	}
}

describe('incrementalParse equivalence property', () => {
	it('value markup @[…]: windowed reparse deep-equals a full parse', () => {
		runProperty('@[__value__]', '@', ITERATIONS)
	})

	it('slot markup #[…]: nested children survive the splice too, in-slot edits included', () => {
		runProperty('#[__slot__]', '#', Math.ceil(ITERATIONS / 2), true)
	})

	it('slot-leading markup __slot__\\n\\n: row-split/merge edits preserved by windowed reparse', () => {
		// PatternMatcher.resolveSlotLeadingMatches extends match starts backwards
		// non-locally. This run exercises edits that split or merge rows (inserting
		// or deleting \n / \n\n) — the class the reviewer predicted safe-by-fallback
		// but left unproven by tests.
		runSlotLeadingProperty(ITERATIONS)
	})
})

describe('incrementalParse regressions and guarantees', () => {
	const parser = new Parser(['@[__value__]'])

	it('non-local pairing: a trailing "]" closes an unmatched "@[" far in the prefix (LIFO matcher)', () => {
		// prev parse leaves '@[' at position 0 unmatched (every ']' pairs with the
		// CLOSEST preceding open). Appending ']' makes the full parse emit one
		// giant mark from position 0 — a naive window around the edit would miss
		// it. The inert-prefix guard must force the full-parse fallback here.
		const value = '@[aaa @[x] @[y] @[z] bbb'
		const prev = parser.parse(value)
		const next = `${value}]`
		const hint = {start: value.length, end: value.length, insertedLength: 1}
		expect(incrementalParse(parser, prev, value, next, hint)).toEqual(parser.parse(next))
	})

	it('reuses untouched prefix tokens by reference when the window stabilizes', () => {
		// Clean document (no stray segments outside the window) — the fast path
		// must engage, proven by reference identity of the untouched prefix.
		const value = 'aaa @[b] ccc @[d] eee @[f] ggg'
		const prev = parser.parse(value)
		const at = value.indexOf('eee') + 1
		const next = `${value.slice(0, at)}x${value.slice(at)}`
		const hint = {start: at, end: at, insertedLength: 1}
		const actual = incrementalParse(parser, prev, value, next, hint)
		expect(actual).toEqual(parser.parse(next))
		expect(actual[0]).toBe(prev[0])
		expect(actual[1]).toBe(prev[1])
	})

	it('falls back to a full parse when the hint does not match the values', () => {
		const value = 'aaa @[b] ccc'
		const prev = parser.parse(value)
		const next = 'zzz @[b] ccc'
		// bogus hint: claims a pure insert at the end, but the prefix changed
		const hint = {start: value.length, end: value.length, insertedLength: 0}
		expect(incrementalParse(parser, prev, value, next, hint)).toEqual(parser.parse(next))
	})

	it('handles edits at the very start and very end of the document', () => {
		const value = 'aaa @[b] ccc @[d] eee'
		const prev = parser.parse(value)
		for (const at of [0, value.length]) {
			const next = `${value.slice(0, at)}@[n]${value.slice(at)}`
			const hint = {start: at, end: at, insertedLength: 4}
			expect(incrementalParse(parser, prev, value, next, hint)).toEqual(parser.parse(next))
		}
	})

	it('handles an empty previous document', () => {
		const prev = parser.parse('')
		const hint = {start: 0, end: 0, insertedLength: 4}
		expect(incrementalParse(parser, prev, '', '@[n]', hint)).toEqual(parser.parse('@[n]'))
	})

	it('shifts slot ranges in suffix marks (slot markup)', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const value = 'aa #[bb #[cc]] dd #[ee] ff'
		const prev = slotParser.parse(value)
		const next = `x${value}`
		const hint = {start: 0, end: 0, insertedLength: 1}
		expect(incrementalParse(slotParser, prev, value, next, hint)).toEqual(slotParser.parse(next))
	})
})