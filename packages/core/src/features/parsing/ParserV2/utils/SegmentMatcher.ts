/**
 * Result of a segment match in the text
 */
export interface SegmentMatch {
	/** Index in the patterns array */
	index: number
	/** Start position in text */
	start: number
	/** End position in text (exclusive) */
	end: number
	/** Matched text */
	value: string
}

/**
 * Segment matcher for efficient multi-pattern string matching
 * Uses regex alternation with length-based sorting to ensure correct precedence
 *
 * Features:
 * - Sorts segments by length (longest first) for proper pattern precedence
 * - Uses standard regex alternation for reliable matching
 * - Predictable behavior compatible with Aho-Corasick algorithm
 *
 * Note: Expects deduplicated segments from MarkupRegistry for optimal performance
 */
export class SegmentMatcher {
	private readonly segments: string[]
	private readonly regex: RegExp
	private readonly segmentToIndex: Map<string, number>

	constructor(segments: string[]) {
		this.segments = segments

		// Create mapping from segment to its index for fast lookup
		this.segmentToIndex = new Map(segments.map((segment, index) => [segment, index]))

		// Sort segments by length (longest first) to ensure longer patterns are matched before shorter ones
		const sortedSegments = [...segments].sort((a, b) => b.length - a.length)
		const escapedSegments = sortedSegments.map(segment => this.escapeRegex(segment))
		const pattern = `(?:${escapedSegments.join('|')})`

		// Use 'g' flag for global matching, 'u' for Unicode support
		this.regex = new RegExp(pattern, 'gu')
	}

	/**
	 * Searches for all pattern occurrences in the text using regex alternation
	 * @param text - Text to search in
	 * @returns Array of matches sorted by position (matchAll guarantees position order)
	 */
	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []

		// Use matchAll to find all matches
		// matchAll returns matches in order of their position in text
		for (const match of text.matchAll(this.regex)) {
			const matchedText = match[0] // Full match
			const start = match.index

			// Find the index of this segment in original segments array
			const index = this.segmentToIndex.get(matchedText)
			if (index === undefined) {
				// This shouldn't happen, but skip if segment not found
				continue
			}

			results.push({
				index,
				start,
				end: start + matchedText.length,
				value: matchedText,
			})
		}

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
