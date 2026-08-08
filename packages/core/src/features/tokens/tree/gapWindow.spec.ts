import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {findGap} from '../utils/findGap'
import {gapWindow} from './gapWindow'
import type {Window} from './types'

/**
 * Verbatim copy of the private `hintFromValues` in `../tokenIdentity.ts` (it is
 * not exported, and that file must not be touched). It is the policy `gapWindow`
 * ports, so the differential below pins the port byte-for-byte; delete this
 * reference together with `tokenIdentity.ts`.
 */
function hintFromValues(previousValue: string, nextValue: string): Window {
	const gap = findGap(previousValue, nextValue)
	const prefix = gap.left ?? previousValue.length
	const suffix = gap.right === undefined ? previousValue.length : previousValue.length - gap.right
	const clampedSuffix = Math.min(suffix, Math.min(previousValue.length, nextValue.length) - prefix)
	const start = prefix
	const end = previousValue.length - clampedSuffix
	const insertedLength = nextValue.length - clampedSuffix - start
	return {start, end, insertedLength}
}

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

	it('matches the tokenIdentity hintFromValues policy on the fixture table', () => {
		const cases: [string, string][] = [
			['hello', 'heXYllo'],
			['abcdef', 'abef'],
			['abc', 'xyz'],
			['bc', 'abc'],
			['ab', 'abc'],
			['', 'abc'],
			['abc', ''],
			['abc', 'abc'],
			['aa', 'aaa'],
			['aaa', 'aa'],
			['x@[a]x@[a]x', 'x@[a]xx'],
		]
		for (const [previous, next] of cases) {
			const detail = `${JSON.stringify(previous)} → ${JSON.stringify(next)}`
			expect(gapWindow(previous, next), detail).toEqual(hintFromValues(previous, next))
		}
	})

	it('reproduces the next value from the previous one across generated pairs', () => {
		faker.seed(BASE_SEED)
		for (let i = 0; i < ITERATIONS; i++) {
			const [previous, next] = randomPair()
			const window = gapWindow(previous, next)
			const detail = `${JSON.stringify(previous)} → ${JSON.stringify(next)}: ${JSON.stringify(window)}`

			expect(window.start, detail).toBeGreaterThanOrEqual(0)
			expect(window.end, detail).toBeGreaterThanOrEqual(window.start)
			expect(previous.length, detail).toBeGreaterThanOrEqual(window.end)
			expect(window.insertedLength, detail).toBeGreaterThanOrEqual(0)

			const applied =
				previous.slice(0, window.start) +
				next.slice(window.start, window.start + window.insertedLength) +
				previous.slice(window.end)
			expect(applied, detail).toBe(next)
			expect(window, detail).toEqual(hintFromValues(previous, next))
		}
	})
})