import {SegmentMatch} from './AhoCorasick'

/**
 * Regex-based segment matcher for efficient multi-pattern string matching
 * Uses regex alternation (?:pattern1|pattern2|...) to find all segment occurrences
 *
 * Note: Expects deduplicated segments from MarkupRegistry for optimal performance
 */
export class RegexSegmentMatcher {
	private readonly segments: string[]
	private readonly regex: RegExp
	private readonly segmentToIndex: Map<string, number>

	constructor(segments: string[]) {
		this.segments = segments

		// Create mapping from segment to its index for fast lookup
		this.segmentToIndex = new Map(segments.map((segment, index) => [segment, index]))

		// Create optimized regex pattern
		const escapedSegments = segments.map(segment => this.escapeRegex(segment))
		const pattern = `(?:${escapedSegments.join('|')})`

		// Use 'g' flag for global matching, 'u' for Unicode support
		this.regex = new RegExp(pattern, 'gu')
	}

	/**
	 * Searches for all pattern occurrences in the text using regex alternation
	 * @param text - Text to search in
	 * @returns Array of matches sorted by position and priority
	 */
	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []
		this.regex.lastIndex = 0 // Reset regex state

		let match: RegExpExecArray | null
		while ((match = this.regex.exec(text)) !== null) {
			const matchedText = match[0]
			const start = match.index
			const end = start + matchedText.length

			// Find the index of this segment
			const index = this.segmentToIndex.get(matchedText)
			if (index === undefined) {
				// This shouldn't happen, but skip if segment not found
				continue
			}

			results.push({
				index,
				start,
				end,
				value: matchedText,
			})

			// Prevent infinite loop on zero-width matches
			if (matchedText.length === 0) {
				this.regex.lastIndex++
			}
		}

		// Sort results by start position, then by index in segments array (higher index first)
		results.sort((a, b) => {
			if (a.start !== b.start) {
				return a.start - b.start
			}
			return b.index - a.index // Higher index first for same start position
		})

		return results
	}

	/**
	 * Escapes special regex characters in a segment string
	 */
	private escapeRegex(segment: string): string {
		// Escape all special regex characters
		return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}
}

