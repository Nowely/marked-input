import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {filterEmptyText} from '../parser/utils/filterEmptyText'
import {adopt} from './adopt'
import {lowerReplace} from './offsetShim'
import {createTokenTree} from './tree'

const rows = new Parser(['__slot__\n\n'])

/**
 * RECORDED GAP (S1.6a hardening, measured): "pass sub-range ops through" is a DESIGN
 * CHOICE — spec D2's exact op window — and nothing in this repo gates it. Narrowing
 * EVERY op in the form that actually means that (splice the sub-range into the value
 * first, then gap-derive the result) survives the entire core suite. Only the literal
 * "drop the early return" edit goes red, and for an unrelated reason: it leaves
 * `gapWindow(value, replacement)` comparing the whole value against a bare fragment,
 * which breaks the two pass-through cases below (23 cases suite-wide).
 *
 * The first assertion that could tell the two apart is `map`'s fixed point, which
 * moves with the window and gets its consumer at S1.6c. Until then a test here would
 * pin the choice, not detect a defect.
 */
describe('lowerReplace', () => {
	it('passes a sub-range op through as the exact op window', () => {
		expect(lowerReplace('hello world', {start: 6, end: 11}, 'markput')).toEqual({
			window: {start: 6, end: 11, insertedLength: 7},
			text: 'markput',
		})
	})

	it('normalizes the end < 0 sentinel on a SUB-RANGE op', () => {
		// This is the case that isolates normalization: `{6,-1}` is not the whole value,
		// so it takes the pass-through arm and `end` must have become 11.
		expect(lowerReplace('hello world', {start: 6, end: -1}, 'markput')).toEqual({
			window: {start: 6, end: 11, insertedLength: 7},
			text: 'markput',
		})
	})

	it('the end < 0 sentinel over the WHOLE value is gap-derived, not passed through', () => {
		// `{0,-1}` on an 11-char value IS the whole-value trigger, so the op is re-derived
		// through gapWindow rather than passed through as {0,11}. The shared trailing 'd'
		// is a common suffix, so it is not part of the gap.
		expect(lowerReplace('hello world', {start: 0, end: -1}, 'replaced')).toEqual({
			window: {start: 0, end: 10, insertedLength: 7},
			text: 'replace',
		})
	})

	it('rejects the ranges replaceInString rejected', () => {
		expect(lowerReplace('hello', {start: -1, end: 1}, 'x')).toBeUndefined()
		expect(lowerReplace('hello', {start: 4, end: 2}, 'x')).toBeUndefined()
		expect(lowerReplace('hello', {start: 0, end: 6}, 'x')).toBeUndefined()
	})

	it('re-splices whole-value ops so the window is the real gap', () => {
		// 'aaa\n\nbbb\n\nccc\n\n' → 'aaa\n\nccc\n\n' (row 2 deleted). The op the caller
		// hands in is {0,15}; the gap is {5,10} with nothing inserted.
		const op = lowerReplace('aaa\n\nbbb\n\nccc\n\n', {start: 0, end: -1}, 'aaa\n\nccc\n\n')
		expect(op).toEqual({window: {start: 5, end: 10, insertedLength: 0}, text: ''})
	})

	it('the re-splice reproduces the caller-supplied value exactly', () => {
		// The whole contract in one line: whatever the narrowing does, applying the
		// window plus the sliced text to the old value must yield the new one.
		const cases: [string, string][] = [
			['aaa\n\nbbb\n\nccc\n\n', 'aaa\n\nccc\n\n'],
			['hello world', 'replaced'],
			['', 'first'],
			['hello', ''],
			['abc', 'abc'],
			['one\n\ntwo\n\nthree\n\n', 'one\n\nthree\n\n'],
		]
		for (const [value, next] of cases) {
			const op = lowerReplace(value, {start: 0, end: -1}, next)
			if (!op) throw new Error(`unexpected rejection for ${JSON.stringify(value)}`)
			const {window, text} = op
			expect(value.slice(0, window.start) + text + value.slice(window.end)).toBe(next)
			expect(text.length).toBe(window.insertedLength)
		}
	})

	it('KEEPS ROW IDENTITY where the full window loses it', () => {
		// The identity claim, measured both ways. Distinct row content is load-bearing:
		// see the separator-only case below, where the two windows agree.
		const source = 'aaa\n\nbbb\n\nccc\n\n'
		const next = 'aaa\n\nccc\n\n'
		const parse = (v: string) => filterEmptyText(rows.parse(v))

		const full = createTokenTree(parse(source))
		const fullIds = full.roots().map(n => n.id)
		adopt(full, {start: 0, end: source.length, insertedLength: next.length}, parse(next))
		expect(full.roots().map(n => n.id)).toEqual([fullIds[0], fullIds[1]]) // row 3's node died

		const narrowed = createTokenTree(parse(source))
		const ids = narrowed.roots().map(n => n.id)
		const op = lowerReplace(source, {start: 0, end: -1}, next)
		if (!op) throw new Error('expected an op')
		adopt(narrowed, op.window, parse(next))
		expect(narrowed.roots().map(n => n.id)).toEqual([ids[0], ids[2]]) // row 3 SURVIVED
	})

	it('RECORDED NON-IMPROVEMENT: rows that repeat the separator fall back to index pairing', () => {
		// 'one\n\ntwo\n\nthree\n\n' → 'one\n\nthree\n\n' gives {6,11,0}. `end` 11 lands
		// INSIDE row 3's span [10,17], so adoption's suffix bound
		// (`prev[tail].position.start >= window.end`) fails and the middle re-pairs by
		// index — the same outcome as the full window. gapWindow's clamp
		// (min(suffix, min(len) - prefix)) is what eats the narrowing. The IDENTITY
		// assertion below is a recorded non-improvement, not a defect gate; the WINDOW
		// assertion is a real gate — measured, it fails if whole-value ops stop being
		// gap-derived ({0,17,12} instead of {6,11,0}).
		const source = 'one\n\ntwo\n\nthree\n\n'
		const next = 'one\n\nthree\n\n'
		const parse = (v: string) => filterEmptyText(rows.parse(v))
		const tree = createTokenTree(parse(source))
		const ids = tree.roots().map(n => n.id)
		const op = lowerReplace(source, {start: 0, end: -1}, next)
		if (!op) throw new Error('expected an op')
		expect(op.window).toEqual({start: 6, end: 11, insertedLength: 0})
		adopt(tree, op.window, parse(next))
		expect(tree.roots().map(n => n.id)).toEqual([ids[0], ids[1]])
	})
})