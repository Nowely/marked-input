import {describe, expect, it} from 'vitest'

import type {Markup} from '../types'
import {denote} from './denote'

describe('Utility: denote', () => {
	const markup: Markup = '@[__value__](__meta__)'

	it('should transform annotated text to display text', () => {
		const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @[Bye](ByeValue)!"
		const displayText = denote(annotatedText, mark => mark.value, [markup])
		const expected = "Enter the '@' for calling Hello suggestions and '/' for Bye!"
		expect(displayText).toBe(expected)
	})

	it('should accept plain text without changing', () => {
		const text = "Enter the '@' for calling Hello suggestions and '/' for Bye!"
		expect(denote(text, mark => mark.value, [markup])).toBe(text)
	})

	it('should accept empty text', () => {
		const empty = ''
		expect(denote(empty, mark => mark.value, [markup])).toBe(empty)
	})

	it('should ignore other annotations', () => {
		const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @(Bye)[ByeValue]!"
		expect(denote(annotatedText, mark => mark.value, [markup])).toBe(
			"Enter the '@' for calling Hello suggestions and '/' for @(Bye)[ByeValue]!"
		)
	})

	it('should accept zero markups', () => {
		const annotatedText = "Enter the '@' for calling @[Hello](HelloValue) suggestions and '/' for @[Bye](ByeValue)!"
		expect(denote(annotatedText, mark => mark.value, [])).toBe(annotatedText)
	})

	it('should handle nested annotations recursively', () => {
		const markup1: Markup = '@[__slot__]'
		const markup2: Markup = '#[__slot__]'
		const annotatedText = '@[Hello #[world]]'
		const result = denote(annotatedText, mark => mark.value, [markup1, markup2])
		expect(result).toBe('Hello world')
	})

	it('should handle multiple markups', () => {
		const markup1: Markup = '@[__value__](__meta__)'
		const markup2: Markup = '#[__value__]'
		const annotatedText = 'Text @[Hello](world) and #[tag]'
		const result = denote(annotatedText, mark => mark.value, [markup1, markup2])
		expect(result).toBe('Text Hello and tag')
	})

	it('should handle callback returning meta', () => {
		const annotatedText = '@[Hello](world)'
		const result = denote(annotatedText, mark => mark.meta || '', [markup])
		expect(result).toBe('world')
	})
})