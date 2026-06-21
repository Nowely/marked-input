import {describe, expect, it} from 'vitest'

import {Parser} from './parser/Parser'
import type {MarkToken, Token} from './parser/types'
import {createIdentityTracker} from './tokenIdentity'
import type {ReconcileResult} from './tokenIdentity'

// Pinned parser shapes (verified against real output):
// 'he@[x]llo'  → text 'he' [0,2], mark '@[x]' [2,6] (children: []), text 'llo' [6,9]
// 'he@[x]lAlo' → text 'he' [0,2], mark '@[x]' [2,6], text 'lAlo' [6,10]
// 'hAe@[x]llo' → text 'hAe' [0,3], mark '@[x]' [3,7], text 'llo' [7,10]
// 'hello'      → text 'hello' [0,5]
// 'he@[x]llo!' → text 'he' [0,2], mark '@[x]' [2,6], text 'llo!' [6,10]
// '#[ab]tail'  → text '' [0,0], mark '#[ab]' [0,5] (children: [text 'ab' [2,4]]), text 'tail' [5,9]
// '#[ab]tailX' → text '' [0,0], mark '#[ab]' [0,5] (children: [text 'ab' [2,4]]), text 'tailX' [5,10]
const parser = new Parser(['@[__value__]'])

describe('tokenIdentity', () => {
	it('first reconcile assigns fresh ids and reports full', () => {
		const tracker = createIdentityTracker()
		const next = parser.parse('he@[x]llo')
		const result = tracker.reconcile(next)
		expect(result.structural).toBe(true)
		expect(result.changes.every(c => c.kind === 'add')).toBe(true)
		expect(result.tokens).toHaveLength(3)
		const ids = result.tokens.map(t => tracker.idOf(t))
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
	})

	it('pure text edit: prefix reused by reference, edited token textChanged, suffix shifted with stable ids', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const [text1, mark, text2] = first
		const idText2 = tracker.idOf(text2)

		// insert 'A' inside the trailing text: 'he@[x]lAlo', edit at offset 7
		const result = tracker.reconcile(parser.parse('he@[x]lAlo'), {start: 7, end: 7, insertedLength: 1})

		expect(result.structural).toBe(false)
		// prefix: identical region reused by REFERENCE
		expect(result.tokens[0]).toBe(text1)
		expect(result.tokens[1]).toBe(mark)
		// edited token: new object, SAME id, listed in textChanged
		expect(result.tokens[2]).not.toBe(text2)
		expect(tracker.idOf(result.tokens[2])).toBe(idText2)
		expect(result.changes.filter(c => c.kind === 'text').map(c => c.id)).toEqual([idText2])
		expect(result.changes.filter(c => c.kind === 'add').map(c => c.id)).toEqual([])
		expect(result.removedIds).toEqual([])
	})

	it('suffix shift: edit before a mark keeps the mark id and reports updated', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = tracker.idOf(first[1])
		const tailId = tracker.idOf(first[2])

		// insert at offset 1 inside 'he' → mark and tail shift right by 1
		const result = tracker.reconcile(parser.parse('hAe@[x]llo'), {start: 1, end: 1, insertedLength: 1})
		const updated = result.changes.filter(c => c.kind === 'update').map(c => c.id)
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		expect(tracker.idOf(result.tokens[2])).toBe(tailId)
		expect(updated).toContain(markId)
		expect(updated).toContain(tailId)
		// shifted tokens are NEW objects (positions differ) with identical content
		expect(result.tokens[1]).not.toBe(first[1])
		expect(result.tokens[1].content).toBe(first[1].content)
	})

	it('structural change: deleting a mark reports removed + textChanged/merge, no id reuse for the gone mark', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = tracker.idOf(first[1])

		// delete the mark entirely: 'hello' (positions 2..6 removed)
		const result = tracker.reconcile(parser.parse('hello'), {start: 2, end: 6, insertedLength: 0})
		expect(result.removedIds).toContain(markId)
		expect(result.tokens.some(t => tracker.idOf(t) === markId)).toBe(false)
	})

	it('structural change: deleting a nested mark reports its CHILD id in removed too', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tracker = createIdentityTracker()
		// '#[ab]tail' → [text '' [0,0], mark '#[ab]' [0,5] (children: [text 'ab' [2,4]]), text 'tail' [5,9]]
		const first = tracker.reconcile(slotParser.parse('#[ab]tail')).tokens
		const mark = first[1]
		if (mark.type !== 'mark') throw new Error('expected mark')
		const markId = tracker.idOf(mark)
		const childId = tracker.idOf(mark.children[0])

		// delete the mark entirely: 'tail' (positions 0..5 removed)
		const result = tracker.reconcile(slotParser.parse('tail'), {start: 0, end: 5, insertedLength: 0})
		expect(result.removedIds).toContain(markId)
		// the deleted mark's descendant must land in removed as well
		expect(result.removedIds).toContain(childId)
		expect(result.tokens.some(t => tracker.idOf(t) === markId)).toBe(false)
	})

	it('no hint derives the window via findGap and keeps identity', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = tracker.idOf(first[1])
		const result = tracker.reconcile(parser.parse('he@[x]llo!'))
		// without a hint the changeset must be conservative, but identity should
		// still survive for the untouched prefix (findGap fallback)
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		// the untouched prefix is reused by reference, not just by id
		expect(result.tokens[0]).toBe(first[0])
		expect(result.tokens[1]).toBe(first[1])
	})

	it('no hint: prepend derives a window from token contents even when findGap reports no right edge', () => {
		// findGap('he@[x]llo', 'Xhe@[x]llo') → {left: 0, right: undefined} — the
		// whole previous value is a suffix of the next one. The hint derivation
		// must clamp instead of bailing out. With no hint, reconcile reconstructs
		// both values from the token contents.
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = tracker.idOf(first[1])
		const tailId = tracker.idOf(first[2])

		const result = tracker.reconcile(parser.parse('Xhe@[x]llo'), undefined)
		const updated = result.changes.filter(c => c.kind === 'update').map(c => c.id)
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		expect(tracker.idOf(result.tokens[2])).toBe(tailId)
		expect(updated).toContain(markId)
		expect(updated).toContain(tailId)
	})

	it('reconcile with an unchanged value reuses every token by reference with an empty delta', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const firstIds = first.map(t => tracker.idOf(t))
		const result = tracker.reconcile(parser.parse('he@[x]llo'))
		expect(result.structural).toBe(false)
		expect(result.changes).toEqual([])
		expect(result.removedIds).toEqual([])
		result.tokens.forEach((token, i) => expect(token).toBe(first[i]))
		// repeated reconciles must not allocate phantom ids for the discarded
		// parse arrays: ids stay stable and a 3rd reconcile still returns the
		// very same objects with the very same ids
		const third = tracker.reconcile(parser.parse('he@[x]llo'))
		third.tokens.forEach((token, i) => {
			expect(token).toBe(first[i])
			expect(tracker.idOf(token)).toBe(firstIds[i])
		})
		// ids are sequential from 1; a brand-new foreign token gets the very next
		// id after the 3 originals — proof the discarded arrays got no ids
		expect(tracker.idOf(parser.parse('zzz')[0])).toBe(4)
	})

	it('nested children: ids stable for children of an unchanged mark', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tracker = createIdentityTracker()
		// '#[ab]tail' → [text '' [0,0], mark '#[ab]' [0,5], text 'tail' [5,9]]
		// (the parser emits an empty leading text token before a value-initial mark)
		const first = tracker.reconcile(slotParser.parse('#[ab]tail')).tokens
		expect(first).toHaveLength(3)
		const mark = first[1]
		if (mark.type !== 'mark') throw new Error('expected mark')
		expect(mark.children).toHaveLength(1)
		const childId = tracker.idOf(mark.children[0])

		const result = tracker.reconcile(slotParser.parse('#[ab]tailX'), {start: 9, end: 9, insertedLength: 1})
		const mark2 = result.tokens[1]
		if (mark2.type !== 'mark') throw new Error('expected mark')
		expect(mark2).toBe(mark) // untouched prefix mark reused by reference
		expect(tracker.idOf(mark2.children[0])).toBe(childId)
	})
})

// Pinned parser shapes for the descend fixtures (verified against real output):
// '#[ab]tail'      → text '' [0,0], mark '#[ab]' [0,5] {value '', slot 'ab' [2,4], children: [text 'ab' [2,4]]}, text 'tail' [5,9]
// '#[aXb]tail'     → text '' [0,0], mark '#[aXb]' [0,6] {slot 'aXb' [2,5]}, text 'tail' [6,10]
// '#[a #[b] c]'    → mark [0,11] {slot 'a #[b] c' [2,10], children: [text 'a ' [2,4], mark '#[b]' [4,8] {slot 'b' [6,7]}, text ' c' [8,10]]}
// '#[a c]'         → mark '#[a c]' [0,6] {slot 'a c' [2,5], children: [text 'a c' [2,5]]}
// '#[]'            → mark '#[]' [0,3] {value '', NO slot, children: [text '' [2,2]]}
// '@[v](ab)'       → mark '@[v](ab)' [0,8] {value 'v', slot 'ab' [5,7], children: [text 'ab' [5,7]]}
// '#[ab](m)'       → mark '#[ab](m)' [0,8] {value '', meta 'm', slot 'ab' [2,4], children: [text 'ab' [2,4]]}
// 'abc\n\ndef\n\n' → text '' [0,0], mark 'abc\n\n' [0,5] {slot 'abc' [0,3], children: [text 'abc' [0,3]]},
//                    text '' [5,5], mark 'def\n\n' [5,10] {slot 'def' [5,8], children: [text 'def' [5,8]]}, text '' [10,10]
//
// Dual-markup parser(['#[__slot__]', '%[__slot__]']) shapes for the descriptor-mismatch fixture:
// '#[a #[b] c]' → [text '' [0,0], mark '#[…]' [0,11] {slot [2,10], children: [text 'a ' [2,4], mark '#[b]' [4,8] {descriptor index 0, slot 'b' [6,7]}, text ' c' [8,10]]}, text '' [11,11]]
// '#[a %[b] c]' → [text '' [0,0], mark '#[…]' [0,11] {slot [2,10], children: [text 'a ' [2,4], mark '%[b]' [4,8] {descriptor index 1, slot 'b' [6,7]}, text ' c' [8,10]]}, text '' [11,11]]
// same outer descriptor, same child count (3), aligned types — inner descriptors differ (index 0 vs 1)
describe('deep reconcile (descend)', () => {
	const slotParser = new Parser(['#[__slot__]'])

	// Phase 2: the four legacy id buckets re-derived from the new change shape, so
	// the descend assertions below read as before (added/removed/textChanged/updated).
	const delta = (result: ReconcileResult) => ({
		added: result.changes.filter(c => c.kind === 'add').map(c => c.id),
		textChanged: result.changes.filter(c => c.kind === 'text').map(c => c.id),
		updated: result.changes.filter(c => c.kind === 'update').map(c => c.id),
		removed: result.removedIds,
	})

	const asMark = (token: Token): MarkToken => {
		if (token.type !== 'mark') throw new Error('expected mark')
		return token
	}

	it('in-slot edit descends: child textChanged, mark updated, both ids stable, output ≡ fresh parse', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(slotParser.parse('#[ab]tail')).tokens
		const mark = asMark(first[1])
		const markId = tracker.idOf(mark)
		const childId = tracker.idOf(mark.children[0])
		const tailId = tracker.idOf(first[2])

		// insert 'X' inside the slot: '#[ab]tail' → '#[aXb]tail'
		const result = tracker.reconcile(slotParser.parse('#[aXb]tail'), {start: 3, end: 3, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(slotParser.parse('#[aXb]tail'))
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		// the changed text lives on the CHILD; the mark is an update, not a text change
		expect(changeset.textChanged).toEqual([childId])
		expect(changeset.updated).toContain(markId)
		expect(changeset.updated).toContain(tailId) // suffix text shifted by +1
		// ids carried onto the NEW objects (content/positions/slot updated)
		const mark2 = asMark(result.tokens[1])
		expect(mark2).not.toBe(mark)
		expect(tracker.idOf(mark2)).toBe(markId)
		expect(tracker.idOf(mark2.children[0])).toBe(childId)
		// untouched prefix reused by reference
		expect(result.tokens[0]).toBe(first[0])
	})

	it('nested descend (mark-in-slot-in-mark): inner child textChanged, both marks updated, untouched in-slot siblings reused by reference', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(slotParser.parse('#[a #[b] c]')).tokens
		const outer = asMark(first[1])
		const [head, innerToken, tail] = outer.children
		const inner = asMark(innerToken)
		const outerId = tracker.idOf(outer)
		const innerId = tracker.idOf(inner)
		const innerChildId = tracker.idOf(inner.children[0])
		const headId = tracker.idOf(head)
		const tailId = tracker.idOf(tail)

		// insert 'X' inside the INNER slot ('b' → 'bX', absolute offset 7)
		const result = tracker.reconcile(slotParser.parse('#[a #[bX] c]'), {start: 7, end: 7, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(slotParser.parse('#[a #[bX] c]'))
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		expect(changeset.textChanged).toEqual([innerChildId])
		expect(changeset.updated).toContain(outerId)
		expect(changeset.updated).toContain(innerId)
		expect(changeset.updated).toContain(tailId) // ' c' shifted within the slot
		const outer2 = asMark(result.tokens[1])
		// in-slot child before the edit window: byte-identical → reused by REFERENCE
		expect(outer2.children[0]).toBe(head)
		expect(tracker.idOf(outer2.children[0])).toBe(headId)
		const inner2 = asMark(outer2.children[1])
		expect(tracker.idOf(inner2)).toBe(innerId)
		expect(tracker.idOf(inner2.children[0])).toBe(innerChildId)
		expect(tracker.idOf(outer2.children[2])).toBe(tailId)
	})

	it('block-row fixture (slot-leading): typing in a row descends, later rows update with stable ids', () => {
		const rowParser = new Parser(['__slot__\n\n'])
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(rowParser.parse('abc\n\ndef\n\n')).tokens
		const rowA = asMark(first[1])
		const rowB = asMark(first[3])
		const rowAId = tracker.idOf(rowA)
		const rowAChildId = tracker.idOf(rowA.children[0])
		const rowBId = tracker.idOf(rowB)
		const rowBChildId = tracker.idOf(rowB.children[0])

		// keystroke inside the first row: 'abc' → 'aXbc'
		const result = tracker.reconcile(rowParser.parse('aXbc\n\ndef\n\n'), {start: 1, end: 1, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(rowParser.parse('aXbc\n\ndef\n\n'))
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		expect(changeset.textChanged).toEqual([rowAChildId])
		expect(changeset.updated).toContain(rowAId)
		expect(changeset.updated).toContain(rowBId)
		expect(changeset.updated).toContain(rowBChildId)
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(rowAId)
		expect(tracker.idOf(asMark(result.tokens[3]))).toBe(rowBId)
		expect(tracker.idOf(asMark(result.tokens[1]).children[0])).toBe(rowAChildId)
	})

	it('refusal: value differs → mark-level textChanged with id inheritance (handle continuity)', () => {
		const valueSlotParser = new Parser(['@[__value__](__slot__)'])
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(valueSlotParser.parse('@[v](ab)')).tokens
		const mark = asMark(first[1])
		const markId = tracker.idOf(mark)
		const childId = tracker.idOf(mark.children[0])

		// edit the VALUE: '@[v](ab)' → '@[w](ab)'
		const result = tracker.reconcile(valueSlotParser.parse('@[w](ab)'), {start: 2, end: 3, insertedLength: 1})
		const changeset = delta(result)

		// a refused deep-descend renders framework props → structural (the routing
		// contract: a kind:'text' entry whose token is a MARK forces structural).
		expect(result.structural).toBe(true)
		expect(changeset.textChanged).toEqual([markId])
		expect(changeset.updated).toEqual([])
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		// continuity: the SAME id answers for the new mark and its child
		const mark2 = asMark(result.tokens[1])
		expect(tracker.idOf(mark2)).toBe(markId)
		expect(tracker.idOf(mark2.children[0])).toBe(childId)
	})

	it('refusal: meta differs → mark-level textChanged with id inheritance', () => {
		const metaSlotParser = new Parser(['#[__slot__](__meta__)'])
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(metaSlotParser.parse('#[ab](m)')).tokens
		const mark = asMark(first[1])
		const markId = tracker.idOf(mark)

		// edit the META: '#[ab](m)' → '#[ab](n)'
		const result = tracker.reconcile(metaSlotParser.parse('#[ab](n)'), {start: 6, end: 7, insertedLength: 1})
		const changeset = delta(result)

		expect(result.structural).toBe(true)
		expect(changeset.textChanged).toEqual([markId])
		expect(changeset.updated).toEqual([])
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(markId)
	})

	it('refusal: child count differs → mark-level textChanged, subtree treated dirty (no per-child diff)', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(slotParser.parse('#[a #[b] c]')).tokens
		const outer = asMark(first[1])
		const outerId = tracker.idOf(outer)
		const tailTextId = tracker.idOf(first[2])

		// delete '#[b] ' from the slot: children collapse 3 → 1
		const result = tracker.reconcile(slotParser.parse('#[a c]'), {start: 4, end: 9, insertedLength: 0})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(slotParser.parse('#[a c]'))
		expect(result.structural).toBe(true)
		expect(changeset.textChanged).toEqual([outerId])
		expect(changeset.updated).toEqual([tailTextId]) // trailing '' shifted by -5
		expect(changeset.added).toEqual([])
		// pinned: the refused mark's subtree is DIRTY, not diffed — the vanished
		// inner mark is not reported removed (consumers treat the mark as opaque)
		expect(changeset.removed).toEqual([])
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(outerId)
	})

	it('refusal: nested-mark descriptor mismatch → mark-level textChanged with id inheritance', () => {
		// Real parser(dual-markup) fixture: '#[a #[b] c]' and '#[a %[b] c]' produce
		// same child count (3), aligned types — inner descriptors differ (index 0 vs 1).
		// Pin shapes with a failing assertion first (verified against real output above).
		const dualParser = new Parser(['#[__slot__]', '%[__slot__]'])
		const tokensA = dualParser.parse('#[a #[b] c]')
		const tokensB = dualParser.parse('#[a %[b] c]')

		// shape pin: both produce 3 top-level tokens
		expect(tokensA).toHaveLength(3)
		expect(tokensB).toHaveLength(3)

		const outerA = asMark(tokensA[1])
		const outerB = asMark(tokensB[1])

		// shape pin: both outer marks have 3 children
		expect(outerA.children).toHaveLength(3)
		expect(outerB.children).toHaveLength(3)

		const innerA = asMark(outerA.children[1])
		const innerB = asMark(outerB.children[1])

		// shape pin: aligned types (text, mark, text) and differing inner descriptors
		expect(outerA.children[0].type).toBe('text')
		expect(outerA.children[2].type).toBe('text')
		expect(outerB.children[0].type).toBe('text')
		expect(outerB.children[2].type).toBe('text')
		expect(innerA.descriptor).not.toBe(innerB.descriptor)
		// same outer descriptor (both use '#[__slot__]', index 0)
		expect(outerA.descriptor).toBe(outerB.descriptor)

		const tracker = createIdentityTracker()
		tracker.reconcile(tokensA)
		const markId = tracker.idOf(outerA)

		// edit: '#[a #[b] c]' → '#[a %[b] c]' — replace '#' at offset 4 with '%'
		const result = tracker.reconcile(tokensB, {start: 4, end: 5, insertedLength: 1})
		const changeset = delta(result)

		expect(changeset.textChanged).toEqual([markId])
		expect(changeset.updated).toEqual([])
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(markId)
	})

	it('refusal nested in a descended slot: value-changed inner mark sets structural (routing equivalence)', () => {
		// parser exposes BOTH an outer slot mark (descends) and an inner value mark
		// (refuses on value change). '#[a @[x] b]' → '#[a @[y] b]' edits only the
		// inner value: the outer slot descends, but the inner refused-descend MARK
		// reported as kind:'text' inside pairSlotChildren must still flip structural.
		const nestedParser = new Parser(['#[__slot__]', '@[__value__]'])
		const tracker = createIdentityTracker()
		const tokensA = nestedParser.parse('#[a @[x] b]')
		const first = tracker.reconcile(tokensA).tokens
		const outer = asMark(first[1])
		const outerId = tracker.idOf(outer)
		const inner = asMark(outer.children[1])
		const innerId = tracker.idOf(inner)

		// edit the inner mark's VALUE 'x' → 'y' at absolute offset 6
		const result = tracker.reconcile(nestedParser.parse('#[a @[y] b]'), {start: 6, end: 7, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(nestedParser.parse('#[a @[y] b]'))
		// the outer slot descends (update), the inner mark refuses → kind:'text'
		expect(changeset.updated).toContain(outerId)
		expect(changeset.textChanged).toContain(innerId)
		// the refused-descend MARK must force structural even when nested inside a
		// descended slot — the routing contract the top-level walk already honors.
		expect(result.structural).toBe(true)
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
	})

	it('empty slot descends: zero-width window pairs the empty text child (first keystroke into a fresh row)', () => {
		const tracker = createIdentityTracker()
		// '#[]' keeps a zero-width slot range — empty slot ≠ no slot (parser
		// contract since the Phase 0 empty-row fix), so descend scopes its window
		// and the empty text child pairs 1:1 with the typed-into child.
		const first = tracker.reconcile(slotParser.parse('#[]')).tokens
		const mark = asMark(first[1])
		const markId = tracker.idOf(mark)
		const childId = tracker.idOf(mark.children[0])

		const result = tracker.reconcile(slotParser.parse('#[a]'), {start: 2, end: 2, insertedLength: 1})
		const changeset = delta(result)

		expect(result.tokens).toMatchObject(slotParser.parse('#[a]'))
		// Text-path shape: the child carries the change, the mark is an update.
		expect(changeset.textChanged).toEqual([childId])
		expect(changeset.added).toEqual([])
		expect(changeset.removed).toEqual([])
		expect(changeset.updated).toContain(markId)
		expect(tracker.idOf(asMark(result.tokens[1]))).toBe(markId)
		expect(tracker.idOf(asMark(result.tokens[1]).children[0])).toBe(childId)
	})
})

describe('token.id plain field (identity unification, phase 1)', () => {
	it('stamps id on every reconciled token, mirroring idOf', () => {
		const tracker = createIdentityTracker()
		const slotted = new Parser(['#[__slot__]'])
		const result = tracker.reconcile(slotted.parse('#[ab]tail'))

		const assertIdField = (tokens: readonly Token[]): void => {
			for (const token of tokens) {
				expect(token.id).toBe(tracker.idOf(token))
				if (token.type === 'mark') assertIdField(token.children)
			}
		}
		expect(result.tokens).toHaveLength(3)
		assertIdField(result.tokens)
	})

	it('a suffix-shifted token carries its inherited id as a field', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = first[1].id

		// edit before the mark: 'he@[x]llo' → 'hAe@[x]llo' — the mark suffix-
		// shifts into a NEW object; the id field must travel with the identity
		const result = tracker.reconcile(parser.parse('hAe@[x]llo'), {start: 1, end: 1, insertedLength: 1})

		expect(typeof markId).toBe('number')
		expect(result.tokens[1]).not.toBe(first[1])
		expect(result.tokens[1].id).toBe(markId)
	})
})

describe('reconcile structural result (phase 2)', () => {
	it('cold start: structural true, every token an add change at its path, no removals', () => {
		const tracker = createIdentityTracker()
		const slotted = new Parser(['#[__slot__]'])
		const result = tracker.reconcile(slotted.parse('#[ab]tail'))

		expect(result.structural).toBe(true)
		expect(result.removedIds).toEqual([])
		// '#[ab]tail' → text '' [0,0], mark '#[ab]' {child 'ab'}, text 'tail'
		// one add entry per token of the whole tree, each at its tree path
		const paths = result.changes.map(c => c.path)
		expect(paths).toContainEqual([0])
		expect(paths).toContainEqual([1])
		expect(paths).toContainEqual([1, 0])
		expect(paths).toContainEqual([2])
		for (const change of result.changes) {
			expect(change.kind).toBe('add')
			expect(change.id).toBe(change.token.id)
		}
	})

	it('a tail text edit: structural false, one text change at the tail path', () => {
		const tracker = createIdentityTracker()
		tracker.reconcile(parser.parse('he@[x]llo'))
		const result = tracker.reconcile(parser.parse('he@[x]llo!'), {start: 9, end: 9, insertedLength: 1})

		expect(result.structural).toBe(false)
		expect(result.removedIds).toEqual([])
		const text = result.changes.filter(c => c.kind === 'text')
		expect(text).toHaveLength(1)
		expect(text[0].path).toEqual([2])
		expect(text[0].token.content).toBe('llo!')
		expect(text[0].id).toBe(result.tokens[2].id)
	})

	it('a removed mark: structural true, the mark id (and child id) in removedIds', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = first[1].id
		const result = tracker.reconcile(parser.parse('hello'), {start: 2, end: 6, insertedLength: 0})

		expect(result.structural).toBe(true)
		expect(result.removedIds).toContain(markId)
	})
})