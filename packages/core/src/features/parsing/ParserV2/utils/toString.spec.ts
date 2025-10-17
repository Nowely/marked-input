import {describe, expect, it} from 'vitest'
import {Markup} from '../types'
import {toString} from './toString'
import {ParserV2} from '../ParserV2'

describe('Utility: toString', () => {
	it('should reconstruct simple annotated text', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[Hello](world)'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should reconstruct text with multiple annotations', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[First](1) and @[Second](2)'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should reconstruct nested annotations', () => {
		const markup1: Markup = '@[__nested__]'
		const markup2: Markup = '#[__nested__]'
		const text = '@[Hello #[world]]'
		const tokens = new ParserV2([markup1, markup2]).split(text)
		const result = toString(tokens, [markup1, markup2])
		expect(result).toBe(text)
	})

	it('should handle plain text', () => {
		const markup: Markup = '@[__value__]'
		const text = 'Plain text without markup'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should handle empty text', () => {
		const markup: Markup = '@[__value__]'
		const text = ''
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should reconstruct complex nested structure', () => {
		const markup1: Markup = '@[__value__](__nested__)'
		const markup2: Markup = '#[__nested__]'
		const text = '@[user](Hello #[world])'
		const tokens = new ParserV2([markup1, markup2]).split(text)
		const result = toString(tokens, [markup1, markup2])
		expect(result).toBe(text)
	})

	it('should handle mixed value and nested', () => {
		const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']
		const text = '@[Hello](world) and #[tag]'
		const tokens = new ParserV2(markups).split(text)
		const result = toString(tokens, markups)
		expect(result).toBe(text)
	})

	it('should reconstruct HTML-like patterns', () => {
		const markup: Markup = '<__value__>__nested__</__value__>'
		const text = '<div>Content here</div>'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should handle adjacent annotations', () => {
		const markup: Markup = '@[__value__]'
		const text = '@[First]@[Second]'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})

	it('should handle empty values', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[]() @[label]()'
		const tokens = new ParserV2([markup]).split(text)
		const result = toString(tokens, [markup])
		expect(result).toBe(text)
	})
})

