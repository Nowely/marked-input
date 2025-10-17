import {InnerOption} from '../../default/types'
import {Markup} from './types'
import {NestedToken} from './types'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {SegmentMatcher} from './core/SegmentMatcher'
import {PatternProcessor} from './core/PatternProcessor'
import {MatchPostProcessor} from './core/MatchPostProcessor'
import {AhoCorasick, SegmentMatch} from './utils/AhoCorasick'
import {buildTree} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'

export class ParserV2 {
	private readonly registry: MarkupRegistry
	private readonly ac: AhoCorasick
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternProcessor: PatternProcessor

	constructor(markups: Markup[]) {
		this.registry = new MarkupRegistry(markups)
		this.ac = new AhoCorasick(this.registry.segments)
		this.segmentMatcher = new SegmentMatcher(this.registry)
		this.patternProcessor = new PatternProcessor(this.registry.descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new ParserV2(markups).split(value)
	}

	split(value: string): NestedToken[] {
		const segmentMatches = this.ac.search(value)
		const uniqueMatches = this.segmentMatcher.deduplicateMatches(segmentMatches)
		const sortedValidatedMatches = this.patternProcessor.processMatches(uniqueMatches, value)
		const matchResults = MatchPostProcessor.convertToResults(sortedValidatedMatches, value, this.registry.descriptors)

		return buildTree(value, matchResults)
	}

	/**
	 * Escapes markup segments in the given text
	 * @param text Text to escape segments in
	 * @param escaper Function that receives a segment string and returns the escaped version
	 * @returns Text with escaped segments
	 * TODO use AhoCorasick to find all segments and escape them
	 */
	escape(text: string, escaper?: (segment: string) => string): string {
		// If no escaper provided, return text unchanged
		if (!escaper) {
			return text
		}

		let result = text
		// Use pre-computed segments from registry
		const allSegments = this.registry.segments

		// Sort segments by length ascending to handle shorter segments first
		const sortedSegments = Array.from(allSegments).sort((a, b) => a.length - b.length)

		for (const segment of sortedSegments) {
			const escaped = escaper(segment)
			// Use global replace to escape all occurrences
			result = result.replace(new RegExp(escapeRegExp(segment), 'g'), escaped)
		}

		return result

		function escapeRegExp(string: string): string {
			return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		}
	}
}
