import {MarkupRegistry} from './core/MarkupRegistry'
import {PatternMatcher} from './core/PatternMatcher'
import {SegmentMatcher} from './core/SegmentMatcher'
import {TreeBuilder} from './core/TreeBuilder'
import type {Markup, Token} from './types'

/**
 * Parser - High-performance tree-based markup parser
 *
 * Parses text with markup patterns into a nested token tree structure.
 * Supports complex patterns with metadata, nesting, and HTML-like constructs.
 *
 * @example
 * ```typescript
 * const parser = new Parser(['@[__value__](__meta__)', '#[__slot__]'])
 * const tokens = parser.parse('Hello @[world](test) and #[tag]')
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
	 * @param markups - Array of markup pattern strings with placeholders (can include undefined values):
	 *   - `__value__` - main content (plain text, no nesting)
	 *   - `__meta__` - metadata (plain text, no nesting)
	 *   - `__slot__` - content supporting nested structures
	 *   - `undefined` - skipped, but original array indices are preserved for descriptor matching
	 *
	 * @example
	 * ```typescript
	 * const parser = new Parser([
	 *   '@[__value__](__meta__)',  // @[label](value) - descriptor.index = 0
	 *   undefined,                 // skipped
	 *   '#[__slot__]',           // #[nested content] - descriptor.index = 2
	 *   '**__slot__**'           // **bold text** - descriptor.index = 3
	 * ])
	 * ```
	 */
	constructor(markups: (Markup | undefined)[]) {
		this.registry = new MarkupRegistry(markups)
		this.segmentMatcher = new SegmentMatcher(this.registry.segments)
		this.patternMatcher = new PatternMatcher(this.registry)
		this.treeBuilder = new TreeBuilder()
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
}