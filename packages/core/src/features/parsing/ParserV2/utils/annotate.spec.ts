import {describe, expect, it} from 'vitest'
import {Markup} from '../types'
import {annotate} from './annotate'

describe(`Utility: ${annotate.name}`, () => {
	it('should annotate with value only', () => {
		const markup: Markup = '@[__value__]'
		const result = annotate(markup, {value: 'Hello'})
		expect(result).toBe('@[Hello]')
	})

	it('should annotate with value and meta', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: 'Hello', meta: 'world'})
		expect(result).toBe('@[Hello](world)')
	})

	it('should annotate with nested only', () => {
		const markup: Markup = '@[__nested__]'
		const result = annotate(markup, {nested: 'content'})
		expect(result).toBe('@[content]')
	})

	it('should annotate with value and nested', () => {
		const markup: Markup = '@[__value__](__nested__)'
		const result = annotate(markup, {value: 'user', nested: 'Hello world'})
		expect(result).toBe('@[user](Hello world)')
	})

	it('should annotate with all three placeholders', () => {
		const markup: Markup = '<__value__ __meta__>__nested__</__value__>'
		const result = annotate(markup, {value: 'div', meta: 'class', nested: 'Content'})
		expect(result).toBe('<div class>Content</div>')
	})

	it('should keep unreplaced placeholders when param not provided', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: 'Hello'})
		expect(result).toBe('@[Hello](__meta__)')
	})

	it('should handle empty values', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: '', meta: ''})
		expect(result).toBe('@[]()')
	})

	it('should handle optional parameters', () => {
		const markup: Markup = '@[__value__]'
		const result = annotate(markup, {})
		expect(result).toBe('@[__value__]')
	})

	it('should handle nested content with special characters', () => {
		const markup: Markup = '@[__nested__]'
		const result = annotate(markup, {nested: 'Hello #[world]'})
		expect(result).toBe('@[Hello #[world]]')
	})
})
