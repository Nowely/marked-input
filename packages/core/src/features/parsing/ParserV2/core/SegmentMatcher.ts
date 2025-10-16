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
		this.segmentMap = []

		// Build unified segment mapping
		for (let di = 0; di < descriptors.length; di++) {
			const descriptor = descriptors[di]
			for (let si = 0; si < descriptor.segments.length; si++) {
				this.segmentMap.push({descriptorIndex: di, segmentIndex: si})
			}
		}
	}

	/**
	 * Deduplicates raw matches and groups them by position+value
	 */
	deduplicateMatches(segments: SegmentMatch[]): UniqueMatch[] {
		// Group by position and value to handle multiple descriptors sharing same segments
		const matchesByPosValue = new Map<string, UniqueMatch>()

		for (const segment of segments) {
			const mapInfo = this.segmentMap[segment.index]
			const key = `${segment.start}:${segment.value}`

			if (!matchesByPosValue.has(key)) {
				matchesByPosValue.set(key, {
					start: segment.start,
					end: segment.end,
					value: segment.value,
					descriptors: [],
				})
			}
			matchesByPosValue.get(key)!.descriptors.push({
				descriptorIndex: mapInfo.descriptorIndex,
				segmentIndex: mapInfo.segmentIndex,
			})
		}

		// Convert to array and sort by position
		const uniqueMatches = Array.from(matchesByPosValue.values())
		uniqueMatches.sort((a, b) => a.start - b.start || a.end - b.end)

		return uniqueMatches
	}
}
