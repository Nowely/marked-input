import {describe, expect, it} from 'vitest'

import type {Markup} from '../types'
import {annotate} from './annotate'

describe(`Utility: ${annotate.name}`, () => {
	it('annotate with value only', () => {
		const markup: Markup = '@[__value__]'
		const result = annotate(markup, {value: 'Hello'})
		expect(result).toBe('@[Hello]')
	})

	it('annotate with value and meta', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: 'Hello', meta: 'world'})
		expect(result).toBe('@[Hello](world)')
	})

	it('annotate with slot only', () => {
		const markup: Markup = '@[__slot__]'
		const result = annotate(markup, {slot: 'content'})
		expect(result).toBe('@[content]')
	})

	it('annotate with value and nested', () => {
		const markup: Markup = '@[__value__](__slot__)'
		const result = annotate(markup, {value: 'user', slot: 'Hello world'})
		expect(result).toBe('@[user](Hello world)')
	})

	it('annotate with all three placeholders', () => {
		const markup: Markup = '<__value__ __meta__>__slot__</__value__>'
		const result = annotate(markup, {value: 'div', meta: 'class', slot: 'Content'})
		expect(result).toBe('<div class>Content</div>')
	})

	it('keep unreplaced placeholders when param not provided', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: 'Hello'})
		expect(result).toBe('@[Hello](__meta__)')
	})

	it('handle empty values', () => {
		const markup: Markup = '@[__value__](__meta__)'
		const result = annotate(markup, {value: '', meta: ''})
		expect(result).toBe('@[]()')
	})

	it('handle optional parameters', () => {
		const markup: Markup = '@[__value__]'
		const result = annotate(markup, {})
		expect(result).toBe('@[__value__]')
	})

	it('handle slot content with special characters', () => {
		const markup: Markup = '@[__slot__]'
		const result = annotate(markup, {slot: 'Hello #[world]'})
		expect(result).toBe('@[Hello #[world]]')
	})
})