import {InnerOption} from '../../default/types'
import {Markup} from './types'
import {NestedToken} from './types'
import {MarkToken} from './types'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {PatternProcessor} from './core/PatternProcessor'
import {MatchPostProcessor} from './core/MatchPostProcessor'
import {AhoCorasick, SegmentMatch} from './utils/AhoCorasick'
import {buildTree} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'
import {toString as tokensToString} from './utils/toString'
import {processTokensWithCallback} from './utils/denote'

export class Parser {
	private readonly registry: MarkupRegistry
	private readonly ac: AhoCorasick
	private readonly patternProcessor: PatternProcessor

	constructor(markups: Markup[]) {
		this.registry = new MarkupRegistry(markups)
		this.ac = new AhoCorasick(this.registry.segments)
		this.patternProcessor = new PatternProcessor(this.registry)
	}

	static split(value: string, options?: {markup: Markup}[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new Parser(markups).split(value)
	}

	static join(tokens: NestedToken[], options?: {markup: Markup}[]): string {
		const markups = options?.map(c => c.markup) || []
		return tokensToString(tokens, markups)
	}

	split(value: string): NestedToken[] {
		const segmentMatches = this.ac.search(value)
		const sortedValidatedMatches = this.patternProcessor.processMatches(segmentMatches, value)
		const matchResults = MatchPostProcessor.convertToResults(
			sortedValidatedMatches,
			value,
			this.registry.descriptors
		)

		return buildTree(value, matchResults)
	}

	join(tokens: NestedToken[]): string {
		return tokensToString(tokens, this.registry.markups)
	}

	/**
	 * Transform annotated text by recursively processing all tokens with a callback
	 * @param value - Annotated text to process
	 * @param callback - Function to transform each MarkToken
	 * @returns Transformed text
	 */
	denote(value: string, callback: (mark: MarkToken) => string): string {
		const tokens = this.split(value)
		return processTokensWithCallback(tokens, callback)
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

		// Sort matches and filter out nested segments in one pass
		const filteredMatches = matches
			.filter((match, i, sortedMatches) => {
				// Check if this segment is completely contained within any previous segment
				for (let j = 0; j < i; j++) {
					const prevMatch = sortedMatches[j]
					if (match.start >= prevMatch.start && match.end <= prevMatch.end) {
						return false // This segment is nested within a previous segment
					}
				}
				return true
			})

		return filteredMatches.reduce((result, match, i) => {
			const prevEnd = i === 0 ? 0 : filteredMatches[i - 1].end
			return result + text.substring(prevEnd, match.start) + (escaper
				? escaper(text.substring(match.start, match.end))
				: '')
		}, '') + text.substring(filteredMatches[filteredMatches.length - 1].end)
	}
}
