import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternEngine} from './PatternEngine'
import {PatternMatch} from '../utils/PatternBuilder'
import {MatchSegment} from '../utils/PatternChainManager'

/**
 * Markup matching strategy using Aho-Corasick algorithm
 * Uses segment pattern matching for efficient multi-pattern parsing without hardcoded logic
 */
export class MarkupMatcher {
	private readonly descriptors: MarkupDescriptor[]
	private readonly matcher: PatternEngine

	constructor(descriptors: MarkupDescriptor[]) {
		this.descriptors = descriptors
		this.matcher = new PatternEngine(descriptors)
	}

	/**
	 * Gets all matches in the input text
	 * Filters overlapping matches - greedy approach: longest match wins
	 */
	getAllMatches(input: string): MatchResult[] {
		const allPatternMatches = this.matcher.search(input)
		const sortedMatches = this.sortPatternMatches(allPatternMatches)
		return this.filterOverlappingMatches(sortedMatches, input)
	}

	/**
	 * Sorts pattern matches by start position, then by length (longest first)
	 */
	private sortPatternMatches(matches: PatternMatch[]): PatternMatch[] {
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
	 * Filters overlapping matches using greedy approach: longest match wins
	 */
	private filterOverlappingMatches(sortedMatches: PatternMatch[], input: string): MatchResult[] {
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
		const extracted = this.extractFromParts(patternMatch.parts, descriptor)

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
			return this.extractFromParts(fallbackMatch.parts, descriptor)
		}

		// Last resort: return empty label
		return { label: '' }
	}

	/**
	 * Extracts label and value from match parts based on gap types
	 */
	private extractFromParts(parts: MatchSegment[], descriptor: MarkupDescriptor): { label: string; value?: string } {
		const gaps = this.getGapParts(parts)

		if (descriptor.hasTwoLabels) {
			return this.extractTwoLabelPattern(gaps)
		} else if (descriptor.hasValue) {
			return this.extractValuePattern(gaps)
		} else {
			return this.extractSimplePattern(gaps)
		}
	}

	/**
	 * Gets all gap parts from match parts
	 */
	private getGapParts(parts: MatchSegment[]): MatchSegment[] {
		return parts.filter(p => p.type === 'gap')
	}

	/**
	 * Extracts for two-label patterns like <__label__>__value__</__label__>
	 */
	private extractTwoLabelPattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		const valueGap = gaps.find(g => g.gapType === 'value')

		return {
			label: labelGap?.value || '',
			value: valueGap?.value
		}
	}

	/**
	 * Extracts for value patterns like @[__label__](__value__)
	 */
	private extractValuePattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		const valueGap = gaps.find(g => g.gapType === 'value')

		return {
			label: labelGap?.value || '',
			value: valueGap?.value
		}
	}

	/**
	 * Extracts for simple patterns like #[__label__]
	 */
	private extractSimplePattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		return {
			label: labelGap?.value || ''
		}
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
