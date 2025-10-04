import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternEngine} from './PatternEngine'
import {PatternMatch} from '../utils/PatternBuilder'
import {MatchSegment} from '../utils/PatternChainManager'
import {ContentExtractor} from '../utils/ContentExtractor'

/**
 * Markup matching strategy using Aho-Corasick algorithm
 * Uses segment pattern matching for efficient multi-pattern parsing without hardcoded logic
 */
export class MarkupMatcher {
	private readonly descriptors: MarkupDescriptor[]
	private readonly matcher: PatternEngine
	private readonly contentExtractor: ContentExtractor

	constructor(descriptors: MarkupDescriptor[]) {
		this.descriptors = descriptors
		this.matcher = new PatternEngine(descriptors)
		this.contentExtractor = new ContentExtractor()
	}

	/**
	 * Gets all matches in the input text
	 * Filters overlapping matches - greedy approach: longest match wins
	 */
	getAllMatches(input: string): MatchResult[] {
		const patternMatches = this.findPatternMatches(input)
		const sortedMatches = this.sortByPositionAndLength(patternMatches)
		return this.removeOverlaps(sortedMatches, input)
	}

	/**
	 * Finds all pattern matches in the input text
	 */
	private findPatternMatches(input: string): PatternMatch[] {
		return this.matcher.search(input)
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

			results.push(this.createMatchResult(patternMatch, input))
			lastEnd = end
		}

		return results
	}

	/**
	 * Creates a MatchResult from a PatternMatch
	 */
	private createMatchResult(patternMatch: PatternMatch, input: string): MatchResult {
		// Materialize gap values
		this.matcher.materializeGaps(patternMatch, input)

		const start = this.getMatchStart(patternMatch)
		const end = this.getMatchEnd(patternMatch)
		const content = input.substring(start, end)
		const descriptor = this.descriptors[patternMatch.descriptorIndex]

		// Extract label and value
		const extracted = this.contentExtractor.extractFromParts(patternMatch.parts, descriptor)

		return {
			start,
			end,
			content,
			label: extracted.label,
			value: extracted.value,
			descriptor
		}
	}

	/**
	 * Extracts label and value from a match result
	 * Used as fallback for compatibility
	 */
	extractContent(match: MatchResult): { label: string; value?: string } {
		const descriptor = match.descriptor as MarkupDescriptor

		// Search for the match in the content
		const inputMatches = this.matcher.search(match.content)
		const fallbackMatch = inputMatches.find(m => m.descriptorIndex === descriptor.index)

		if (fallbackMatch) {
			this.matcher.materializeGaps(fallbackMatch, match.content)
			return this.contentExtractor.extractFromParts(fallbackMatch.parts, descriptor)
		}

		// Last resort: return empty label
		return { label: '' }
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
}
