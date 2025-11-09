import {GapType, GAP_TYPE} from '../constants'
import {PositionRange} from '../types'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'
import {getSegmentIndex} from '../utils/getSegmentIndex'

/**
 * Unified match structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */

export class Match {
	public readonly gaps: Partial<Record<GapType, PositionRange>> = {}
	/** Captured value from first dynamic segment (for hasTwoValues patterns) */
	private captured?: string

	public expectedSegmentIndex: number
	public readonly start: number
	public end: number

	constructor(
		public readonly descriptor: MarkupDescriptor,
		firstSegment: SegmentMatch
	) {
		this.expectedSegmentIndex = 1
		this.start = firstSegment.start
		this.end = firstSegment.end

		// Auto-complete single segment patterns
		if (descriptor.segments.length === 1) {
			this.expectedSegmentIndex = NaN
			this.gaps.value = {start: this.start, end: this.end}
		}

		if (descriptor.hasTwoValues && firstSegment.captured) {
			this.captured = firstSegment.captured
			const capturedStart = firstSegment.start + firstSegment.value.indexOf(firstSegment.captured)
			const capturedEnd = capturedStart + firstSegment.captured.length
			this.gaps.value = {start: capturedStart, end: capturedEnd}
		}
	}

	/**
	 * Check if the pattern is completed (computed property)
	 */
	get isCompleted(): boolean {
		return isNaN(this.expectedSegmentIndex)
	}

	/**
	 * Check if the match is waiting for the last segment (high priority)
	 */
	get isAwaitingLastSegment(): boolean {
		return this.expectedSegmentIndex === this.descriptor.segments.length - 1
	}

	/**
	 * Get the next expected segment index
	 */
	get nextSegment(): number | undefined {
		if (this.isCompleted) {
			return undefined
		}

		const baseIndex = this.descriptor.segmentGlobalIndices[this.expectedSegmentIndex]
		const segmentDef = this.descriptor.segments[this.expectedSegmentIndex]

		// Only hash for hasTwoValues closing tags that need value-specific matching
		if (typeof segmentDef === 'object' && this.descriptor.hasTwoValues &&
		    this.captured && this.expectedSegmentIndex === this.descriptor.segments.length - 1) {
			const value = segmentDef.template.replace('{}', this.captured)
			return getSegmentIndex(baseIndex, value)
		}

		return baseIndex
	}


	/**
	 * Update state with new segment by setting gap positions
	 */
	processNext(segment: SegmentMatch): void {
		const start = this.end
		const end = segment.start
		const gapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]

		this.gaps[gapType] = {start, end}

		this.end = segment.end
		this.expectedSegmentIndex++

		// Auto-complete if all segments are processed
		if (this.expectedSegmentIndex >= this.descriptor.segments.length) {
			this.expectedSegmentIndex = NaN
		}
	}
}
