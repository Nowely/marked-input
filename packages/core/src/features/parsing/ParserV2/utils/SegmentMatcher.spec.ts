import {describe, it, expect} from 'vitest'
import {SegmentMatcher, SegmentDefinition} from './SegmentMatcher'
import {MarkupRegistry} from './MarkupRegistry'
import {Markup} from '../types'

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
				{template: '<{}>', pattern: '<(.+?)>'},
				{template: '</{}>', pattern: '</(.+?)>'},
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<div>content</div>')
			
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({index: 0, start: 0, end: 5, value: '<div>', captured: 'div', capturedStart: 1, capturedEnd: 4})
			expect(result[1]).toEqual({index: 1, start: 12, end: 18, value: '</div>', captured: 'div', capturedStart: 14, capturedEnd: 17})
		})

		it('should find multiple matches of same dynamic pattern', () => {
			const segments: SegmentDefinition[] = [
				{template: '<{}>', pattern: '<(.+?)>'},
				{template: '</{}>', pattern: '</(.+?)>'},
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<img>photo.jpg</img>')
			
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({index: 0, start: 0, end: 5, value: '<img>', captured: 'img', capturedStart: 1, capturedEnd: 4})
			expect(result[1]).toEqual({index: 1, start: 14, end: 20, value: '</img>', captured: 'img', capturedStart: 16, capturedEnd: 19})
		})
	})

	describe('mixed segments', () => {
		it('should find both static and dynamic segments', () => {
			const segments: SegmentDefinition[] = [
				{template: '<{} ', pattern: '<([a-zA-Z][^ >]*) '},  // Dynamic: matches "<div " (with space at end, tag name validation)
				{template: '</{}>', pattern: '</([^>]+)>'},  // Dynamic: matches "</div>"
			]
			const matcher = new SegmentMatcher(segments)
			const result = matcher.search('<div class>content</div>')

			// Should find: "<div " and "</div>"
			// Note: the space is part of the first dynamic segment
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({index: 0, start: 0, end: 5, value: '<div ', captured: 'div', capturedStart: 1, capturedEnd: 4})
			expect(result[1]).toEqual({index: 1, start: 18, end: 24, value: '</div>', captured: 'div', capturedStart: 20, capturedEnd: 23})
		})

		it('should correctly segment complex HTML-like structure', () => {
			// Use MarkupRegistry to generate segments from the actual markup patterns
			const markups: Markup[] = [
				'<__value__ __meta__>__nested__</__value__>',
				'<__value__>__nested__</__value__>',
				'**__nested__**'
			]
			const registry = new MarkupRegistry(markups)
			const matcher = new SegmentMatcher(registry.segments)
			const result = matcher.search('<div class><p>Text **bold**</p></div>')

			expect(result).toHaveLength(8)
			// Verify the results match the expected segmentation
			expect(result[0]).toEqual({index: 0, start: 0, end: 5, value: '<div ', captured: 'div', capturedStart: 1, capturedEnd: 4})
			expect(result[1]).toEqual({index: 3, start: 10, end: 11, value: '>', captured: undefined, capturedStart: undefined, capturedEnd: undefined})
			expect(result[2]).toEqual({index: 6, start: 11, end: 14, value: '<p>', captured: 'p', capturedStart: 12, capturedEnd: 13})
			expect(result[3]).toEqual({index: 2, start: 18, end: 19, value: ' ', captured: undefined, capturedStart: undefined, capturedEnd: undefined})
			expect(result[4]).toEqual({index: 7, start: 19, end: 21, value: '**', captured: undefined, capturedStart: undefined, capturedEnd: undefined})
			expect(result[5]).toEqual({index: 7, start: 25, end: 27, value: '**', captured: undefined, capturedStart: undefined, capturedEnd: undefined})
			expect(result[6]).toEqual({index: 4, start: 27, end: 31, value: '</p>', captured: 'p', capturedStart: 29, capturedEnd: 30})
			expect(result[7]).toEqual({index: 4, start: 31, end: 37, value: '</div>', captured: 'div', capturedStart: 33, capturedEnd: 36})
		})
	})
})

