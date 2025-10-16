import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {UniqueMatch} from '../types'
import {PatternSorting} from '../utils/PatternSorting'
import {ChainMatcher} from './ChainMatcher'
import {MatchValidator} from './MatchValidator'

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

	constructor(descriptors: MarkupDescriptor[]) {
		this.chainMatcher = new ChainMatcher(descriptors)
		this.validator = new MatchValidator(descriptors)
	}

	/**
	 * Processes all unique segment matches and returns validated, sorted pattern matches
	 * 
	 * Pipeline:
	 * 1. Build ALL possible pattern chains (even invalid ones)
	 * 2. Validate and filter matches
	 * 3. Sort matches for tree building
	 */
	processMatches(uniqueMatches: UniqueMatch[], input: string): PatternMatch[] {
		// 1. Build all possible pattern chains
		const allMatches = this.chainMatcher.buildChains(uniqueMatches)

		// 2. Validate and filter matches
		const validated = this.validator.validateAndFilter(allMatches, input)

		// 3. Final sort for tree building
		return PatternSorting.sortPatternMatches(validated)
	}
}
