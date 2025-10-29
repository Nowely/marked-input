import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {PatternPart} from '../utils/PatternChainManager'
import {SweepLineFilter} from './SweepLineFilter'

/**
 * Match validator responsible for all filtering and validation logic
 * Consolidates validation from PatternProcessor and MatchPostProcessor
 *
 * Uses sweep line algorithm for O(N log N) complexity instead of O(N²)
 */
export class MatchValidator {
	constructor(private readonly descriptors: MarkupDescriptor[]) {}

	/**
	 * Complete validation and filtering pipeline
	 * All filtering stages in one place for clarity
	 *
	 * Optimized with sweep line algorithm for better performance on large inputs
	 */
	validateAndFilter(matches: PatternMatch[], input: string): PatternMatch[] {
		// Create sweep line filter for optimized filtering
		const sweepFilter = new SweepLineFilter(this.descriptors)

		// Stage 1: Filter matches starting inside non-nested gaps (__meta__ and __value__)
		// Optimized: O(N²×M) → O(N×M log N)
		let filtered = sweepFilter.filterByContainment(matches)

		// Stage 2: Filter overlapping matches of the same descriptor
		// Optimized: O(N²) → O(N)
		filtered = sweepFilter.filterByDescriptor(filtered)

		// Stage 3: Materialize gaps for validation checks that need content
		this.materializeAllGaps(filtered, input)

		// Stage 4: Filter partial matches (shorter matches with same boundaries)
		// Optimized: O(N²) → O(N log N)
		filtered = sweepFilter.filterByBoundaries(filtered)

		// Stage 5: Validate patterns with two __value__ placeholders (HTML-like tags)
		filtered = this.validateTwoValues(filtered)

		return filtered
	}

	/**
	 * Materializes gap values from text for all matches
	 * Required before validation checks that need actual gap content
	 *
	 * Extracted from MatchPostProcessor.materializeGaps (lines 139-150)
	 */
	private materializeAllGaps(matches: PatternMatch[], text: string): void {
		for (const match of matches) {
			for (const part of match.parts) {
				if (part.type === 'gap' && part.value === undefined) {
					// Handle empty gaps (adjacent segments)
					if (part.start > part.end) {
						part.value = ''
					} else {
						part.value = text.slice(part.start, part.end + 1)
					}
				}
			}
		}
	}

	/**
	 * Validates patterns with two __value__ placeholders (HTML-like tags)
	 * For patterns like <__value__>__nested__</__value__>, both values must be identical
	 * Otherwise the pattern doesn't match (e.g., <div>...</span> is invalid)
	 *
	 * Extracted from MatchPostProcessor.removeOverlaps (lines 109-114)
	 */
	private validateTwoValues(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const descriptor = this.descriptors[match.descriptorIndex]

			// Only validate if descriptor has two __value__ placeholders
			if (!descriptor.hasTwoValues) {
				return true // No validation needed
			}

			// Extract all values from gaps
			const values: string[] = []
			for (const part of match.parts) {
				if (part.type === 'gap' && part.gapType === 'value') {
					values.push(part.value || '')
				}
			}

			// For two-value patterns, both values must be equal
			if (values.length === 2 && values[0] !== values[1]) {
				return false // Opening and closing values don't match
			}

			return true
		})
	}
}
