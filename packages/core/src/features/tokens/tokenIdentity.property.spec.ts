import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from './parser/Parser'
import type {Markup, MarkToken, Token} from './parser/types'
import {createIdentityTracker, type EditHint, type IdentityTracker} from './tokenIdentity'

// Equivalence property (Phase 2 plan, Task 5 — the gate for Task 6's windowed
// incremental reparse):
//
//   For ANY document and ANY single edit,
//     reconcile(parse(next), hint).tokens deep-equals parse(next)
//   and ids are: stable for suffix-shifted tokens, fresh for added tokens,
//   gone for removed tokens.
//
// Deep reconcile (B3) adds the in-slot/in-row edit classes: a structure-
// preserving edit inside a mark's slot must put the mark in `updated` (stable
// id) and the covering text child in `textChanged` (stable id) — the descend
// invariants, asserted on top of the base property.
//
// The generators below (generateDocument / generateEdit / applyEdit and the
// slot-leading/in-slot families) are exported for reuse within the identity
// property run. On failure the error message carries seed + document + edit so
// the counterexample is reproducible with `faker.seed(<seed>)`.

const BASE_SEED = 6_122_026
/** ~200 keeps CI-tolerable runtime; bump locally (e.g. 1000) for soak runs. */
const ITERATIONS = 200

// --- Generator ---------------------------------------------------------------

export type GeneratedEdit = {
	/** Edit class — for diagnostics only. */
	kind: string
	/** Replaced range in the previous value (start === end → pure insert). */
	start: number
	end: number
	insert: string
}

export function applyEdit(value: string, edit: GeneratedEdit): string {
	return value.slice(0, edit.start) + edit.insert + value.slice(edit.end)
}

export function editHintOf(edit: GeneratedEdit): EditHint {
	return {start: edit.start, end: edit.end, insertedLength: edit.insert.length}
}

const word = () => faker.string.alpha({length: faker.number.int({min: 1, max: 6})})

/** A document segment: plain words, valid marks, partial/broken fragments. */
function generateSegment(sigil: string): string {
	const kind = faker.helpers.weightedArrayElement([
		{weight: 4, value: 'word'},
		{weight: 2, value: 'space'},
		{weight: 3, value: 'mark'}, // '@[word]'
		{weight: 1, value: 'open'}, // '@['
		{weight: 1, value: 'close'}, // ']'
		{weight: 1, value: 'sigil'}, // '@'
		{weight: 1, value: 'dangling'}, // '@[word'
	])
	switch (kind) {
		case 'word':
			return word()
		case 'space':
			return ' '
		case 'mark':
			return `${sigil}[${word()}]`
		case 'open':
			return `${sigil}[`
		case 'close':
			return ']'
		case 'sigil':
			return sigil
		case 'dangling':
			return `${sigil}[${word()}`
	}
}

export function generateDocument(sigil: string): string {
	const segments = faker.number.int({min: 0, max: 12})
	let doc = ''
	for (let i = 0; i < segments; i++) doc += generateSegment(sigil)
	return doc
}

/** Text used by insert/replace edits — words, fragments, bracket noise. */
function insertableText(sigil: string): string {
	const kind = faker.helpers.weightedArrayElement([
		{weight: 3, value: 'word'},
		{weight: 3, value: 'segment'},
		{weight: 2, value: 'noise'},
	])
	if (kind === 'word') return word()
	if (kind === 'segment') return generateSegment(sigil)
	return faker.helpers.arrayElement([sigil, '[', ']', `${sigil}[`, `]${sigil}[`, `]${sigil}`])
}

function findAll(doc: string, needle: string): number[] {
	const out: number[] = []
	let at = doc.indexOf(needle)
	while (at !== -1) {
		out.push(at)
		at = doc.indexOf(needle, at + 1)
	}
	return out
}

/** Positions of complete `@[word]` marks as [start, length] pairs. */
function findValidMarks(doc: string, sigil: string): Array<{start: number; length: number}> {
	const regex = new RegExp(`[${sigil}]\\[[A-Za-z]+\\]`, 'g')
	return [...doc.matchAll(regex)].map(m => ({start: m.index, length: m[0].length}))
}

function randomInsert(doc: string, sigil: string, kind: string): GeneratedEdit {
	const at = faker.number.int({min: 0, max: doc.length})
	return {kind, start: at, end: at, insert: insertableText(sigil)}
}

/**
 * A random single edit, biased towards the adversarial classes: completing a
 * dangling markup, breaking a valid one, crossing token boundaries, edits at
 * position 0 / end, zero-width inserts and full-range replaces. Classes that
 * need material the document lacks fall back to a plain random insert.
 */
export function generateEdit(doc: string, sigil: string): GeneratedEdit {
	const kind = faker.helpers.weightedArrayElement([
		{weight: 3, value: 'insert'},
		{weight: 3, value: 'delete'},
		{weight: 3, value: 'replace'},
		{weight: 2, value: 'complete'},
		{weight: 2, value: 'break'},
		{weight: 1, value: 'crossBoundary'},
		{weight: 1, value: 'startEdge'},
		{weight: 1, value: 'endEdge'},
		{weight: 1, value: 'zeroWidth'},
		{weight: 1, value: 'fullReplace'},
	])
	switch (kind) {
		case 'insert':
			return randomInsert(doc, sigil, kind)
		case 'delete': {
			if (doc.length === 0) return randomInsert(doc, sigil, kind)
			const start = faker.number.int({min: 0, max: doc.length - 1})
			const end = faker.number.int({min: start + 1, max: Math.min(doc.length, start + 8)})
			return {kind, start, end, insert: ''}
		}
		case 'replace': {
			if (doc.length === 0) return randomInsert(doc, sigil, kind)
			const start = faker.number.int({min: 0, max: doc.length - 1})
			const end = faker.number.int({min: start, max: Math.min(doc.length, start + 8)})
			return {kind, start, end, insert: insertableText(sigil)}
		}
		case 'complete': {
			// insert ']' a little after a '@[' — completes dangling markup
			const opens = findAll(doc, `${sigil}[`)
			if (opens.length === 0) return randomInsert(doc, sigil, kind)
			const open = faker.helpers.arrayElement(opens)
			const at = Math.min(doc.length, open + 2 + faker.number.int({min: 0, max: 6}))
			return {kind, start: at, end: at, insert: ']'}
		}
		case 'break': {
			// delete a structural character inside a valid mark
			const marks = findValidMarks(doc, sigil)
			if (marks.length === 0) return randomInsert(doc, sigil, kind)
			const mark = faker.helpers.arrayElement(marks)
			const at = faker.helpers.arrayElement([
				mark.start, // the sigil
				mark.start + 1, // '['
				mark.start + mark.length - 1, // ']'
			])
			return {kind, start: at, end: at + 1, insert: ''}
		}
		case 'crossBoundary': {
			// delete a range straddling a mark's start boundary
			const marks = findValidMarks(doc, sigil)
			if (marks.length === 0) return randomInsert(doc, sigil, kind)
			const mark = faker.helpers.arrayElement(marks)
			const start = Math.max(0, mark.start - faker.number.int({min: 1, max: 3}))
			const end = Math.min(doc.length, mark.start + faker.number.int({min: 1, max: 3}))
			return {kind, start, end, insert: faker.datatype.boolean() ? '' : insertableText(sigil)}
		}
		case 'startEdge':
			return {kind, start: 0, end: 0, insert: insertableText(sigil)}
		case 'endEdge':
			return {kind, start: doc.length, end: doc.length, insert: insertableText(sigil)}
		case 'zeroWidth': {
			const at = faker.number.int({min: 0, max: doc.length})
			return {kind, start: at, end: at, insert: ''}
		}
		case 'fullReplace':
			return {kind, start: 0, end: doc.length, insert: generateDocument(sigil)}
	}
}

// --- In-slot edits (deep-descend class) ----------------------------------------

/**
 * A structure-preserving random edit strictly inside a complete `#[word]`
 * mark's slot interior: insert/delete/replace of plain alpha text. Deletes
 * keep at least one interior character (an emptied slot loses its slot range
 * and legitimately refuses the descend); replaces guarantee a difference.
 * Returns undefined when the document has no complete simple mark.
 */
export function generateInSlotEdit(doc: string, sigil: string): GeneratedEdit | undefined {
	const marks = findValidMarks(doc, sigil)
	if (marks.length === 0) return undefined
	const mark = faker.helpers.arrayElement(marks)
	const lo = mark.start + 2 // first interior char (after '#[')
	const hi = mark.start + mark.length - 1 // exclusive interior end (before ']')
	const kind = faker.helpers.arrayElement(['inSlotInsert', 'inSlotDelete', 'inSlotReplace'])
	if (kind === 'inSlotDelete' && hi - lo > 1) {
		// keep ≥1 interior char: never delete the whole interior
		const start = faker.number.int({min: lo, max: hi - 1})
		const maxEnd = start === lo ? hi - 1 : hi
		const end = faker.number.int({min: start + 1, max: maxEnd})
		if (end > start) return {kind, start, end, insert: ''}
	}
	if (kind === 'inSlotReplace') {
		const start = faker.number.int({min: lo, max: hi - 1})
		const end = faker.number.int({min: start + 1, max: hi})
		let insert = word()
		if (insert === doc.slice(start, end)) insert += 'X'
		return {kind, start, end, insert}
	}
	const at = faker.number.int({min: lo, max: hi})
	return {kind: 'inSlotInsert', start: at, end: at, insert: word()}
}

// --- Slot-leading documents (block rows) ---------------------------------------
// The sigil-based generateDocument/generateEdit API cannot express `\n\n`
// separators; the row family below covers the `'__slot__\n\n'` markup.

/** A slot-leading document: random words joined by `\n\n` (0–6 rows, some unterminated). */
export function generateSlotLeadingDocument(): string {
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
export function generateSlotLeadingEdit(doc: string): GeneratedEdit {
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

/** Offsets of the complete (separator-terminated), non-empty rows of a slot-leading document. */
function completeRows(doc: string): Array<{start: number; end: number}> {
	const out: Array<{start: number; end: number}> = []
	let at = 0
	for (let sep = doc.indexOf('\n\n'); sep !== -1; sep = doc.indexOf('\n\n', at)) {
		if (sep > at) out.push({start: at, end: sep})
		at = sep + 2
	}
	return out
}

/**
 * A structure-preserving random edit strictly inside a complete row's slot:
 * insert/delete/replace of plain alpha text. Deletes keep the row non-empty
 * (an emptied row loses its slot range) and never join `\n…\n` into a row
 * separator. Returns undefined when the document has no complete row.
 */
export function generateInRowEdit(doc: string): GeneratedEdit | undefined {
	const rows = completeRows(doc)
	if (rows.length === 0) return undefined
	const row = faker.helpers.arrayElement(rows)
	const kind = faker.helpers.arrayElement(['inRowInsert', 'inRowDelete', 'inRowReplace'])
	if (kind === 'inRowDelete' && row.end - row.start > 1) {
		const start = faker.number.int({min: row.start, max: row.end - 1})
		const maxEnd = start === row.start ? row.end - 1 : row.end
		const end = faker.number.int({min: start + 1, max: maxEnd})
		// rows may contain single '\n's: a delete must not make two of them
		// adjacent (that would SPLIT the row — a structural edit, not in-row)
		const joined = doc.slice(Math.max(0, start - 1), start) + doc.slice(end, end + 1)
		if (end > start && joined !== '\n\n') return {kind, start, end, insert: ''}
	}
	if (kind === 'inRowReplace') {
		const start = faker.number.int({min: row.start, max: row.end - 1})
		const end = faker.number.int({min: start + 1, max: row.end})
		let insert = word()
		if (insert === doc.slice(start, end)) insert += 'X'
		return {kind, start, end, insert}
	}
	const at = faker.number.int({min: row.start, max: row.end})
	return {kind: 'inRowInsert', start: at, end: at, insert: word()}
}

// --- Assertions ---------------------------------------------------------------

function collectTreeIds(tokens: readonly Token[], tracker: IdentityTracker, into = new Set<number>()): Set<number> {
	for (const token of tokens) {
		into.add(tracker.idOf(token))
		if (token.type === 'mark') collectTreeIds(token.children, tracker, into)
	}
	return into
}

/** Resolve a tree path to its token, or undefined if the path is invalid. */
function tokenAtPath(tokens: readonly Token[], path: readonly number[]): Token | undefined {
	let level: readonly Token[] | undefined = tokens
	let token: Token | undefined
	for (const i of path) {
		if (!level) return undefined
		// .at keeps the index lookup typed as possibly-undefined (an out-of-bounds
		// path component returns undefined) so the guard below is a real check.
		token = level.at(i)
		if (!token) return undefined
		level = token.type === 'mark' ? token.children : undefined
	}
	return token
}

/** Independent structural comparison (positions shifted by `delta`). */
function structurallyEqual(a: Token, b: Token, delta: number): boolean {
	if (a.type !== b.type || a.content !== b.content) return false
	if (a.position.start + delta !== b.position.start || a.position.end + delta !== b.position.end) return false
	if (a.type === 'mark' && b.type === 'mark') {
		if (a.descriptor !== b.descriptor || a.value !== b.value || a.meta !== b.meta) return false
		if (a.children.length !== b.children.length) return false
		return a.children.every((child, i) => structurallyEqual(child, b.children[i], delta))
	}
	return true
}

/** The whole subtree must carry the previous token's ids (suffix shift). */
function expectInheritedIds(prev: Token, next: Token, tracker: IdentityTracker): void {
	expect(tracker.idOf(next), 'shifted token must keep its id').toBe(tracker.idOf(prev))
	if (prev.type === 'mark' && next.type === 'mark') {
		prev.children.forEach((child, i) => expectInheritedIds(child, next.children[i], tracker))
	}
}

/** Deepest mark whose slot range contains [start, end] — the descend target of an in-slot edit. */
function deepestSlotMarkContaining(tokens: readonly Token[], start: number, end: number): MarkToken | undefined {
	for (const token of tokens) {
		if (token.type !== 'mark') continue
		const slot = token.slot
		if (!slot || start < slot.start || end > slot.end) continue
		return deepestSlotMarkContaining(token.children, start, end) ?? token
	}
	return undefined
}

/**
 * Reconcile one edit and assert the property. Returns the reconciled tokens so
 * chained edits can continue from them.
 */
function assertReconcileEquivalence(
	parser: Parser,
	tracker: IdentityTracker,
	prevTokens: Token[],
	prevValue: string,
	nextValue: string,
	edit: GeneratedEdit,
	useHint: boolean
): Token[] {
	const prevIds = collectTreeIds(prevTokens, tracker)
	const hint = editHintOf(edit)
	const result = useHint
		? tracker.reconcile(parser.parse(nextValue), hint)
		: tracker.reconcile(parser.parse(nextValue), undefined, prevValue, nextValue)
	const fresh = parser.parse(nextValue)

	// 1. Output equivalence: the reconciled tree must match a fresh parse on
	//    every parser-produced field. toMatchObject (not toEqual) because
	//    reconcile stamps the extra `id` field on its output — `fresh` carries none.
	expect(result.tokens).toMatchObject(fresh)

	// 1b. Identity-field coherence: every reconciled token carries its id as a
	//     plain field, equal to the tracker's answer (the phase-1 WeakMap shim).
	const assertIdField = (tokens: readonly Token[]): void => {
		for (const token of tokens) {
			expect(token.id, 'reconciled token must carry its id as a plain field').toBe(tracker.idOf(token))
			if (token.type === 'mark') assertIdField(token.children)
		}
	}
	assertIdField(result.tokens)

	// 2. Change id invariants (Phase 2: routing kinds, not buckets).
	const newIds = collectTreeIds(result.tokens, tracker)
	const added = result.changes.filter(c => c.kind === 'add').map(c => c.id)
	const textChanged = result.changes.filter(c => c.kind === 'text').map(c => c.id)
	const updated = result.changes.filter(c => c.kind === 'update').map(c => c.id)
	const removed = result.removedIds

	// 2a. Path correctness (Phase 2): every emitted change resolves, at its path,
	//     to its own token in the OUTPUT tree, and the entry id matches.
	for (const change of result.changes) {
		const at = tokenAtPath(result.tokens, change.path)
		expect(at, `change path [${change.path.join(', ')}] must resolve in the output tree`).toBe(change.token)
		expect(change.token.id, 'change token must carry the change id').toBe(change.id)
	}

	for (const id of removed) {
		expect(prevIds.has(id), `removed id ${id} was never in the previous tree`).toBe(true)
		expect(newIds.has(id), `removed id ${id} is still present in the new tree`).toBe(false)
	}
	for (const id of added) {
		expect(prevIds.has(id), `added id ${id} already existed in the previous tree`).toBe(false)
		expect(newIds.has(id), `added id ${id} is missing from the new tree`).toBe(true)
	}
	for (const id of updated) {
		expect(prevIds.has(id), `updated id ${id} was never in the previous tree`).toBe(true)
		expect(newIds.has(id), `updated id ${id} is missing from the new tree`).toBe(true)
	}
	for (const id of textChanged) {
		expect(prevIds.has(id), `textChanged id ${id} was never in the previous tree`).toBe(true)
		expect(newIds.has(id), `textChanged id ${id} is missing from the new tree`).toBe(true)
	}
	// Every TOP-LEVEL previous token either survives or is reported removed.
	// (Descendants of a textChanged mark are deliberately not deep-diffed —
	// see the TokenChangeEntry doc comment in tokenIdentity.ts.)
	const removedSet = new Set(removed)
	for (const token of prevTokens) {
		const id = tracker.idOf(token)
		expect(
			newIds.has(id) || removedSet.has(id),
			`top-level previous id ${id} neither survived nor was reported removed`
		).toBe(true)
	}

	// 3. Deep-descend invariants (in-slot/in-row edit classes): a structure-
	//    preserving edit inside a slot must put the containing mark in
	//    `updated` with a stable id, and the covering text child in
	//    `textChanged` with a stable id — never mark-level textChanged, never
	//    added/removed (the generators only emit these kinds when a complete
	//    slot/row exists, so no skip path is needed here).
	if (edit.kind.startsWith('inSlot') || edit.kind.startsWith('inRow')) {
		const mark = deepestSlotMarkContaining(prevTokens, edit.start, edit.end)
		expect(mark, 'an in-slot edit must land inside a previous slot mark').toBeDefined()
		if (!mark) throw new Error('unreachable')
		const markId = tracker.idOf(mark)
		expect(updated, 'in-slot edit: the mark must be in updated').toContain(markId)
		expect(textChanged, 'in-slot edit: the mark must not be textChanged').not.toContain(markId)
		expect(added, 'in-slot edit: the mark must not be added').not.toContain(markId)
		expect(removed, 'in-slot edit: the mark must not be removed').not.toContain(markId)
		const child = mark.children.find(
			c => c.type === 'text' && c.position.start <= edit.start && edit.end <= c.position.end
		)
		expect(child, 'in-slot edit: a text child must cover the edit window').toBeDefined()
		if (!child) throw new Error('unreachable')
		const childId = tracker.idOf(child)
		expect(textChanged, 'in-slot edit: the covering text child must be textChanged').toContain(childId)
		expect(newIds.has(childId), 'in-slot edit: the child id must survive into the new tree').toBe(true)
	}

	// 4. Identity stability at the edges (true-hint runs only — the contract is
	//    defined relative to the edit window).
	if (useHint) {
		const delta = hint.insertedLength - (hint.end - hint.start)
		// untouched prefix: reused by REFERENCE
		let p = 0
		while (
			p < prevTokens.length &&
			p < fresh.length &&
			prevTokens[p].position.end <= hint.start &&
			structurallyEqual(prevTokens[p], fresh[p], 0)
		) {
			expect(result.tokens[p], 'untouched prefix token must be reused by reference').toBe(prevTokens[p])
			p++
		}
		// suffix-shifted tokens: ids stable across the whole subtree
		let prevTail = prevTokens.length - 1
		let nextTail = fresh.length - 1
		while (
			prevTail >= p &&
			nextTail >= p &&
			prevTokens[prevTail].position.start >= hint.end &&
			structurallyEqual(prevTokens[prevTail], fresh[nextTail], delta)
		) {
			expectInheritedIds(prevTokens[prevTail], result.tokens[nextTail], tracker)
			prevTail--
			nextTail--
		}
	}

	return result.tokens
}

// --- Property runner ----------------------------------------------------------

function runProperty(markup: Markup, sigil: string, iterations: number, inSlot = false): void {
	const parser = new Parser([markup])
	for (let i = 0; i < iterations; i++) {
		const seed = BASE_SEED + i
		faker.seed(seed)
		const doc = generateDocument(sigil)
		const tracker = createIdentityTracker()
		let value = doc
		let tokens = tracker.reconcile(parser.parse(doc)).tokens
		// every other iteration chains a second edit through the SAME tracker
		// to exercise the previous-tree bookkeeping
		const rounds = 1 + (i % 2)
		// every 4th iteration exercises the no-hint (findGap-derived) path
		const useHint = i % 4 !== 3
		for (let round = 0; round < rounds; round++) {
			// every 3rd edit of an in-slot run targets a slot interior (descend class)
			const edit =
				(inSlot && (i + round) % 3 === 0 ? generateInSlotEdit(value, sigil) : undefined) ??
				generateEdit(value, sigil)
			const next = applyEdit(value, edit)
			try {
				tokens = assertReconcileEquivalence(parser, tracker, tokens, value, next, edit, useHint)
			} catch (error) {
				const detail = [
					`seed=${seed} iteration=${i} round=${round} markup=${markup} useHint=${useHint}`,
					`document: ${JSON.stringify(value)}`,
					`edit:     ${JSON.stringify(edit)}`,
					`next:     ${JSON.stringify(next)}`,
				].join('\n')
				throw new Error(
					`tokenIdentity equivalence property failed\n${detail}\n\n${error instanceof Error ? error.message : String(error)}`,
					{cause: error}
				)
			}
			value = next
		}
	}
}

function runSlotLeadingProperty(iterations: number): void {
	const markup: Markup = '__slot__\n\n'
	const parser = new Parser([markup])
	for (let i = 0; i < iterations; i++) {
		const seed = BASE_SEED + i
		faker.seed(seed)
		const doc = generateSlotLeadingDocument()
		const tracker = createIdentityTracker()
		let value = doc
		let tokens = tracker.reconcile(parser.parse(doc)).tokens
		const rounds = 1 + (i % 2)
		const useHint = i % 4 !== 3
		for (let round = 0; round < rounds; round++) {
			// 2 of 3 edits stay inside a row (the block-typing descend class);
			// the rest exercise row split/merge through the same tracker
			const edit =
				((i + round) % 3 !== 2 ? generateInRowEdit(value) : undefined) ?? generateSlotLeadingEdit(value)
			const next = applyEdit(value, edit)
			try {
				tokens = assertReconcileEquivalence(parser, tracker, tokens, value, next, edit, useHint)
			} catch (error) {
				const detail = [
					`seed=${seed} iteration=${i} round=${round} markup=${JSON.stringify(markup)} useHint=${useHint}`,
					`document: ${JSON.stringify(value)}`,
					`edit:     ${JSON.stringify(edit)}`,
					`next:     ${JSON.stringify(next)}`,
				].join('\n')
				throw new Error(
					`tokenIdentity equivalence property failed\n${detail}\n\n${error instanceof Error ? error.message : String(error)}`,
					{cause: error}
				)
			}
			value = next
		}
	}
}

describe('tokenIdentity equivalence property', () => {
	it('value markup @[…]: reconciled tree deep-equals a fresh parse and ids follow the contract', () => {
		runProperty('@[__value__]', '@', ITERATIONS)
	})

	it('slot markup #[…]: nested children follow the contract too, in-slot edits descend', () => {
		runProperty('#[__slot__]', '#', Math.ceil(ITERATIONS / 2), true)
	})

	it('slot-leading markup __slot__\\n\\n: in-row edits descend (mark updated, child ids stable)', () => {
		runSlotLeadingProperty(Math.ceil(ITERATIONS / 2))
	})
})