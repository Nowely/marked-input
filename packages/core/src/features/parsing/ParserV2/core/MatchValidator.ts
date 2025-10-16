import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {PatternPart} from '../utils/PatternChainManager'

/**
 * Match validator responsible for all filtering and validation logic
 * Consolidates validation from PatternProcessor and MatchPostProcessor
 */
export class MatchValidator {
	constructor(private readonly descriptors: MarkupDescriptor[]) {}

	/**
	 * Complete validation and filtering pipeline
	 * All filtering stages in one place for clarity
	 */
	validateAndFilter(matches: PatternMatch[], input: string): PatternMatch[] {
		// Stage 1: Filter matches starting inside non-nested gaps (__meta__ and __value__)
		let filtered = this.filterMatchesInsideNonNestedGaps(matches)
		
		// Stage 2: Filter overlapping matches of the same descriptor
		filtered = this.filterOverlappingMatches(filtered)
		
		// Stage 3: Materialize gaps for validation checks that need content
		this.materializeAllGaps(filtered, input)
		
		// Stage 4: Filter partial matches (shorter matches with same boundaries)
		filtered = this.filterPartialMatches(filtered)
		
		// Stage 5: Validate patterns with two __value__ placeholders (HTML-like tags)
		filtered = this.validateTwoValues(filtered)
		
		return filtered
	}

	/**
	 * Filters out matches that start inside __meta__ or __value__ gaps of other matches.
	 * Only __nested__ gaps allow nested patterns.
	 * 
	 * Extracted from PatternProcessor.filterMatchesInsideNonNestedGaps (lines 57-81)
	 */
	private filterMatchesInsideNonNestedGaps(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const matchStart = match.parts[0].start
			
			// Check if this match starts inside a non-nested gap (__meta__ or __value__) of any other match
			for (const other of matches) {
				if (other === match) continue
				
				// Check all gaps in the other match
				for (const part of other.parts) {
					if (part.type === 'gap' && part.start !== undefined && part.end !== undefined) {
						// Only filter if the gap is NOT a nested gap
						if (part.gapType === 'meta' || part.gapType === 'value') {
							if (matchStart >= part.start && matchStart <= part.end) {
								return false // This match starts inside a non-nested gap
							}
						}
						// If gapType is 'nested', allow the match (nesting is permitted)
					}
				}
			}
			
			return true
		})
	}

	/**
	 * Filters out incomplete/overlapping matches of the same descriptor.
	 * This handles cases like <__value__>__meta__</__value__> where multiple chains
	 * might be created for the same descriptor at overlapping positions.
	 * 
	 * Strategy: Keep the most complete match when there are CONFLICTING matches
	 * of the same descriptor that start at the same position.
	 * 
	 * IMPORTANT: This does NOT filter nested matches (matches inside __nested__ sections).
	 * Only filters matches that share the same starting position and are of the same descriptor.
	 * 
	 * Extracted from PatternProcessor.filterOverlappingMatches (lines 93-133)
	 */
	private filterOverlappingMatches(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const matchStart = match.parts[0].start
			const matchEnd = match.parts[match.parts.length - 1].end
			const matchSegmentCount = match.parts.filter(p => p.type === 'segment').length
			
			// Check if there's a more complete match of the same descriptor starting at the SAME position
			for (const other of matches) {
				if (other === match) continue
				if (match.descriptorIndex !== other.descriptorIndex) continue // Only compare same descriptors
				
				const otherStart = other.parts[0].start
				const otherEnd = other.parts[other.parts.length - 1].end
				const otherSegmentCount = other.parts.filter(p => p.type === 'segment').length
				
				// ONLY consider matches that start at the SAME position (not nested, but conflicting)
				if (matchStart !== otherStart) continue
				
				// If other match has more segments (is more complete), remove this one
				if (otherSegmentCount > matchSegmentCount) {
					return false
				}
				
				// If they have same segment count but other is longer (more complete), remove this one
				if (otherSegmentCount === matchSegmentCount && (otherEnd - otherStart) > (matchEnd - matchStart)) {
					return false
				}
				
				// If they have same segment count and same length but different end positions,
				// keep the one that ends later (more inclusive)
				if (otherSegmentCount === matchSegmentCount && 
					(otherEnd - otherStart) === (matchEnd - matchStart) && 
					otherEnd > matchEnd) {
					return false
				}
			}
			
			return true
		})
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
	 * Filters out partial matches - matches that are subsets of longer matches
	 * A match is partial if another match exists with:
	 * - Same start position but longer (extends further)
	 * - Same end position but longer (starts earlier)
	 * 
	 * Extracted from MatchPostProcessor.removeOverlaps (lines 66-84)
	 */
	private filterPartialMatches(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const start = this.getMatchStart(match)
			const end = this.getMatchEnd(match)

			// Check if this match is a partial match of a longer pattern
			for (const other of matches) {
				if (other === match) continue

				const otherStart = this.getMatchStart(other)
				const otherEnd = this.getMatchEnd(other)

				// Same start position and this match is shorter = partial match
				if (otherStart === start && end < otherEnd) {
					return false
				}

				// Same end position and this match is shorter = partial match
				if (otherEnd === end && start > otherStart) {
					return false
				}
			}

			return true
		})
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

	/**
	 * Gets the start position of a pattern match
	 */
	private getMatchStart(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[0].start : 0
	}

	/**
	 * Gets the end position of a pattern match (exclusive)
	 */
	private getMatchEnd(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
	}
}

