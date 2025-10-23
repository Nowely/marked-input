import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'
import {PatternSorting} from './PatternSorting'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 * Optimization: Pre-sorts descriptors by priority to avoid repeated sorting
 */
export class MarkupRegistry {
	readonly markups: Markup[]
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segments */
	readonly segments: string[]
	/** Map from segment to descriptors that use this segment */
	readonly segmentsMap: Map<string, MarkupDescriptor[]>
	/** Pre-sorted descriptors by first segment (for startNewChains optimization) */
	private readonly sortedDescriptorsByFirstSegment: Map<string, MarkupDescriptor[]>

	constructor(markups: Markup[]) {
		this.markups = markups
		this.segmentsMap = new Map<string, MarkupDescriptor[]>()
		this.sortedDescriptorsByFirstSegment = new Map<string, MarkupDescriptor[]>()

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
		
		// Pre-sort descriptors by first segment for optimization
		this.buildSortedDescriptorMaps()
	}

	/**
	 * Pre-sorts descriptors by priority for each first segment
	 * This eliminates the need to sort on every segment match
	 */
	private buildSortedDescriptorMaps(): void {
		for (const [segment, descriptors] of this.segmentsMap) {
			// Find descriptors where this segment is the first one
			const descriptorsWithFirstSegment = descriptors.filter(
				descriptor => descriptor.segments[0] === segment
			)
			
			// Sort them once by priority
			if (descriptorsWithFirstSegment.length > 0) {
				const sorted = [...descriptorsWithFirstSegment].sort(PatternSorting.compareDescriptorPriority)
				this.sortedDescriptorsByFirstSegment.set(segment, sorted)
			}
		}
	}

	/**
	 * Gets all descriptors where the segment at the given index is the first segment
	 * Returns pre-sorted array (no sorting needed)
	 * @param segmentIndex Index of the segment in the deduplicated segments array
	 * @returns Pre-sorted array of descriptors where this segment is the first one
	 */
	getDescriptorsStartingWithSegment(segmentIndex: number): MarkupDescriptor[] {
		const segmentValue = this.segments[segmentIndex]
		return this.sortedDescriptorsByFirstSegment.get(segmentValue) || []
	}
}
