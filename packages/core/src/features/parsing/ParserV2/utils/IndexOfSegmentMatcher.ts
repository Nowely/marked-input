import {SegmentMatch} from './AhoCorasick'

/**
 * IndexOf-based segment matcher for efficient multi-pattern string matching
 * Uses indexOf() with overlapping search to find all segment occurrences
 *
 * Note: Expects deduplicated segments from MarkupRegistry for optimal performance
 */
export class IndexOfSegmentMatcher {
	private readonly segments: string[]
	private readonly segmentToIndex: Map<string, number>

	constructor(segments: string[]) {
		this.segments = segments

		// Create mapping from segment to its index for fast lookup
		this.segmentToIndex = new Map(segments.map((segment, index) => [segment, index]))
	}

	/**
	 * Searches for all pattern occurrences in the text using indexOf with overlapping search
	 * @param text - Text to search in
	 * @returns Array of matches in order of appearance
	 */
	search(text: string): SegmentMatch[] {
		const results: SegmentMatch[] = []

		// Check each segment individually to find all overlapping matches
		for (let i = 0; i < this.segments.length; i++) {
			const segment = this.segments[i]
			if (segment.length === 0) continue

			let startIndex = 0
			while ((startIndex = text.indexOf(segment, startIndex)) !== -1) {
				results.push({
					index: i,
					start: startIndex,
					end: startIndex + segment.length,
					value: segment,
				})
				startIndex += 1 // Move to next position to find overlapping matches
			}
		}

		// Sort results by start position, then by index in segments array (higher index first to match Aho-Corasick)
		results.sort((a, b) => {
			if (a.start !== b.start) {
				return a.start - b.start
			}
			return b.index - a.index // Higher index first for same start position
		})

		return results
	}
}
