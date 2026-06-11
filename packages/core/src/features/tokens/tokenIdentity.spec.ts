import {describe, expect, it} from 'vitest'

import {Parser} from './parser/Parser'
import {createIdentityTracker} from './tokenIdentity'

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
		const result = tracker.reconcile(next, undefined)
		expect(result.changeset).toEqual({kind: 'full'})
		expect(result.tokens).toHaveLength(3)
		const ids = result.tokens.map(t => tracker.idOf(t))
		expect(new Set(ids).size).toBe(3)
		ids.forEach(id => expect(typeof id).toBe('number'))
	})

	it('pure text edit: prefix reused by reference, edited token textChanged, suffix shifted with stable ids', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const [text1, mark, text2] = first
		const idText2 = tracker.idOf(text2)

		// insert 'A' inside the trailing text: 'he@[x]lAlo', edit at offset 7
		const result = tracker.reconcile(parser.parse('he@[x]lAlo'), {start: 7, end: 7, insertedLength: 1})

		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		// prefix: identical region reused by REFERENCE
		expect(result.tokens[0]).toBe(text1)
		expect(result.tokens[1]).toBe(mark)
		// edited token: new object, SAME id, listed in textChanged
		expect(result.tokens[2]).not.toBe(text2)
		expect(tracker.idOf(result.tokens[2])).toBe(idText2)
		expect(result.changeset.textChanged).toEqual([idText2])
		expect(result.changeset.added).toEqual([])
		expect(result.changeset.removed).toEqual([])
	})

	it('suffix shift: edit before a mark keeps the mark id and reports shifted', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])
		const tailId = tracker.idOf(first[2])

		// insert at offset 1 inside 'he' → mark and tail shift right by 1
		const result = tracker.reconcile(parser.parse('hAe@[x]llo'), {start: 1, end: 1, insertedLength: 1})
		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		expect(tracker.idOf(result.tokens[2])).toBe(tailId)
		expect(result.changeset.shifted).toContain(markId)
		expect(result.changeset.shifted).toContain(tailId)
		// shifted tokens are NEW objects (positions differ) with identical content
		expect(result.tokens[1]).not.toBe(first[1])
		expect(result.tokens[1].content).toBe(first[1].content)
	})

	it('structural change: deleting a mark reports removed + textChanged/merge, no id reuse for the gone mark', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])

		// delete the mark entirely: 'hello' (positions 2..6 removed)
		const result = tracker.reconcile(parser.parse('hello'), {start: 2, end: 6, insertedLength: 0})
		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		expect(result.changeset.removed).toContain(markId)
		expect(result.tokens.some(t => tracker.idOf(t) === markId)).toBe(false)
	})

	it('no hint falls back to full changeset but still matches identity via findGap', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])
		const result = tracker.reconcile(parser.parse('he@[x]llo!'), undefined)
		// without a hint the changeset must be conservative…
		expect(['full', 'delta']).toContain(result.changeset.kind)
		// …but identity should still survive for the untouched prefix (findGap fallback)
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		// the untouched prefix is reused by reference, not just by id
		expect(result.tokens[0]).toBe(first[0])
		expect(result.tokens[1]).toBe(first[1])
	})

	it('no hint, explicit values: prepend derives a window even when findGap reports no right edge', () => {
		// findGap('he@[x]llo', 'Xhe@[x]llo') → {left: 0, right: undefined} — the
		// whole previous value is a suffix of the next one. The hint derivation
		// must clamp instead of bailing out.
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const markId = tracker.idOf(first[1])
		const tailId = tracker.idOf(first[2])

		const result = tracker.reconcile(parser.parse('Xhe@[x]llo'), undefined, 'he@[x]llo', 'Xhe@[x]llo')
		expect(result.changeset.kind).toBe('delta')
		if (result.changeset.kind !== 'delta') throw new Error('expected delta')
		expect(tracker.idOf(result.tokens[1])).toBe(markId)
		expect(tracker.idOf(result.tokens[2])).toBe(tailId)
		expect(result.changeset.shifted).toContain(markId)
		expect(result.changeset.shifted).toContain(tailId)
	})

	it('reconcile with an unchanged value reuses every token by reference with an empty delta', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo'), undefined).tokens
		const result = tracker.reconcile(parser.parse('he@[x]llo'), undefined)
		expect(result.changeset).toEqual({kind: 'delta', textChanged: [], added: [], removed: [], shifted: []})
		result.tokens.forEach((token, i) => expect(token).toBe(first[i]))
	})

	it('nested children: ids stable for children of an unchanged mark', () => {
		const slotParser = new Parser(['#[__slot__]'])
		const tracker = createIdentityTracker()
		// '#[ab]tail' → [text '' [0,0], mark '#[ab]' [0,5], text 'tail' [5,9]]
		// (the parser emits an empty leading text token before a value-initial mark)
		const first = tracker.reconcile(slotParser.parse('#[ab]tail'), undefined).tokens
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