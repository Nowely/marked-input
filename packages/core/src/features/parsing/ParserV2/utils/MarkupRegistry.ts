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
	/** Map from segment to descriptors that use this segment */
	readonly segmentsMap: Map<string, MarkupDescriptor[]>

	constructor(markups: Markup[]) {
		this.segmentsMap = new Map<string, MarkupDescriptor[]>()

		// Create descriptors first
		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)

			descriptor.segments.forEach(segment => {
				if (segment.length > 0) {
					const descriptors = this.segmentsMap.get(segment)
					if (descriptors) {
						descriptors.push(descriptor)
					} else {
						this.segmentsMap.set(segment, [descriptor])
					}
				}
			})

			return descriptor
		})

		this.segments = Array.from(this.segmentsMap.keys())
	}

	/**
	 * Gets all descriptors where the segment at the given index is the first segment
	 * @param segmentIndex Index of the segment in the deduplicated segments array
	 * @returns Array of descriptors where this segment is the first one
	 */
	getDescriptorsStartingWithSegment(segmentIndex: number): MarkupDescriptor[] {
		const segmentValue = this.segments[segmentIndex]
		const descriptors = this.segmentsMap.get(segmentValue) || []

		return descriptors.filter(descriptor => descriptor.segments[0] === segmentValue)
	}
}
