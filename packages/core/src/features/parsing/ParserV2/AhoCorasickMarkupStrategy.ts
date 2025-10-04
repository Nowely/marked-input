import {MarkupStrategy, MatchResult} from './types'
import {SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
import {SegmentPatternMatcher, PatternMatch, MatchPart} from './SegmentPatternMatcher'

/**
 * Extended match result that includes pattern match data
 */
interface ExtendedMatchResult extends MatchResult {
	_patternMatch?: PatternMatch
	_originalInput?: string
}

/**
 * Aho-Corasick based markup strategy
 * Uses segment pattern matching for efficient multi-pattern parsing without hardcoded logic
 */
export class AhoCorasickMarkupStrategy implements MarkupStrategy {
	private readonly descriptors: SegmentMarkupDescriptor[]
	private readonly matcher: SegmentPatternMatcher
	private matchCache: Map<string, PatternMatch[]>

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.descriptors = descriptors
		this.matcher = new SegmentPatternMatcher(descriptors)
		this.matchCache = new Map()
	}

	/**
	 * Finds a match for the given descriptor at the specified position
	 */
	matches(descriptor: SegmentMarkupDescriptor, input: string, position: number): MatchResult | null {
		// Get all matches for this input (cached)
		let allMatches = this.matchCache.get(input)
		if (!allMatches) {
			allMatches = this.matcher.search(input)
			this.matchCache.set(input, allMatches)
		}

		// Find first match that:
		// 1. Belongs to this descriptor
		// 2. Starts at the specified position
		for (const match of allMatches) {
			if (match.descriptorIndex === descriptor.index && this.getMatchStart(match) === position) {
				// Materialize gap values
				this.matcher.materializeGaps(match, input)

				const start = this.getMatchStart(match)
				const end = this.getMatchEnd(match)
				const content = input.substring(start, end)

				const result: ExtendedMatchResult = {
					start,
					end,
					content,
					label: '', // Will be filled by extractContent
					value: undefined,
					descriptor,
					_patternMatch: match,
					_originalInput: input
				}

				return result
			}
		}

		return null
	}

	/**
	 * Extracts label and value from a match result
	 */
	extractContent(match: MatchResult): { label: string; value?: string } {
		const descriptor = match.descriptor as SegmentMarkupDescriptor
		const extendedMatch = match as ExtendedMatchResult
		
		// Try to get the stored pattern match first
		if (extendedMatch._patternMatch) {
			return this.extractFromParts(extendedMatch._patternMatch.parts, descriptor)
		}

		// Fallback: search for the match in the content
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

