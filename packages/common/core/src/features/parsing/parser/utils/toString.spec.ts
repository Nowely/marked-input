import {describe, expect, it} from 'vitest'

import {Parser} from '../Parser'
import type {Markup} from '../types'
import {toString} from './toString'

describe('Utility: toString', () => {
	it('should reconstruct simple annotated text', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[Hello](world)'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should reconstruct text with multiple annotations', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[First](1) and @[Second](2)'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should reconstruct nested annotations', () => {
		const markup1: Markup = '@[__children__]'
		const markup2: Markup = '#[__children__]'
		const text = '@[Hello #[world]]'
		const tokens = new Parser([markup1, markup2]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should handle plain text', () => {
		const markup: Markup = '@[__value__]'
		const text = 'Plain text without markup'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should handle empty text', () => {
		const markup: Markup = '@[__value__]'
		const text = ''
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should reconstruct complex nested structure', () => {
		const markup1: Markup = '@[__value__](__children__)'
		const markup2: Markup = '#[__children__]'
		const text = '@[user](Hello #[world])'
		const tokens = new Parser([markup1, markup2]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should handle mixed value and nested', () => {
		const markups: Markup[] = ['@[__value__](__meta__)', '#[__value__]']
		const text = '@[Hello](world) and #[tag]'
		const tokens = new Parser(markups).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should reconstruct HTML-like patterns', () => {
		const markup: Markup = '<__value__>__children__</__value__>'
		const text = '<div>Content here</div>'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should handle adjacent annotations', () => {
		const markup: Markup = '@[__value__]'
		const text = '@[First]@[Second]'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})

	it('should handle empty values', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const text = '@[]() @[label]()'
		const tokens = new Parser([markup]).parse(text)
		const result = toString(tokens)
		expect(result).toBe(text)
	})
})