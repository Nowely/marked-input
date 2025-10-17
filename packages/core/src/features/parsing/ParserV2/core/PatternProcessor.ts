import {PatternMatch} from '../utils/PatternBuilder'
import {SegmentMatch} from '../utils/AhoCorasick'
import {PatternSorting} from '../utils/PatternSorting'
import {ChainMatcher} from './ChainMatcher'
import {MatchValidator} from './MatchValidator'
import {MarkupRegistry} from '../utils/MarkupRegistry'

/**
 * Pattern processor coordinator - simplified to orchestrate specialized components
 * Delegates to:
 * - ChainMatcher: builds pattern chains from segment matches
 * - MatchValidator: validates and filters matches
 * - PatternSorting: handles all sorting logic (static methods)
 *
 * The simplest possible coordinator - just 3 lines of pipeline logic
 */
export class PatternProcessor {
	private readonly chainMatcher: ChainMatcher
	private readonly validator: MatchValidator

	constructor(registry: MarkupRegistry) {
		this.chainMatcher = new ChainMatcher(registry)
		this.validator = new MatchValidator(registry.descriptors)
	}

	/**
	 * Processes all segment matches and returns validated, sorted pattern matches
	 * 
	 * Pipeline:
	 * 1. Build ALL possible pattern chains (even invalid ones)
	 * 2. Validate and filter matches
	 * 3. Sort matches for tree building
	 */
	processMatches(segmentMatches: SegmentMatch[], input: string): PatternMatch[] {
		// 1. Build all possible pattern chains
		const allMatches = this.chainMatcher.buildChains(segmentMatches)

		// 2. Validate and filter matches
		const validated = this.validator.validateAndFilter(allMatches, input)

		// 3. Final sort for tree building
		return PatternSorting.sortPatternMatches(validated)
	}
}
