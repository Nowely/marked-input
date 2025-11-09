import {GapType, GAP_TYPE} from '../constants'
import {PositionRange} from '../types'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'
import {getSegmentIndex} from '../utils/getSegmentIndex'

/**
 * Unified match structure for pattern matching states
 *
 * Represents the state of a pattern matching process in the parser's state machine:
 * - Active: tracks progress through pattern segments (expectedSegmentIndex >= 0)
 * - Completed: all segments found, match is valid (expectedSegmentIndex = NaN)
 * - Invalid: match cannot be completed due to malformed segments (expectedSegmentIndex = -1)
 *
 * State detection:
 * - isCompleted: expectedSegmentIndex is NaN
 * - isInvalid: expectedSegmentIndex is -1
 * - isActive: expectedSegmentIndex >= 0 (not NaN and not -1)
 */

export class Match {
	public readonly gaps: Partial<Record<GapType, PositionRange>> = {}
	/** Captured value from first dynamic segment (for hasTwoValues patterns) */
	private captured?: string

	/**
	 * Index of expected next segment:
	 * - >= 0: active, waiting for segment at this index
	 * - NaN: completed successfully
	 * - -1: invalid, should be discarded
	 */
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
	 * Check if the match is invalid and should be discarded
	 */
	get isInvalid(): boolean {
		return this.expectedSegmentIndex === -1
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
		if (this.isCompleted || this.isInvalid) {
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

		// VALIDATION: Next segment must start after previous segment ends
		// If not, this match is permanently invalid
		if (end < start) {
			this.expectedSegmentIndex = -1
			return
		}

		this.gaps[gapType] = {start, end}

		this.end = segment.end
		this.expectedSegmentIndex++

		// Auto-complete if all segments are processed
		if (this.expectedSegmentIndex >= this.descriptor.segments.length) {
			this.expectedSegmentIndex = NaN
		}
	}
}
