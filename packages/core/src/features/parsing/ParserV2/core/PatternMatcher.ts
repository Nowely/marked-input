import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {SegmentMatcher} from './SegmentMatcher'
import {PatternProcessor} from './PatternProcessor'
import {PatternMatch} from '../utils/PatternBuilder'
import {MatchSegment} from '../utils/PatternChainManager'

/**
 * Pattern matching strategy using Aho-Corasick algorithm
 * Uses segment pattern matching for efficient multi-pattern parsing
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
	 * Gets all matches in the input text
	 * Filters overlapping matches - greedy approach: longest match wins
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
	 * For nested parser, we include ALL matches (even overlapping ones)
	 * The tree builder will determine parent-child relationships
	 */
	private removeOverlaps(sortedMatches: PatternMatch[], input: string): MatchResult[] {
		const results: MatchResult[] = []

		for (const patternMatch of sortedMatches) {
			// Materialize gaps for all matches
			PatternMatcher.materializeGaps(patternMatch, input)

			const descriptor = this.descriptors[patternMatch.descriptorIndex]
			const extracted = PatternMatcher.extractContent(patternMatch.parts, descriptor)

			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)

			results.push({
				start,
				end,
				content: input.substring(start, end),
				label: extracted.label,
				labelStart: extracted.labelStart,
				labelEnd: extracted.labelEnd,
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
	 */
	private static materializeGaps(match: PatternMatch, text: string): void {
		for (const part of match.parts) {
			if (part.type === 'gap' && part.value === undefined) {
				part.value = text.slice(part.start, part.end + 1)
			}
		}
	}

	/**
	 * Extracts label and value from match parts with position tracking
	 * Single pass through gaps for optimal performance
	 */
	private static extractContent(parts: MatchSegment[], descriptor: MarkupDescriptor): {
		label: string
		labelStart: number
		labelEnd: number
		value?: string
		valueStart?: number
		valueEnd?: number
	} {
		let label = ''
		let labelStart = -1
		let labelEnd = -1
		let value: string | undefined
		let valueStart: number | undefined
		let valueEnd: number | undefined

		for (const part of parts) {
			if (part.type === 'gap') {
				if (part.gapType === 'label' && !label) {
					label = part.value || ''
					labelStart = part.start
					labelEnd = part.end
				} else if (part.gapType === 'value') {
					value = part.value
					valueStart = part.start
					valueEnd = part.end
				}
			}
		}

		return {label, labelStart, labelEnd, value, valueStart, valueEnd}
	}
}

