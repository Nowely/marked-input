import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it} from 'vitest'

import {KEYBOARD} from '../../shared/constants'
import {filterSuggestions, suggestionLabel} from './filterSuggestions'
import {navigateSuggestions} from './suggestionNavigation'

const FAKER_SEED = 12345

beforeEach(() => {
	faker.seed(FAKER_SEED)
})

describe('navigateSuggestions', () => {
	/**
	 * THE ONLY REFUSAL. A list with no rows leaves every key to whoever else wants it — which is
	 * what keeps Enter splitting the row when the query matches nothing.
	 */
	describe('empty list', () => {
		it.each([KEYBOARD.UP, KEYBOARD.DOWN, KEYBOARD.ENTER, KEYBOARD.ESC])('answers none for %s', key => {
			expect(navigateSuggestions(key, 2, 0)).toEqual({action: 'none', index: 2})
		})
	})

	/**
	 * ENTER PICKS, WITH NO ARROW FIRST. A list that has rows always has one highlighted
	 * (`OverlayListModel.active`), so Enter is a complete gesture from the moment the list opens —
	 * `/page t` narrows to one entry and Enter takes it, where it used to split the row and leave
	 * the literal `/page t` behind.
	 */
	it('selects the highlighted row on ENTER, from the very first press', () => {
		expect(navigateSuggestions(KEYBOARD.ENTER, 0, 3)).toEqual({action: 'select', index: 0})
	})

	describe('DOWN', () => {
		it.each([
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
		])('moves %i to %i', (activeIndex, expected) => {
			expect(navigateSuggestions(KEYBOARD.DOWN, activeIndex, 4)).toEqual({action: 'down', index: expected})
		})
	})

	describe('UP', () => {
		it.each([
			[0, 3],
			[1, 0],
			[2, 1],
			[3, 2],
		])('moves %i to %i', (activeIndex, expected) => {
			expect(navigateSuggestions(KEYBOARD.UP, activeIndex, 4)).toEqual({action: 'up', index: expected})
		})

		// The outer `%` in `(length + ((activeIndex - 1) % length)) % length` is what keeps this in
		// range: without it activeIndex 1 answers `length`, one past the last row.
		it('keeps every result inside the list', () => {
			for (const length of [1, 2, 3, 8]) {
				for (let activeIndex = 0; activeIndex < length; activeIndex++) {
					const {index} = navigateSuggestions(KEYBOARD.UP, activeIndex, length)

					expect(index).toBeGreaterThanOrEqual(0)
					expect(index).toBeLessThan(length)
				}
			}
		})
	})

	it('selects the active index on ENTER', () => {
		expect(navigateSuggestions(KEYBOARD.ENTER, 2, 4)).toEqual({action: 'select', index: 2})
	})

	it.each([KEYBOARD.ESC, KEYBOARD.BACKSPACE, 'a'])('answers none and keeps the active index for %s', key => {
		expect(navigateSuggestions(key, 1, 4)).toEqual({action: 'none', index: 1})
	})
})

describe('filterSuggestions', () => {
	it('returns everything for an empty query', () => {
		const data = faker.helpers.multiple(() => faker.person.firstName(), {count: 5})

		expect(filterSuggestions(data, '')).toEqual(data)
	})

	it('matches regardless of the case of the query', () => {
		expect(filterSuggestions(['Alice', 'Bob'], 'ALI')).toEqual(['Alice'])
	})

	it('matches regardless of the case of the data', () => {
		expect(filterSuggestions(['ALICE', 'Bob'], 'ali')).toEqual(['ALICE'])
	})

	it('matches a substring, not only a prefix', () => {
		expect(filterSuggestions(['banana', 'melon'], 'nan')).toEqual(['banana'])
	})

	it('returns an empty list when nothing matches', () => {
		expect(filterSuggestions(['alpha', 'beta'], 'zzz')).toEqual([])
	})

	it('leaves the input untouched and answers a fresh array', () => {
		const data = faker.helpers.multiple(() => faker.person.firstName(), {count: 5})
		const before = [...data]

		const filtered = filterSuggestions(data, '')

		expect(data).toEqual(before)
		expect(filtered).not.toBe(data)
	})

	it('matches a row carrying an identity by the label it shows, not by what it writes', () => {
		const data = [
			{value: 'Sarah Chen', meta: 'sarah.chen'},
			{value: 'Marcus Kane', meta: 'marcus.kane'},
		]

		// `marcus.kane` is a substring of nothing shown: the id must not be part of the haystack.
		expect(filterSuggestions(data, 'kane')).toEqual([data[1]])
		expect(filterSuggestions(data, '.')).toEqual([])
	})

	it('prefers an explicit label over the value, which is the row a user reads', () => {
		expect(suggestionLabel('Alice')).toBe('Alice')
		expect(suggestionLabel({value: 'sarah.chen'})).toBe('sarah.chen')
		expect(suggestionLabel({value: 'sarah.chen', label: 'Sarah Chen'})).toBe('Sarah Chen')
	})
})