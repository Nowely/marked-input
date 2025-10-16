import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'
import {UniqueMatch} from '../types'

/**
 * Segment matcher that deduplicates raw matches and maps them to descriptors
 *
 * Takes raw segment matches from Aho-Corasick and:
 * - Groups matches by position and value to eliminate duplicates
 * - Maps segment indices to descriptor and segment indices
 * - Returns unique matches ready for pattern building
 */
export class SegmentMatcher {
	private readonly segmentMap: Array<{descriptorIndex: number; segmentIndex: number}>

	constructor(descriptors: MarkupDescriptor[]) {
		this.segmentMap = descriptors.flatMap((descriptor, di) =>
			descriptor.segments.map((_, si) => ({descriptorIndex: di, segmentIndex: si}))
		)
	}

	/**
	 * Deduplicates raw matches and groups them by position+value
	 */
	deduplicateMatches(segments: SegmentMatch[]): UniqueMatch[] {
		const matchesByPosValue = new Map<string, UniqueMatch>()

		for (const segment of segments) {
			const mapInfo = this.segmentMap[segment.index]
			const key = `${segment.start}:${segment.value}`

			const existing = matchesByPosValue.get(key)
			if (!existing) {
				matchesByPosValue.set(key, {
					start: segment.start,
					end: segment.end,
					value: segment.value,
					descriptors: [mapInfo],
				})
			} else {
				existing.descriptors.push(mapInfo)
			}
		}

		//also sort by position
		return Array.from(matchesByPosValue.values()).sort((a, b) => a.start - b.start || a.end - b.end)
	}
}
