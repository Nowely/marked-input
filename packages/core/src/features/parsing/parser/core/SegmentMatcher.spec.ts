import {describe, expect, it} from 'vitest'

import type {Markup} from '../types'
import {MarkupRegistry} from './MarkupRegistry'
import type {SegmentDefinition} from './SegmentMatcher'
import {SegmentMatcher} from './SegmentMatcher'

describe('SegmentMatcher', () => {
	describe('static segments', () => {
		it('should find static segments in text', () => {
			const segments: SegmentDefinition[] = ['<', '>', '</']
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<div>content</div>')

			expect(result).toHaveLength(4)
			expect(result[0]).toEqual({index: 0, start: 0, end: 1, value: '<'})
			expect(result[1]).toEqual({index: 1, start: 4, end: 5, value: '>'})
			expect(result[2]).toEqual({index: 2, start: 12, end: 14, value: '</'})
			expect(result[3]).toEqual({index: 1, start: 17, end: 18, value: '>'})
		})
	})

	describe('dynamic segments', () => {
		it('should find dynamic segments in text', () => {
			const segments: SegmentDefinition[] = [
				['<', '>', '</'],
				['</', '>', ''],
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<div>content</div>')

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				index: 0,
				start: 0,
				end: 5,
				value: '<div>',
				captured: 'div',
			})
			expect(result[1]).toEqual({
				index: 1,
				start: 12,
				end: 18,
				value: '</div>',
				captured: 'div',
			})
		})

		it('should find multiple matches of same dynamic pattern', () => {
			const segments: SegmentDefinition[] = [
				['<', '>', '</'],
				['</', '>', ''],
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<img>photo.jpg</img>')

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				index: 0,
				start: 0,
				end: 5,
				value: '<img>',
				captured: 'img',
			})
			expect(result[1]).toEqual({
				index: 1,
				start: 14,
				end: 20,
				value: '</img>',
				captured: 'img',
			})
		})
	})

	describe('mixed segments', () => {
		it('should find both static and dynamic segments', () => {
			const segments: SegmentDefinition[] = [
				['<', ' ', '>'], // Dynamic: matches "<div " (with space at end, tag name validation)
				['</', '>', ''], // Dynamic: matches "</div>"
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<div class>content</div>')

			// Should find: "<div " and "</div>"
			// Note: the space is part of the first dynamic segment
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({
				index: 0,
				start: 0,
				end: 5,
				value: '<div ',
				captured: 'div',
			})
			expect(result[1]).toEqual({
				index: 1,
				start: 18,
				end: 24,
				value: '</div>',
				captured: 'div',
			})
		})

		it('should correctly segment complex HTML-like structure', () => {
			// Use MarkupRegistry to generate segments from the actual markup patterns
			const markups: Markup[] = [
				'<__value__ __meta__>__slot__</__value__>',
				'<__value__>__slot__</__value__>',
				'**__slot__**',
			]
			const registry = new MarkupRegistry(markups)
			const matcher = new SegmentMatcher(registry.segments)
			const result = matcher.search('<div class><p>Text **bold**</p></div>')

			expect(result).toHaveLength(8)
			// Verify the results match the expected segmentation
			expect(result[0]).toEqual({
				index: 0,
				start: 0,
				end: 5,
				value: '<div ',
				captured: 'div',
			})
			expect(result[1]).toEqual({
				index: 3,
				start: 10,
				end: 11,
				value: '>',
				captured: undefined,
			})
			expect(result[2]).toEqual({
				index: 6,
				start: 11,
				end: 14,
				value: '<p>',
				captured: 'p',
			})
			expect(result[3]).toEqual({
				index: 2,
				start: 18,
				end: 19,
				value: ' ',
				captured: undefined,
			})
			expect(result[4]).toEqual({
				index: 7,
				start: 19,
				end: 21,
				value: '**',
				captured: undefined,
			})
			expect(result[5]).toEqual({
				index: 7,
				start: 25,
				end: 27,
				value: '**',
				captured: undefined,
			})
			expect(result[6]).toEqual({
				index: 4,
				start: 27,
				end: 31,
				value: '</p>',
				captured: 'p',
			})
			expect(result[7]).toEqual({
				index: 4,
				start: 31,
				end: 37,
				value: '</div>',
				captured: 'div',
			})
		})
	})
})