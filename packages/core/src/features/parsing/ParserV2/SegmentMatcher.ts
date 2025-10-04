import {AhoCorasick, SegmentMatch} from './algorithms/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'
import {UniqueMatch} from './types'

/**
 * Segment matcher using Aho-Corasick algorithm
 */
export class SegmentMatcher {
	private readonly segmentList: string[]
	private readonly segmentMap: Array<{ descriptorIndex: number; segmentIndex: number }>
	private readonly ac: AhoCorasick

	constructor(descriptors: MarkupDescriptor[]) {
		this.segmentList = []
		this.segmentMap = []

		// Build unified segment list and mapping
		for (let di = 0; di < descriptors.length; di++) {
			const descriptor = descriptors[di]
			for (let si = 0; si < descriptor.segments.length; si++) {
				this.segmentList.push(descriptor.segments[si])
				this.segmentMap.push({ descriptorIndex: di, segmentIndex: si })
			}
		}

		// Build Aho-Corasick automaton
		this.ac = new AhoCorasick(this.segmentList)
	}

	/**
	 * Finds all segment matches and groups them by position+value
	 */
	findDeduplicatedMatches(text: string): UniqueMatch[] {
		const rawMatches = this.ac.search(text)

		// Group by position and value to handle multiple descriptors sharing same segments
		const matchesByPosValue = new Map<string, UniqueMatch>()

		for (const r of rawMatches) {
			const mapInfo = this.segmentMap[r.segIndex]
			const key = `${r.start}:${r.value}`

			if (!matchesByPosValue.has(key)) {
				matchesByPosValue.set(key, {
					start: r.start,
					end: r.end,
					value: r.value,
					descriptors: []
				})
			}
			matchesByPosValue.get(key)!.descriptors.push({
				descriptorIndex: mapInfo.descriptorIndex,
				segmentIndex: mapInfo.segmentIndex
			})
		}

		// Convert to array and sort by position
		const uniqueMatches = Array.from(matchesByPosValue.values())
		uniqueMatches.sort((a, b) => (a.start - b.start) || (a.end - b.end))

		return uniqueMatches
	}
}
