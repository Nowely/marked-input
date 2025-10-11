import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {SegmentMatcher} from './SegmentMatcher'
import {PatternProcessor} from './PatternProcessor'
import {PatternMatch} from '../utils/PatternBuilder'
import {MatchSegment} from '../utils/PatternChainManager'

/**
 * Pattern matching engine using Aho-Corasick algorithm
 * 
 * Finds ALL matches in text (including overlapping ones) for nested parsing.
 * Uses segment-based matching with position tracking for efficient tree building.
 * 
 * @example
 * ```typescript
 * const descriptors = markups.map(createMarkupDescriptor)
 * const matcher = new PatternMatcher(descriptors)
 * const matches = matcher.getAllMatches("@[hello #[world]]")
 * // Returns both outer and inner matches with precise positions
 * ```
 */
export class PatternMatcher {
	private readonly descriptors: MarkupDescriptor[]
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternProcessor: PatternProcessor

	constructor(descriptors: MarkupDescriptor[]) {
		this.descriptors = descriptors
		this.segmentMatcher = new SegmentMatcher(descriptors)
		this.patternProcessor = new PatternProcessor(descriptors)
	}

	/**
	 * Finds all pattern matches in the input text
	 * 
	 * Unlike traditional parsers, this includes overlapping matches
	 * (e.g., both outer and nested marks) to enable tree building.
	 * 
	 * @complexity O(N + M + Z) where N = text length, M = patterns, Z = matches
	 * @param input - Text to search for patterns
	 * @returns Array of matches with position tracking (sorted by position)
	 */
	getAllMatches(input: string): MatchResult[] {
		// 1. Find all unique segment matches
		const uniqueMatches = this.segmentMatcher.findDeduplicatedMatches(input)

		// 2. Build complete pattern matches
		const patternMatches = this.patternProcessor.processMatches(uniqueMatches)

		// 3. Sort by position and length (longest first)
		const sortedMatches = this.sortByPositionAndLength(patternMatches)

		// 4. Remove overlaps and create results
		return this.removeOverlaps(sortedMatches, input)
	}

	/**
	 * Sorts pattern matches by start position, then by length
	 * Simplified: context-aware matching is now handled in PatternProcessor
	 */
	private sortByPositionAndLength(matches: PatternMatch[]): PatternMatch[] {
		return matches.sort((a, b) => {
			const startA = this.getMatchStart(a)
			const startB = this.getMatchStart(b)
			if (startA !== startB) {
				return startA - startB
			}
			// Same start: prefer longer match (greedy by default)
			const lengthA = this.getMatchEnd(a) - startA
			const lengthB = this.getMatchEnd(b) - startB
			return lengthB - lengthA
		})
	}

	/**
	 * Converts pattern matches to match results
	 * 
	 * Includes overlapping matches for nested parsing, but filters out:
	 * - Invalid partial matches (e.g., "**" from "*__label__*" when "**__label__**" exists)
	 * - Matches inside __value__ sections of other matches (values are not parsed)
	 */
	private removeOverlaps(sortedMatches: PatternMatch[], input: string): MatchResult[] {
		const results: MatchResult[] = []
		const matchesWithPositions: Array<{
			match: PatternMatch
			start: number
			end: number
			valueStart?: number
			valueEnd?: number
		}> = []

		// First pass: collect all matches with positions and extract content
		for (const patternMatch of sortedMatches) {
			PatternMatcher.materializeGaps(patternMatch, input)
			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)
			const descriptor = this.descriptors[patternMatch.descriptorIndex]
			const extracted = PatternMatcher.extractContent(patternMatch.parts, descriptor)
			
			matchesWithPositions.push({
				match: patternMatch,
				start,
				end,
				valueStart: extracted.valueStart,
				valueEnd: extracted.valueEnd
			})
		}

		// Second pass: filter out partial/invalid matches and matches inside __value__
		for (const item of matchesWithPositions) {
			const {match: patternMatch, start, end, valueStart, valueEnd} = item
			
			// Check if this match is a partial match of a longer pattern at same position
			const isPartialMatch = matchesWithPositions.some(other => {
				if (other === item) return false
				
				// Same start position and this match is shorter = partial match
				if (other.start === start && end < other.end) {
					return true
				}
				
				// Same end position and this match is shorter = partial match
				if (other.end === end && start > other.start) {
					return true
				}
				
				return false
			})
			
			if (isPartialMatch) {
				continue // Skip partial matches
			}

			// Check if this match is inside or overlaps with __value__ of another match
			// __value__ sections should not be parsed for nested patterns
			const isInsideOrOverlapsValue = matchesWithPositions.some(other => {
				if (other === item) return false
				
				// Check if this match starts inside other's __value__ range
				// Even if it extends beyond, we should skip it because it's invalid
				if (other.valueStart !== undefined && other.valueEnd !== undefined) {
					// Match overlaps with value if it starts inside the value range
					if (start >= other.valueStart && start < other.valueEnd) {
						return true
					}
				}
				
				return false
			})
			
			if (isInsideOrOverlapsValue) {
				continue // Skip matches inside or overlapping __value__
			}

			const descriptor = this.descriptors[patternMatch.descriptorIndex]
			const extracted = PatternMatcher.extractContent(patternMatch.parts, descriptor)

			// For patterns with two __label__ placeholders (like <__label__>text</__label__>),
			// verify that both labels are equal. If not, skip this match.
			if (descriptor.hasTwoLabels) {
				const labels = extracted.allLabels || []
				if (labels.length === 2 && labels[0] !== labels[1]) {
					continue // Skip match - opening and closing labels don't match
				}
			}

			results.push({
				start,
				end,
				content: input.substring(start, end),
				label: extracted.label,
				labelStart: extracted.labelStart,
				labelEnd: extracted.labelEnd,
				nested: extracted.nested,
				nestedStart: extracted.nestedStart,
				nestedEnd: extracted.nestedEnd,
				value: extracted.value,
				valueStart: extracted.valueStart,
				valueEnd: extracted.valueEnd,
				descriptorIndex: patternMatch.descriptorIndex
			})
		}

		return results
	}

	/**
	 * Gets the start position of a pattern match
	 */
	private getMatchStart(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[0].start : 0
	}

	/**
	 * Gets the end position of a pattern match (inclusive)
	 */
	private getMatchEnd(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
	}

	/**
	 * Materializes gap values from text (lazy evaluation)
	 * Converts undefined gap values to actual string content
	 * Handles empty gaps (when start > end)
	 */
	private static materializeGaps(match: PatternMatch, text: string): void {
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

	/**
	 * Extracts label, nested content, and value from match parts with position tracking
	 * Single pass through gaps for optimal performance
	 * 
	 * Returns exclusive end positions (compatible with substring)
	 * Handles empty gaps (when start > end) by creating empty positions
	 * 
	 * Note: label is optional - if pattern uses only __nested__, label will be empty string
	 * with positions set to the start of the match
	 */
	private static extractContent(parts: MatchSegment[], descriptor: MarkupDescriptor): {
		label: string
		labelStart: number
		labelEnd: number
		nested?: string
		nestedStart?: number
		nestedEnd?: number
		value?: string
		valueStart?: number
		valueEnd?: number
		allLabels?: string[]
	} {
		let label = ''
		let labelStart = -1
		let labelEnd = -1
		let nested: string | undefined
		let nestedStart: number | undefined
		let nestedEnd: number | undefined
		let value: string | undefined
		let valueStart: number | undefined
		let valueEnd: number | undefined
		const allLabels: string[] = []
		
		// Track first gap position for default label positions
		let firstGapStart = -1

		for (const part of parts) {
			if (part.type === 'gap') {
				// Track first gap position if not set
				if (firstGapStart === -1) {
					firstGapStart = part.start
				}
				
				if (part.gapType === 'label') {
					// Collect all labels for validation (in case of two __label__ pattern)
					allLabels.push(part.value || '')
					
					// Use first label as the primary label
					if (labelStart === -1) {
						label = part.value || ''
						labelStart = part.start
						// Handle empty gaps (adjacent segments)
						if (part.start > part.end) {
							labelEnd = part.start // Empty range: [start, start)
						} else {
							// part.end is inclusive (last char of gap), so add 1 for exclusive
							labelEnd = part.end + 1
						}
					}
				} else if (part.gapType === 'nested' && nested === undefined) {
					nested = part.value || ''
					nestedStart = part.start
					// Handle empty gaps (adjacent segments)
					if (part.start > part.end) {
						nestedEnd = part.start // Empty range: [start, start)
					} else {
						// part.end is inclusive (last char of gap), so add 1 for exclusive
						nestedEnd = part.end + 1
					}
				} else if (part.gapType === 'value') {
					value = part.value
					valueStart = part.start
					// Handle empty gaps (adjacent segments)
					if (part.start > part.end) {
						valueEnd = part.start // Empty range: [start, start)
					} else {
						// part.end is inclusive (last char of gap), so add 1 for exclusive
						valueEnd = part.end + 1
					}
				}
			}
		}
		
		// If no label was found (pattern uses only __nested__), 
		// set label positions to empty range at the start
		if (labelStart === -1) {
			labelStart = firstGapStart !== -1 ? firstGapStart : 0
			labelEnd = labelStart
		}

		return {label, labelStart, labelEnd, nested, nestedStart, nestedEnd, value, valueStart, valueEnd, allLabels}
	}
}

