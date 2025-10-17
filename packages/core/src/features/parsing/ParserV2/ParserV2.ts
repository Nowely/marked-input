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
		const matchResults = MatchPostProcessor.convertToResults(
			sortedValidatedMatches,
			value,
			this.registry.descriptors
		)

		return buildTree(value, matchResults)
	}

	/**
	 * Escapes markup segments in the given text
	 * @param text Text to escape segments in
	 * @param escaper Function that receives a segment string and returns the escaped version. If not provided, segments are removed (replaced with empty strings)
	 * @returns Text with escaped or removed segments
	 * TODO don't work correctly
	 */
	escape(text: string, escaper?: (segment: string) => string): string {
		const matches = this.ac.search(text)
		if (matches.length === 0) return text

		const sortedMatches = matches.sort((a, b) => a.start - b.start)

		return sortedMatches.reduce((result, match, i) => {
			const prevEnd = i === 0 ? 0 : sortedMatches[i - 1].end
			return result + text.substring(prevEnd, match.start) + (escaper
				? escaper(text.substring(match.start, match.end))
				: '')
		}, '') + text.substring(sortedMatches[sortedMatches.length - 1].end)
	}
}
