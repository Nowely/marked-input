import {Markup} from '../types'
import {MarkupDescriptor, createMarkupDescriptor} from '../core/MarkupDescriptor'
import {SegmentDefinition} from './SegmentMatcher'

/**
 * Registry for managing markup descriptors
 * Centralizes access to all markup patterns and their descriptors
 */
export class MarkupRegistry {
	readonly markups: Markup[]
	readonly descriptors: MarkupDescriptor[]
	/** Deduplicated list of unique segment definitions (static strings or dynamic patterns) */
	readonly segments: SegmentDefinition[] = []
	/** Map from first segment index to descriptors that start with this segment (for O(1) lookup) */
	readonly firstSegmentIndexMap: Map<number, MarkupDescriptor[]> = new Map()

	constructor(markups: Markup[]) {
		this.markups = markups

		const segmentIndexMap = new Map<string, number>()

		this.descriptors = markups.map((markup, index) => {
			const descriptor = createMarkupDescriptor(markup, index)

			// Process segments and register them
			descriptor.segments.forEach((segment, segmentIndex) => {
				this.processSegment(descriptor, segment, segmentIndex, segmentIndexMap)
			})

			this.addToFirstSegmentIndexMap(descriptor)

			return descriptor
		})
	}

	/**
	 * Adds a descriptor to the firstSegmentIndexMap using its first segment's global index
	 */
	private addToFirstSegmentIndexMap(descriptor: MarkupDescriptor): void {
		const firstSegmentIndex = descriptor.segmentGlobalIndices[0]
		if (firstSegmentIndex === undefined) return

		const descriptors = this.firstSegmentIndexMap.get(firstSegmentIndex)
		if (descriptors) {
			descriptors.push(descriptor)
		} else {
			this.firstSegmentIndexMap.set(firstSegmentIndex, [descriptor])
		}
	}

	private processSegment(
		descriptor: MarkupDescriptor,
		segment: SegmentDefinition,
		segmentIndex: number,
		segmentIndexMap: Map<string, number>
	): void {
		const segmentKey = this.getSegmentKey(segment)
		if (!segmentKey) return

		this.registerSegment(segment, segmentKey, segmentIndexMap)

		const globalIndex = segmentIndexMap.get(segmentKey)!
		descriptor.segmentGlobalIndices[segmentIndex] = globalIndex

		// Register static parts of dynamic segments
		if (typeof segment !== 'string') {
			const [before, after] = segment
			if (before) {
				this.registerSegment(before, before, segmentIndexMap)
			}
			if (after) {
				this.registerSegment(after, after, segmentIndexMap)
			}
		}
	}

	private registerSegment(
		segment: SegmentDefinition,
		segmentKey: string,
		segmentIndexMap: Map<string, number>
	): void {
		if (!segmentIndexMap.has(segmentKey)) {
			const globalIndex = this.segments.length
			this.segments.push(segment)
			segmentIndexMap.set(segmentKey, globalIndex)
		}
	}

	/**
	 * Gets a unique key for a segment definition
	 * For static segments (strings), returns the string itself if non-empty
	 * For dynamic segments (arrays), returns before|after|exclusions if before or after is non-empty
	 * Returns empty string for segments that should be ignored
	 */
	private getSegmentKey(segment: SegmentDefinition): string {
		if (typeof segment === 'string') {
			return segment
		}
		// For dynamic segments, create a key from before+after+exclusions
		const [before, after, exclusions] = segment
		// Only return a key if there's something to match (before or after is non-empty)
		if (before || after) {
			return `${before}|${after}|${exclusions}`
		}
		return ''
	}
}
