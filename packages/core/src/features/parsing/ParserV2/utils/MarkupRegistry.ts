import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segments */
	readonly segments: string[]
	/** Map from segment to descriptor indices that use this segment. 
	 * Parallel array to segments - segmentToDescriptors[i] contains descriptors for segments[i] */
	readonly segmentToDescriptors: number[][]

	constructor(markups: Markup[]) {
		const segmentsMap = new Map<string, number[]>()

		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)

			descriptor.segments.forEach(segment => {
				if (segment.length > 0) {
					const indexes = segmentsMap.get(segment)
					if (indexes) {
						indexes.push(index)
					} else {
						segmentsMap.set(segment, [index])
					}
				}
			})

			return descriptor
		})

		this.segments = Array.from(segmentsMap.keys())
		this.segmentToDescriptors = Array.from(segmentsMap.values())
	}
}
