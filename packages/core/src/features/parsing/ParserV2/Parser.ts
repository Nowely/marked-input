import {Markup} from './types'
import {Token} from './types'
import {MarkToken} from './types'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {PatternMatcher} from './core/PatternMatcher'
import {AhoCorasick} from './utils/AhoCorasick'
import {RegexSegmentMatcher} from './utils/RegexSegmentMatcher'
import {IndexOfSegmentMatcher} from './utils/IndexOfSegmentMatcher'
import {createTextToken} from './core/TokenBuilder'
import {buildTree} from './core/TreeBuilder'
import {toString as tokensToString} from './utils/toString'
import {processTokensWithCallback} from './utils/denote'

export enum SegmentMatcherType {
	AHO_CORASICK = 'ahoCorasick',
	INDEX_OF = 'indexOf',
	REGEX = 'regex'
}

export class Parser {
	private readonly registry: MarkupRegistry
	private readonly segmentMatcher: AhoCorasick | IndexOfSegmentMatcher | RegexSegmentMatcher
	private readonly patternMatcher: PatternMatcher
	private readonly matcherType: SegmentMatcherType

	constructor(markups: Markup[], matcherType: SegmentMatcherType = SegmentMatcherType.REGEX) {
		this.registry = new MarkupRegistry(markups)
		this.matcherType = matcherType

		if (matcherType === SegmentMatcherType.REGEX) {
			this.segmentMatcher = new RegexSegmentMatcher(this.registry.segments)
		} else if (matcherType === SegmentMatcherType.INDEX_OF) {
			this.segmentMatcher = new IndexOfSegmentMatcher(this.registry.segments)
		} else {
			this.segmentMatcher = new AhoCorasick(this.registry.segments)
		}

		this.patternMatcher = new PatternMatcher(this.registry)
	}

	static split(value: string, options?: {markup: Markup[], matcherType?: SegmentMatcherType}): Token[] {
		const markups = options?.markup
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new Parser(markups, options?.matcherType ?? SegmentMatcherType.REGEX).split(value)
	}

	static join(tokens: Token[]): string {
		return tokensToString(tokens)
	}

	split(value: string): Token[] {
		const segments = this.segmentMatcher.search(value)
		const matches = this.patternMatcher.process(segments, value)
		return buildTree(matches, value)
	}

	join(tokens: Token[]): string {
		return tokensToString(tokens)
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
		const matches = this.segmentMatcher.search(text)
		if (matches.length === 0) return text

		// Sort matches by position
		matches.sort((a, b) => a.start - b.start)

		return (
			matches.reduce((result, match, i) => {
				const prevEnd = i === 0 ? 0 : matches[i - 1].end
				return (
					result +
					text.substring(prevEnd, match.start) +
					(escaper ? escaper(text.substring(match.start, match.end)) : '')
				)
			}, '') + text.substring(matches[matches.length - 1].end)
		)
	}
}
