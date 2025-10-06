import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken} from './types'
import {PatternMatcher} from './core/PatternMatcher'
import {createMarkupDescriptor} from './core/MarkupDescriptor'
import {buildTreeSinglePass} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'

/**
 * Tree-based parser for processing nested markup constructions in text
 * 
 * Uses single-pass tree building algorithm with O(N log N) complexity
 * to avoid exponential recursive re-parsing.
 * 
 * @example
 * ```typescript
 * const parser = new ParserV2(['@[__label__](__value__)', '#[__label__]'])
 * const tokens = parser.split('Hello @[world](test) and #[tag]')
 * ```
 */
export class ParserV2 {
	private readonly matcher: PatternMatcher

	constructor(markups: Markup[]) {
		const descriptors = markups.map(createMarkupDescriptor)
		this.matcher = new PatternMatcher(descriptors)
	}

	/**
	 * Parses text with provided options (static convenience method)
	 * 
	 * @param value - Text to parse
	 * @param options - Markup options with patterns
	 * @returns Array of nested tokens
	 */
	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		return markups
			? new ParserV2(markups).split(value)
			: [createTextToken(value)]
	}

	/**
	 * Parses text and returns nested token tree
	 * 
	 * Algorithm:
	 * 1. PatternMatcher finds all matches (including overlapping)
	 * 2. TreeBuilder builds tree based on position containment
	 * 3. Single pass - no recursive parsing
	 * 
	 * @complexity O(N log N) for sorting + O(N) for building
	 * @param value - Text to parse
	 * @returns Nested token tree with proper parent-child relationships
	 */
	split(value: string): NestedToken[] {
		const matches = this.matcher.getAllMatches(value)
		return buildTreeSinglePass(value, matches)
	}
}
