import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {SegmentMatcher} from './SegmentMatcher'
import {PatternProcessor} from './PatternProcessor'
import {PatternMatch} from '../utils/PatternBuilder'
import {PatternPart} from '../utils/PatternChainManager'
import {AhoCorasick} from '../utils/AhoCorasick'

/**
 * Post-processor for pattern matches
 * Handles sorting, overlap removal, and content extraction
 */
export class MatchPostProcessor {
	/**
	 * Sorts pattern matches by start position, then by length (longest first)
	 */
	static sortByPositionAndLength(matches: PatternMatch[]): PatternMatch[] {
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
	 * Converts pattern matches to match results with overlap filtering
	 */
	static removeOverlaps(sortedMatches: PatternMatch[], input: string, descriptors: MarkupDescriptor[]): MatchResult[] {
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
			this.materializeGaps(patternMatch, input)
			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)
			const descriptor = descriptors[patternMatch.descriptorIndex]
			const extracted = this.extractContent(patternMatch.parts, descriptor)

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
			const isInsideOrOverlapsValue = matchesWithPositions.some(other => {
				if (other === item) return false

				// Check if this match starts inside other's __value__ range
				if (other.valueStart !== undefined && other.valueEnd !== undefined) {
					// Match overlaps with value if it starts inside the value range
					if (start >= other.valueStart && start < other.valueEnd) {
						return true
					}
				}

				return false
			})

			if (isInsideOrOverlapsValue) {
				continue // Skip matches inside or overlapping __meta__
			}

			const descriptor = descriptors[patternMatch.descriptorIndex]
			const extracted = this.extractContent(patternMatch.parts, descriptor)

			// For patterns with two __value__ placeholders, verify that both values are equal
			if (descriptor.hasTwoValues) {
				const values = extracted.allValues || []
				if (values.length === 2 && values[0] !== values[1]) {
					continue // Skip match - opening and closing values don't match
				}
			}

			results.push({
				start,
				end,
				content: input.substring(start, end),
				value: extracted.value,
				valueStart: extracted.valueStart,
				valueEnd: extracted.valueEnd,
				nested: extracted.nested,
				nestedStart: extracted.nestedStart,
				nestedEnd: extracted.nestedEnd,
				meta: extracted.meta,
				metaStart: extracted.metaStart,
				metaEnd: extracted.metaEnd,
				descriptorIndex: patternMatch.descriptorIndex
			})
		}

		return results
	}

	/**
	 * Materializes gap values from text (lazy evaluation)
	 */
	static materializeGaps(match: PatternMatch, text: string): void {
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
	 * Extracts value, nested content, and meta from match parts
	 */
	static extractContent(parts: PatternPart[], descriptor: MarkupDescriptor): {
		value: string
		valueStart: number
		valueEnd: number
		nested?: string
		nestedStart?: number
		nestedEnd?: number
		meta?: string
		metaStart?: number
		metaEnd?: number
		allValues?: string[]
	} {
		let value = ''
		let valueStart = -1
		let valueEnd = -1
		let nested: string | undefined
		let nestedStart: number | undefined
		let nestedEnd: number | undefined
		let meta: string | undefined
		let metaStart: number | undefined
		let metaEnd: number | undefined
		const allValues: string[] = []

		// Track first gap position for default value positions
		let firstGapStart = -1

		for (const part of parts) {
			if (part.type === 'gap') {
				// Track first gap position if not set
				if (firstGapStart === -1) {
					firstGapStart = part.start
				}

				if (part.gapType === 'value') {
					// Collect all values for validation
					allValues.push(part.value || '')

					// Use first value as the primary value
					if (valueStart === -1) {
						value = part.value || ''
						valueStart = part.start
						// Handle empty gaps (adjacent segments)
						if (part.start > part.end) {
							valueEnd = part.start // Empty range: [start, start)
						} else {
							valueEnd = part.end + 1
						}
					}
				} else if (part.gapType === 'nested' && nested === undefined) {
					nested = part.value || ''
					nestedStart = part.start
					// Handle empty gaps (adjacent segments)
					if (part.start > part.end) {
						nestedEnd = part.start // Empty range: [start, start)
					} else {
						nestedEnd = part.end + 1
					}
				} else if (part.gapType === 'meta') {
					meta = part.value
					metaStart = part.start
					// Handle empty gaps (adjacent segments)
					if (part.start > part.end) {
						metaEnd = part.start // Empty range: [start, start)
					} else {
						metaEnd = part.end + 1
					}
				}
			}
		}

		// If no value was found, set value positions to empty range at the start
		if (valueStart === -1) {
			valueStart = firstGapStart !== -1 ? firstGapStart : 0
			valueEnd = valueStart
		}

		return {value, valueStart, valueEnd, nested, nestedStart, nestedEnd, meta, metaStart, metaEnd, allValues}
	}

	/**
	 * Gets the start position of a pattern match
	 */
	private static getMatchStart(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[0].start : 0
	}

	/**
	 * Gets the end position of a pattern match (inclusive)
	 */
	private static getMatchEnd(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
	}
}
