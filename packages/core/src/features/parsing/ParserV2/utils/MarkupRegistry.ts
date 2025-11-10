import {Markup} from '../types'
import {createMarkupDescriptor, MarkupDescriptor} from '../core/MarkupDescriptor'
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
	/** Map from segment key to descriptors that use this segment */
	readonly segmentsMap: Map<string, MarkupDescriptor[]> = new Map()
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

			// Build segmentsMap for this descriptor
			descriptor.segments.forEach(segment => {
				const segmentKey = this.getSegmentKey(segment)
				if (segmentKey) {
					this.addToMultiMap(this.segmentsMap, segmentKey, descriptor)
				}
			})

			// Build firstSegmentIndexMap using pre-computed global index
			const firstSegmentIndex = descriptor.segmentGlobalIndices[0]
			if (firstSegmentIndex !== undefined) {
				this.addToMultiMap(this.firstSegmentIndexMap, firstSegmentIndex, descriptor)
			}

			return descriptor
		})
	}

	/**
	 * Adds a value to a Map of arrays (multi-map), creating the array if it doesn't exist
	 */
	private addToMultiMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
		const values = map.get(key)
		if (values) {
			values.push(value)
		} else {
			map.set(key, [value])
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

		this.registerStaticParts(segment, segmentIndexMap)
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

	private registerStaticParts(segment: SegmentDefinition, segmentIndexMap: Map<string, number>): void {
		if (typeof segment === 'string') return

		const [before, after] = segment
		if (before) {
			this.registerSegment(before, before, segmentIndexMap)
		}
		if (after) {
			this.registerSegment(after, after, segmentIndexMap)
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
