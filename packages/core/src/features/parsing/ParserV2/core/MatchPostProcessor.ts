import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {PatternPart} from '../utils/PatternChainManager'

/**
 * Post-processor for pattern matches - simplified to only handle conversion
 * Filtering and sorting logic moved to MatchValidator and PriorityResolver
 */
export class MatchPostProcessor {
	/**
	 * Converts validated, sorted PatternMatch[] to MatchResult[]
	 * No filtering - matches are already validated by MatchValidator
	 * No sorting - matches are already sorted by PriorityResolver
	 */
	static convertToResults(matches: PatternMatch[], input: string, descriptors: MarkupDescriptor[]): MatchResult[] {
		const results: MatchResult[] = []

		for (const patternMatch of matches) {
			// Gaps are already materialized by MatchValidator
			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)
			const descriptor = descriptors[patternMatch.descriptorIndex]
			const extracted = this.extractContent(patternMatch.parts, descriptor)

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
				descriptorIndex: patternMatch.descriptorIndex,
			})
		}

		return results
	}

	/**
	 * Extracts value, nested content, and meta from match parts
	 */
	static extractContent(
		parts: PatternPart[],
		descriptor: MarkupDescriptor
	): {
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
	 * Gets the end position of a pattern match (exclusive)
	 */
	private static getMatchEnd(match: PatternMatch): number {
		return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
	}
}
