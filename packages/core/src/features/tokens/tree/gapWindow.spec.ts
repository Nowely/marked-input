import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {gapWindow, invertWindow} from './gapWindow'
import type {Window} from './types'

const BASE_SEED = 8_082_026
/** ~200 keeps CI-tolerable runtime; bump locally for soak runs. */
const ITERATIONS = 200
/** Tiny alphabet so random pairs hit overlapping prefix/suffix repeats often. */
const ALPHABET = 'aab@[] x'

const randomText = (max: number): string => faker.string.fromCharacters(ALPHABET, faker.number.int({min: 0, max}))

function randomPair(): [string, string] {
	const previous = randomText(20)
	const start = faker.number.int({min: 0, max: previous.length})
	const end = faker.number.int({min: start, max: previous.length})
	return [previous, previous.slice(0, start) + randomText(5) + previous.slice(end)]
}

describe('gapWindow', () => {
	it('derives the replaced range for a middle edit', () => {
		expect(gapWindow('hello', 'heXYllo')).toEqual({start: 2, end: 2, insertedLength: 2})
	})
	it('clamps overlapping prefix/suffix (aa → aaa)', () => {
		expect(gapWindow('aa', 'aaa')).toEqual({start: 2, end: 2, insertedLength: 1})
	})
	it('handles prepend (previous value is a suffix of the next)', () => {
		expect(gapWindow('bc', 'abc')).toEqual({start: 0, end: 0, insertedLength: 1})
	})
	it('handles full replacement', () => {
		expect(gapWindow('abc', 'xyz')).toEqual({start: 0, end: 3, insertedLength: 3})
	})
	it('pins the identical-value no-op window at the end of the value', () => {
		expect(gapWindow('abc', 'abc')).toEqual({start: 3, end: 3, insertedLength: 0})
	})

	// The literal expectations outlive the deleted differential check: they were
	// derived from the reconcile hint this function replaced, and each one is now
	// asserted on its own.
	it('derives the fixture windows', () => {
		const cases: [previous: string, next: string, expected: Window][] = [
			['hello', 'heXYllo', {start: 2, end: 2, insertedLength: 2}],
			['abcdef', 'abef', {start: 2, end: 4, insertedLength: 0}],
			['abc', 'bc', {start: 0, end: 1, insertedLength: 0}],
			['abcd', 'ab', {start: 2, end: 4, insertedLength: 0}],
			['abc', 'xyz', {start: 0, end: 3, insertedLength: 3}],
			['bc', 'abc', {start: 0, end: 0, insertedLength: 1}],
			['ab', 'abc', {start: 2, end: 2, insertedLength: 1}],
			['', 'abc', {start: 0, end: 0, insertedLength: 3}],
			['abc', '', {start: 0, end: 3, insertedLength: 0}],
			['abc', 'abc', {start: 3, end: 3, insertedLength: 0}],
			['aa', 'aaa', {start: 2, end: 2, insertedLength: 1}],
			['aaa', 'aa', {start: 2, end: 3, insertedLength: 0}],
			['x@[a]x@[a]x', 'x@[a]xx', {start: 6, end: 10, insertedLength: 0}],
		]
		for (const [previous, next, expected] of cases) {
			const detail = `${JSON.stringify(previous)} → ${JSON.stringify(next)}`
			expect(gapWindow(previous, next), detail).toEqual(expected)
		}
	})

	it('inverts to the splice that undoes it, over the same generated pairs', () => {
		// The inverse is asserted the only way it can be checked without a tree: applying it to
		// `next` must reproduce `previous`, in `next`'s own coordinates.
		for (let i = 0; i < ITERATIONS; i++) {
			const seed = BASE_SEED + i
			faker.seed(seed)
			const [previous, next] = randomPair()
			const inverse = invertWindow(gapWindow(previous, next))
			const detail = `seed=${seed} ${JSON.stringify(previous)} → ${JSON.stringify(next)}`

			const applied =
				next.slice(0, inverse.start) +
				previous.slice(inverse.start, inverse.start + inverse.insertedLength) +
				next.slice(inverse.end)
			expect(applied, detail).toBe(previous)
		}
	})

	it('reads the pairing the other way round, and twice is where it started', () => {
		// `pairing[j] = i` says previous row `i` became row `j`; undoing that move means row `j`
		// becomes row `i`. A move of the first row of three to the middle, and back.
		const moved: Window = {start: 0, end: 6, insertedLength: 6, pairing: [1, 0, 2]}
		expect(invertWindow(moved)).toEqual({start: 0, end: 6, insertedLength: 6, pairing: [1, 0, 2]})

		const rotated: Window = {start: 0, end: 9, insertedLength: 9, pairing: [1, 2, 0]}
		expect(invertWindow(rotated).pairing).toEqual([2, 0, 1])
		expect(invertWindow(invertWindow(rotated))).toEqual(rotated)
	})

	it('carries no pairing when the window had none', () => {
		expect(invertWindow({start: 2, end: 2, insertedLength: 1})).toEqual({start: 2, end: 3, insertedLength: 0})
	})

	it('reproduces the next value from the previous one across generated pairs', () => {
		for (let i = 0; i < ITERATIONS; i++) {
			const seed = BASE_SEED + i
			faker.seed(seed)
			const [previous, next] = randomPair()
			const window = gapWindow(previous, next)
			const detail = `seed=${seed} ${JSON.stringify(previous)} → ${JSON.stringify(next)}: ${JSON.stringify(window)}`

			expect(window.start, detail).toBeGreaterThanOrEqual(0)
			expect(window.end, detail).toBeGreaterThanOrEqual(window.start)
			expect(previous.length, detail).toBeGreaterThanOrEqual(window.end)
			expect(window.insertedLength, detail).toBeGreaterThanOrEqual(0)

			const applied =
				previous.slice(0, window.start) +
				next.slice(window.start, window.start + window.insertedLength) +
				previous.slice(window.end)
			expect(applied, detail).toBe(next)
		}
	})
})