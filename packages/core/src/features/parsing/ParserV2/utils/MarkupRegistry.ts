import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly markups: Markup[]
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segments */
	readonly segments: string[]
	/** Map from segment to descriptors that use this segment */
	readonly segmentsMap: Map<string, MarkupDescriptor[]>
	/** Pre-sorted descriptors by first segment (for startNewChains optimization) */
	readonly firstSegmentsMap: Map<string, MarkupDescriptor[]>

	constructor(markups: Markup[]) {
		this.markups = markups
		this.segmentsMap = new Map<string, MarkupDescriptor[]>()
		this.firstSegmentsMap = new Map<string, MarkupDescriptor[]>()

		// Create descriptors and build maps
		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)
			const firstSegment = descriptor.segments[0]

			// Build segmentsMap for all segments
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

			// Build firstSegmentsMap for first segment only
			if (firstSegment.length > 0) {
				const firstDescriptors = this.firstSegmentsMap.get(firstSegment)
				if (firstDescriptors) {
					firstDescriptors.push(descriptor)
				} else {
					this.firstSegmentsMap.set(firstSegment, [descriptor])
				}
			}

			return descriptor
		})

		this.segments = Array.from(this.segmentsMap.keys())
	}
}
