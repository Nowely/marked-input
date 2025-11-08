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
	/** Map from first segment index to descriptors that start with this segment (for O(1) lookup) */
	readonly firstSegmentIndexMap: Map<number, MarkupDescriptor[]>
	/** Map from segment string to its index in segments array for O(1) lookup */
	readonly segmentToIndex: Map<string, number>

	constructor(markups: Markup[]) {
		this.markups = markups
		this.segmentsMap = new Map<string, MarkupDescriptor[]>()
		this.firstSegmentIndexMap = new Map<number, MarkupDescriptor[]>()

		// Temporary storage for building segments array and index mapping
		const segmentsArray: string[] = []
		const segmentIndexMap = new Map<string, number>()

		// Create descriptors and build all maps in single pass
		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)
			const firstSegment = descriptor.segments[0]

			// Build segmentsMap for all segments and collect unique segments with indices
			descriptor.segments.forEach(segment => {
				if (segment.length > 0) {
					// Assign index to segment if not already assigned
					if (!segmentIndexMap.has(segment)) {
						const index = segmentsArray.length
						segmentsArray.push(segment)
						segmentIndexMap.set(segment, index)
					}

					// Fill segmentsMap
					const descriptors = this.segmentsMap.get(segment)
					if (descriptors) {
						descriptors.push(descriptor)
					} else {
						this.segmentsMap.set(segment, [descriptor])
					}
				}
			})

			// Build firstSegmentIndexMap immediately
			if (firstSegment.length > 0) {
				const segmentIndex = segmentIndexMap.get(firstSegment)!
				const descriptors = this.firstSegmentIndexMap.get(segmentIndex)
				if (descriptors) {
					descriptors.push(descriptor)
				} else {
					this.firstSegmentIndexMap.set(segmentIndex, [descriptor])
				}
			}

			return descriptor
		})

		// Finalize segments and segmentToIndex
		this.segments = segmentsArray
		this.segmentToIndex = segmentIndexMap
	}
}
