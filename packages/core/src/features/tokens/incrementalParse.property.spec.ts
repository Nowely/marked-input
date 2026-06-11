import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {incrementalParse} from './incrementalParse'
import {Parser} from './parser/Parser'
import type {Markup, Token} from './parser/types'
import {applyEdit, editHintOf, generateDocument, generateEdit} from './tokenIdentity.property.spec'

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

function runProperty(markup: Markup, sigil: string, iterations: number): void {
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
			const edit = generateEdit(value, sigil)
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

// --- Slot-leading generator --------------------------------------------------
// The existing generateDocument/generateEdit API is sigil-based and cannot
// express `\n\n` separators. Build the document and edits inline.

const word = () => faker.string.alpha({length: faker.number.int({min: 1, max: 6})})

/** A slot-leading document: random words joined by `\n\n` (0–6 rows, some unterminated). */
function generateSlotLeadingDocument(): string {
	const rows = faker.number.int({min: 0, max: 6})
	if (rows === 0) return ''
	const parts: string[] = []
	for (let r = 0; r < rows; r++) {
		// each "row" is a few words separated by single spaces
		const wordCount = faker.number.int({min: 0, max: 4})
		const row = Array.from({length: wordCount}, () => word()).join(' ')
		parts.push(row)
	}
	// with 50 % probability leave the last row unterminated (no trailing \n\n)
	const sep = '\n\n'
	return faker.datatype.boolean() ? parts.join(sep) + sep : parts.join(sep)
}

/**
 * A random single edit for slot-leading documents. The adversarial class here
 * is edits that SPLIT or MERGE rows by inserting/deleting `\n` or `\n\n`.
 */
function generateSlotLeadingEdit(doc: string): {kind: string; start: number; end: number; insert: string} {
	const kind = faker.helpers.weightedArrayElement([
		{weight: 3, value: 'insertWord'},
		{weight: 3, value: 'deleteChars'},
		{weight: 3, value: 'replaceChars'},
		{weight: 3, value: 'insertNewline'}, // might split a row
		{weight: 3, value: 'insertDoubleSep'}, // inserts \n\n — always splits
		{weight: 3, value: 'deleteNewline'}, // might merge rows
		{weight: 2, value: 'startEdge'},
		{weight: 2, value: 'endEdge'},
		{weight: 1, value: 'fullReplace'},
	])
	switch (kind) {
		case 'insertWord': {
			const at = faker.number.int({min: 0, max: doc.length})
			return {kind, start: at, end: at, insert: word()}
		}
		case 'deleteChars': {
			if (doc.length === 0) return {kind: 'noop', start: 0, end: 0, insert: ''}
			const start = faker.number.int({min: 0, max: doc.length - 1})
			const end = faker.number.int({min: start + 1, max: Math.min(doc.length, start + 6)})
			return {kind, start, end, insert: ''}
		}
		case 'replaceChars': {
			if (doc.length === 0) return {kind: 'insertWord', start: 0, end: 0, insert: word()}
			const start = faker.number.int({min: 0, max: doc.length - 1})
			const end = faker.number.int({min: start, max: Math.min(doc.length, start + 6)})
			return {kind, start, end, insert: word()}
		}
		case 'insertNewline': {
			const at = faker.number.int({min: 0, max: doc.length})
			return {kind, start: at, end: at, insert: '\n'}
		}
		case 'insertDoubleSep': {
			const at = faker.number.int({min: 0, max: doc.length})
			return {kind, start: at, end: at, insert: '\n\n'}
		}
		case 'deleteNewline': {
			// find any \n in the doc and delete it (or the pair \n\n)
			const positions: number[] = []
			for (let j = 0; j < doc.length; j++) {
				if (doc[j] === '\n') positions.push(j)
			}
			if (positions.length === 0) return {kind: 'insertWord', start: 0, end: 0, insert: word()}
			const at = faker.helpers.arrayElement(positions)
			// delete 1 or 2 chars to merge a single \n or a \n\n separator
			const end = Math.min(doc.length, at + (doc.slice(at, at + 2) === '\n\n' ? 2 : 1))
			return {kind, start: at, end, insert: ''}
		}
		case 'startEdge':
			return {kind, start: 0, end: 0, insert: word()}
		case 'endEdge':
			return {kind, start: doc.length, end: doc.length, insert: word()}
		case 'fullReplace':
			return {kind, start: 0, end: doc.length, insert: generateSlotLeadingDocument()}
		default:
			return {kind: 'noop', start: 0, end: 0, insert: ''}
	}
}

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
			const edit = generateSlotLeadingEdit(value)
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

	it('slot markup #[…]: nested children survive the splice too', () => {
		runProperty('#[__slot__]', '#', Math.ceil(ITERATIONS / 2))
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