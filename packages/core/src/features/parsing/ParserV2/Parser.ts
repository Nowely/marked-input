import {Markup} from './types'
import {Token} from './types'
import {MarkToken} from './types'
import {MarkupRegistry} from './utils/MarkupRegistry'
import {PatternMatcher} from './core/PatternMatcher'
import {SegmentMatcher} from './utils/SegmentMatcher'
import {createTextToken} from './core/TokenBuilder'
import {TreeBuilder} from './core/TreeBuilder'
import {toString as tokensToString} from './utils/toString'
import {processTokensWithCallback} from './utils/denote'

/**
 * Parser - High-performance tree-based markup parser
 *
 * Parses text with markup patterns into a nested token tree structure.
 * Supports complex patterns with metadata, nesting, and HTML-like constructs.
 *
 * @example
 * ```typescript
 * const parser = new Parser(['@[__value__](__meta__)', '#[__nested__]'])
 * const tokens = parser.parse('Hello @[world](test) and #[tag]')
 * const text = parser.stringify(tokens)
 * ```
 */
export class Parser {
	private readonly registry: MarkupRegistry
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternMatcher: PatternMatcher
	private readonly treeBuilder: TreeBuilder

	/**
	 * Creates a new Parser instance with the specified markup patterns
	 *
	 * @param markups - Array of markup pattern strings with placeholders:
	 *   - `__value__` - main content (plain text, no nesting)
	 *   - `__meta__` - metadata (plain text, no nesting)
	 *   - `__nested__` - content supporting nested structures
	 *
	 * @example
	 * ```typescript
	 * const parser = new Parser([
	 *   '@[__value__](__meta__)',  // @[label](value)
	 *   '#[__nested__]',           // #[nested content]
	 *   '**__nested__**'           // **bold text**
	 * ])
	 * ```
	 */
	constructor(markups: Markup[]) {
		this.registry = new MarkupRegistry(markups)
		this.segmentMatcher = new SegmentMatcher(this.registry.segments)
		this.patternMatcher = new PatternMatcher(this.registry)
		this.treeBuilder = new TreeBuilder()
	}

	/**
	 * Parses text into tokens (static convenience method)
	 *
	 * @param value - Text to parse
	 * @param options - Options with markup patterns
	 * @returns Array of tokens (TextToken and MarkToken)
	 *
	 * @example
	 * ```typescript
	 * const tokens = Parser.parse('Hello @[world]', {
	 *   markup: ['@[__value__]']
	 * })
	 * ```
	 */
	static parse(value: string, options?: {markup: Markup[]}): Token[] {
		const markups = options?.markup
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new Parser(markups).parse(value)
	}

	/**
	 * Converts tokens back to text (static convenience method)
	 *
	 * @param tokens - Array of tokens to convert
	 * @returns Reconstructed text string
	 *
	 * @example
	 * ```typescript
	 * const text = Parser.stringify(tokens)
	 * ```
	 */
	static stringify(tokens: Token[]): string {
		return tokensToString(tokens)
	}

	/**
	 * Parses text into a nested token tree
	 *
	 * This is the main parsing method. It processes the input text through
	 * three stages:
	 * 1. Segment matching - finds all markup segments (O(N + M))
	 * 2. Pattern matching - builds complete patterns from segments (O(M))
	 * 3. Tree building - constructs nested token tree (O(M·D))
	 *
	 * @param value - Text to parse
	 * @returns Array of tokens representing the parsed structure
	 *
	 * @example
	 * ```typescript
	 * const parser = new Parser(['@[__value__](__meta__)'])
	 * const tokens = parser.parse('Hello @[world](test)')
	 * // Returns: [
	 * //   TextToken('Hello '),
	 * //   MarkToken('@[world](test)', value='world', meta='test'),
	 * //   TextToken('')
	 * // ]
	 * ```
	 */
	parse(value: string): Token[] {
		const segments = this.segmentMatcher.search(value)
		const matches = this.patternMatcher.process(segments)
		return this.treeBuilder.build(matches, value)
	}

	/**
	 * Converts tokens back to the original text
	 *
	 * This is the inverse operation of parse(). It reconstructs the original
	 * text from a token tree, preserving all markup and structure.
	 *
	 * @param tokens - Array of tokens to convert
	 * @returns Reconstructed text string
	 *
	 * @example
	 * ```typescript
	 * const text = 'Hello @[world](test)'
	 * const tokens = parser.parse(text)
	 * const reconstructed = parser.stringify(tokens)
	 * console.log(reconstructed === text) // true
	 * ```
	 */
	stringify(tokens: Token[]): string {
		return tokensToString(tokens)
	}

	/**
	 * Transforms annotated text by processing all mark tokens with a callback
	 *
	 * This method parses the text, recursively processes all MarkTokens
	 * (including nested ones) with the provided callback, and returns
	 * the transformed text.
	 *
	 * @param value - Annotated text to process
	 * @param callback - Function to transform each MarkToken
	 * @returns Transformed text
	 *
	 * @example
	 * ```typescript
	 * // Extract all values
	 * const text = '@[Hello](world) and #[tag]'
	 * const result = parser.transform(text, mark => mark.value)
	 * // Returns: 'Hello and tag'
	 *
	 * // Custom transformation
	 * const result = parser.transform(text, mark =>
	 *   mark.meta ? `${mark.value}:${mark.meta}` : mark.value
	 * )
	 * // Returns: 'Hello:world and tag'
	 * ```
	 */
	transform(value: string, callback: (mark: MarkToken) => string): string {
		const tokens = this.parse(value)
		return processTokensWithCallback(tokens, callback)
	}

	/**
	 * Escapes markup segments in the given text
	 *
	 * @param text - Text to escape segments in
	 * @param escaper - Function that receives a segment string and returns the escaped version.
	 *                  If not provided, segments are removed (replaced with empty strings)
	 * @returns Text with escaped or removed segments
	 *
	 * @deprecated This method has known issues and will be rewritten in a future version.
	 * TODO: Rewrite to properly handle complete patterns, not just segments
	 */
	escape(text: string, escaper?: (segment: string) => string): string {
		const matches = this.segmentMatcher.search(text)
		if (matches.length === 0) return text

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

	// ===== BACKWARD COMPATIBILITY ALIASES =====
	// These methods are deprecated and will be removed in v2.0
	// Use the new method names instead: parse(), stringify(), transform()

	/**
	 * @deprecated Use parse() instead. This alias will be removed in v2.0
	 */
	split(value: string): Token[] {
		return this.parse(value)
	}

	/**
	 * @deprecated Use stringify() instead. This alias will be removed in v2.0
	 */
	join(tokens: Token[]): string {
		return this.stringify(tokens)
	}

	/**
	 * @deprecated Use transform() instead. This alias will be removed in v2.0
	 */
	denote(value: string, callback: (mark: MarkToken) => string): string {
		return this.transform(value, callback)
	}

	/**
	 * @deprecated Use Parser.parse() instead. This alias will be removed in v2.0
	 */
	static split(value: string, options?: {markup: Markup[]}): Token[] {
		return Parser.parse(value, options)
	}

	/**
	 * @deprecated Use Parser.stringify() instead. This alias will be removed in v2.0
	 */
	static join(tokens: Token[]): string {
		return Parser.stringify(tokens)
	}
}
