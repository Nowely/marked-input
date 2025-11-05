import {Markup} from './types'
import {Token} from './types'
import {MarkToken} from './types'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {PatternProcessor} from './core/PatternProcessor'
import {AhoCorasick} from './utils/AhoCorasick'
import {createTextToken} from './core/TokenBuilder'
import {buildTree} from './core/TreeBuilder'
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

	static split(value: string, options?: {markup: Markup}[]): Token[] {
		const markups = options?.map(c => c.markup)
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new Parser(markups).split(value)
	}

	static join(tokens: Token[]): string {
		return tokensToString(tokens)
	}

	split(value: string): Token[] {
		const segments = this.ac.search(value)
		const matchStates = this.patternProcessor.process(segments, value)
		return buildTree(matchStates, value)
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
		const matches = this.ac.search(text)
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
