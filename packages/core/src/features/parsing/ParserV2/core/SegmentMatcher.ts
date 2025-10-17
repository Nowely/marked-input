import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupRegistry} from '../utils/MarkupRegistry'
import {UniqueMatch} from '../types'

/**
 * Segment matcher that deduplicates raw matches and maps them to descriptors
 */
export class SegmentMatcher {
	private readonly registry: MarkupRegistry

	constructor(registry: MarkupRegistry) {
		this.registry = registry
	}

	/**
	 * Deduplicates raw matches and groups them by position+value
	 * Now works with already deduplicated segments from registry
	 */
	deduplicateMatches(segments: SegmentMatch[]): UniqueMatch[] {
		const matchesByPosValue = new Map<string, UniqueMatch>()

		for (const segment of segments) {
			// segment.index is now index in deduplicated segments array
			const descriptorIndices = this.registry.segmentToDescriptors[segment.index]
			const key = `${segment.start}:${segment.value}`

			const existing = matchesByPosValue.get(key)
			if (!existing) {
				// Build descriptors array with segment indices for each descriptor
				const descriptors = descriptorIndices.map(descriptorIndex => {
					const descriptor = this.registry.descriptors[descriptorIndex]
					// Find which segment index this is within the descriptor
					const segmentIndex = descriptor.segments.indexOf(segment.value)
					return {descriptorIndex, segmentIndex}
				})

				matchesByPosValue.set(key, {
					start: segment.start,
					end: segment.end,
					value: segment.value,
					descriptors,
				})
			}
			// No need for else - segments are already deduplicated in AhoCorasick
		}

		//also sort by position 
		//TODO remove sorting?
		return Array.from(matchesByPosValue.values()).sort((a, b) => a.start - b.start || a.end - b.end)
	}
}
