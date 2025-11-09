import {GapType, GAP_TYPE} from '../constants'
import {PositionRange} from '../types'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'
import {getSegmentIndex} from '../utils/getSegmentIndex'

/**
 * Unified structure for storing positions of all gap types
 */
export interface GapPositions {
	value?: PositionRange
	nested?: PositionRange
	meta?: PositionRange
}

/**
 * Unified match structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */

export class Match {
	public readonly gaps: GapPositions = {}
	/** Captured value from first dynamic segment (for hasTwoValues patterns) */
	private firstCapturedValue?: string

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

		// For hasTwoValues patterns with dynamic segments, use pre-calculated captured positions
		if (descriptor.hasTwoValues && firstSegment?.captured) {
			// Use ready-made captured positions from SegmentMatch
			if (firstSegment.capturedStart !== undefined && firstSegment.capturedEnd !== undefined) {
				this.gaps.value = {
					start: firstSegment.capturedStart,
					end: firstSegment.capturedEnd,
				}
			}

			// Store captured value for validating second dynamic segment
			this.firstCapturedValue = firstSegment.captured
		}
	}

	/**
	 * Check if the pattern is completed (computed property)
	 */
	get isCompleted(): boolean {
		return isNaN(this.expectedSegmentIndex)
	}

	/**
	 * Check if the pattern is completing (on the last segment)
	 */
	get isCompleting(): boolean {
		return this.expectedSegmentIndex === this.descriptor.segments.length - 1
	}

	/**
	 * Get the next expected segment index
	 * Returns value-specific index for dynamic segments, base index for static segments
	 */
	get nextSegment(): number | undefined {
		if (this.isCompleted) {
			return undefined
		}

		const baseIndex = this.descriptor.segmentGlobalIndices[this.expectedSegmentIndex]
		const segmentDef = this.descriptor.segments[this.expectedSegmentIndex]

		if (typeof segmentDef === 'string') {
			// Static segment - no hashing needed
			return getSegmentIndex(baseIndex)
		} else if (this.descriptor.hasTwoValues && this.firstCapturedValue &&
		          this.expectedSegmentIndex === this.descriptor.segments.length - 1) {
			// Dynamic segment with expected value (hasTwoValues closing tag)
			const value = segmentDef.template.replace('{}', this.firstCapturedValue)
			return getSegmentIndex(baseIndex, value)
		} else {
			// Dynamic segment without specific expected value - no hashing needed
			return getSegmentIndex(baseIndex)
		}
	}


	/**
	 * Update state with new segment by setting gap positions
	 */
	updateWithSegment(segment: SegmentMatch, input: string): void {
		const start = this.end
		const end = segment.start
		const gapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]

		this.gaps[gapType] = {start, end}

		this.end = segment.end
		this.expectedSegmentIndex++
	}

	/**
	 * Mark state as completed
	 */
	markCompleted(segment: SegmentMatch): void {
		this.expectedSegmentIndex = NaN
		this.end = segment.end
	}
}
