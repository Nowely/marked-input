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
	 * Sorts pattern matches by start position, then by length (longest first)
	 */
	private sortByPositionAndLength(matches: PatternMatch[]): PatternMatch[] {
		return matches.sort((a, b) => {
			const startA = this.getMatchStart(a)
			const startB = this.getMatchStart(b)
			if (startA !== startB) {
				return startA - startB
			}
			// Same start: prefer longer match
			const lengthA = this.getMatchEnd(a) - startA
			const lengthB = this.getMatchEnd(b) - startB
			return lengthB - lengthA
		})
	}

	/**
	 * Removes overlapping matches using greedy approach: longest match wins
	 */
	private removeOverlaps(sortedMatches: PatternMatch[], input: string): MatchResult[] {
		const results: MatchResult[] = []
		let lastEnd = 0

		for (const patternMatch of sortedMatches) {
			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)

			// Skip overlapping matches (greedy: longest match wins)
			if (start < lastEnd) {
				continue
			}

			// Materialize gaps for all valid matches (original behavior)
			PatternMatcher.materializeGaps(patternMatch, input)

			const descriptor = this.descriptors[patternMatch.descriptorIndex]
			const {label, value} = PatternMatcher.extractContent(patternMatch.parts, descriptor)

			results.push({
				start,
				end,
				content: input.substring(start, end),
				label,
				value,
				descriptor
			})

			lastEnd = end
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
	 * Extracts label and value from match parts based on gap types
	 * Single pass through gaps for optimal performance
	 */
	private static extractContent(parts: MatchSegment[], descriptor: MarkupDescriptor): {label: string; value?: string} {
		let label = ''
		let value: string | undefined

		for (const part of parts) {
			if (part.type === 'gap') {
				if (part.gapType === 'label' && !label) {
					label = part.value || ''
				} else if (part.gapType === 'value') {
					value = part.value
				}
			}
		}

		return {label, value}
	}
}

