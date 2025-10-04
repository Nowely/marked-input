import {MatchResult} from './types'
import {SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
import {SegmentPatternMatcher, PatternMatch, MatchPart} from './SegmentPatternMatcher'

/**
 * Aho-Corasick based markup strategy
 * Uses segment pattern matching for efficient multi-pattern parsing without hardcoded logic
 */
export class AhoCorasickMarkupStrategy {
	private readonly descriptors: SegmentMarkupDescriptor[]
	private readonly matcher: SegmentPatternMatcher

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.descriptors = descriptors
		this.matcher = new SegmentPatternMatcher(descriptors)
	}

	/**
	 * Finds all matches in the input text (PatternMatcher functionality)
	 */
	findAllMatches(input: string): MatchResult[] {
		return this.getAllMatches(input)
	}

	/**
	 * Gets all matches in the input text (optimized for PatternMatcher)
	 * Filters overlapping matches - greedy approach: longest match wins
	 */
	getAllMatches(input: string): MatchResult[] {
		// One search call for all patterns!
		const allPatternMatches = this.matcher.search(input)
		
		// Sort by start position, then by length (longest first)
		allPatternMatches.sort((a, b) => {
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
		
		const results: MatchResult[] = []
		let lastEnd = 0

		for (const patternMatch of allPatternMatches) {
			const start = this.getMatchStart(patternMatch)
			const end = this.getMatchEnd(patternMatch)
			
			// Skip overlapping matches (greedy: longest match wins)
			if (start < lastEnd) {
				continue
			}
			
			// Materialize gap values
			this.matcher.materializeGaps(patternMatch, input)

			const content = input.substring(start, end)
			const descriptor = this.descriptors[patternMatch.descriptorIndex]

			// Extract label and value
			const extracted = this.extractFromParts(patternMatch.parts, descriptor)

			const result: MatchResult = {
				start,
				end,
				content,
				label: extracted.label,
				value: extracted.value,
				descriptor
			}

			results.push(result)
			lastEnd = end
		}

		return results
	}

	/**
	 * Extracts label and value from a match result
	 * Used as fallback for compatibility (when not using getAllMatches)
	 */
	extractContent(match: MatchResult): { label: string; value?: string } {
		const descriptor = match.descriptor as SegmentMarkupDescriptor
		
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
	private extractFromParts(parts: MatchPart[], descriptor: SegmentMarkupDescriptor): { label: string; value?: string } {
		let label = ''
		let value: string | undefined

		// Extract gaps according to their types
		const gaps = parts.filter(p => p.type === 'gap')
		
		if (descriptor.hasTwoLabels) {
			// Pattern like <__label__>__value__</__label__>
			// First gap is label, second is value, third is label again (should match first)
			const labelGap = gaps.find(g => g.gapType === 'label')
			const valueGap = gaps.find(g => g.gapType === 'value')
			
			label = labelGap?.value || ''
			value = valueGap?.value
		} else if (descriptor.hasValue) {
			// Pattern like @[__label__](__value__)
			// First gap is label, second is value
			const labelGap = gaps.find(g => g.gapType === 'label')
			const valueGap = gaps.find(g => g.gapType === 'value')
			
			label = labelGap?.value || ''
			value = valueGap?.value
		} else {
			// Pattern like #[__label__]
			// Single gap is label
			const labelGap = gaps.find(g => g.gapType === 'label')
			label = labelGap?.value || ''
		}

		return { label, value }
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

