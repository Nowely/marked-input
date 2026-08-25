import {acceptMatches, closeTrailingGaps} from './core/InlineRules'
import type {MarkupDescriptor} from './core/MarkupDescriptor'
import {MarkupRegistry} from './core/MarkupRegistry'
import {PatternMatcher} from './core/PatternMatcher'
import type {RowDeclaration} from './core/RowKind'
import {scanRows} from './core/RowScanner'
import {SegmentMatcher} from './core/SegmentMatcher'
import {TreeBuilder} from './core/TreeBuilder'
import type {Markup, RowConfig, RowToken, Token} from './types'
import {createTextToken} from './utils/createTextToken'

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
	 * @param rows - Parallel declarations: a `true` compiles that markup as a ROW KIND, matched only
	 *   at a row's own start and never entered into the inline alternation; a {@link RowSplit}
	 *   compiles the same kind and carves its body into child rows of the option it names, which may
	 *   be one with no markup at all.
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
	constructor(markups: (Markup | undefined)[], rows: readonly (RowDeclaration | undefined)[] = []) {
		this.registry = new MarkupRegistry(markups, rows)
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
		// Inline is one implicit row (issue 08), starting at offset 0.
		return this.parseInline(value, 0)
	}

	/**
	 * THE inline chain, and the only one: segments, patterns, trailing-gap closure, tree. Both
	 * entries run it — `parse` over the whole value, `parseRows` over one row's body — because
	 * the scan-first inversion changed WHAT the chain is given, not what it does. Written once so
	 * a rule added here cannot reach one caller and miss the other.
	 *
	 * `start` is where `content` sits in the value; body-relative positions become absolute ones.
	 */
	private parseInline(content: string, start: number): Token[] {
		const segments = this.segmentMatcher.search(content)
		const matches = acceptMatches(this.patternMatcher.process(segments))
		// One scope is one gap closure: an open trailing gap closes at the end of the content it
		// was opened in — end of input for `parse`, the body's end for a row.
		closeTrailingGaps(matches, content.length)
		// Closure extends `end`, which can put two accepted matches back in conflict
		const tokens = this.treeBuilder.build(acceptMatches(matches), content)
		if (start !== 0) shiftTokens(tokens, start)
		return tokens
	}

	/**
	 * Parses text into rows — block layout's top level (ADR-0010: the skeleton is scanned
	 * before the inlines are parsed).
	 *
	 * THREE passes, no fixpoint. {@link scanRows} carves the rows by reading each row's own start
	 * and folds them into a tree by their indent, so a row's kind, its structural bytes, its body
	 * edges and its children are known before any inline matching happens; then the UNCHANGED
	 * inline chain runs per row over that row's body alone. An inline match therefore cannot span
	 * a row boundary, and a separator inside a row's raw body is that row's own text rather than
	 * a boundary.
	 *
	 * The piece after the final separator is a row even when empty, so Enter at the document end
	 * always yields a visible row.
	 *
	 * @param value - Text to parse
	 * @param config - The block parse policy; its separator is never part of any markup
	 *
	 * @example
	 * ```typescript
	 * const parser = new Parser(['# __slot__'], [true])
	 * const rows = parser.parseRows('# Title\n\nBody', {separator: '\n\n', indent: '\t'})
	 * // Returns: [
	 * //   RowToken('# Title\n\n', kind '# __slot__', children=[TextToken('Title')]),
	 * //   RowToken('Body', paragraph, children=[TextToken('Body')])
	 * // ]
	 * ```
	 */
	parseRows(value: string, config: RowConfig): RowToken[] {
		if (config.separator.length === 0) {
			throw new Error('Parser.parseRows: separator must be non-empty')
		}
		const rows = scanRows(value, this.registry.rowKinds, config, this.registry.rowSplits)
		this.#fillBodies(rows, value)
		return rows
	}

	/**
	 * The compiled ROW KIND this markup declares, or `undefined` when this parser took none from
	 * it — a mark markup, an absent one, or one that broke a row rule and was dropped at the props
	 * boundary. It is how a caller holding an option asks what its rows are made of without
	 * re-compiling the markup and getting a descriptor the scan has never seen.
	 *
	 * Keyed by the MARKUP and not by the option's index, because the option a consumer holds is
	 * not always the option the store holds: the Vue adapter rebuilds every option object on every
	 * prop sync, so a reference lookup answered `-1` there for options React resolved fine. The
	 * markup is what the scan compiled and what the row's bytes are made of — the one identity
	 * that survives the boundary.
	 */
	rowKind(markup: Markup | undefined): MarkupDescriptor | undefined {
		if (markup === undefined) return undefined
		return this.registry.rowKinds.find(descriptor => descriptor.markup === markup)
	}

	/** Every row's own body, at every depth — the scan decided the shape, this fills it. */
	#fillBodies(rows: readonly RowToken[], value: string): void {
		for (const row of rows) {
			row.children = this.parseBody(row, value)
			this.#fillBodies(row.rows, value)
		}
	}

	/**
	 * A row's own inline tokens, at absolute positions — {@link parseInline} over the row's body
	 * instead of the whole value, which is what bounds every match to one row.
	 *
	 * A RAW body (`__value__`) is one text token and is never re-parsed: that is the whole
	 * difference the two body placeholders express, and the only thing this arm adds.
	 *
	 * A CARVED body has no inline content of its own — the carve already took it apart, and each
	 * piece is parsed as a row in its own right.
	 */
	private parseBody(row: RowToken, value: string): Token[] {
		const {start, end, content} = row.slot
		if (row.rows.length > 0 && row.descriptor && this.registry.rowSplits.has(row.descriptor)) return []
		if (row.descriptor && !row.descriptor.hasSlot) return [createTextToken(value, start, end)]
		return this.parseInline(content, start)
	}
}

/** Body-relative positions become absolute ones. */
function shiftTokens(tokens: Token[], delta: number): void {
	for (const token of tokens) {
		token.position.start += delta
		token.position.end += delta
		if (token.type === 'text') continue
		if (token.slot) {
			token.slot.start += delta
			token.slot.end += delta
		}
		shiftTokens(token.children, delta)
	}
}