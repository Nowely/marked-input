import {GapType, GAP_TYPE} from '../constants'
import {PositionRange} from '../types'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'

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

	constructor(
		public readonly descriptor: MarkupDescriptor,
		public expectedSegmentIndex: number,
		public readonly start: number,
		public end: number,
		firstSegment?: SegmentMatch
	) {
		// Auto-complete single segment patterns
		if (descriptor.segments.length === 1) {
			this.expectedSegmentIndex = NaN
			this.gaps.value = {start, end}
		}

		// For hasTwoValues patterns with dynamic segments, use pre-calculated captured positions
		if (descriptor.hasTwoValues && firstSegment?.captured) {
			// Use ready-made captured positions from SegmentMatch
			if (firstSegment.capturedStart !== undefined && firstSegment.capturedEnd !== undefined) {
				this.gaps.value = {
					start: firstSegment.capturedStart,
					end: firstSegment.capturedEnd
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
	 */
	get nextSegment(): number | undefined {
		if (this.isCompleted) {
			return undefined
		}
		return this.descriptor.segmentGlobalIndices[this.expectedSegmentIndex]
	}
	
	/**
	 * Get the expected segment value for hasTwoValues patterns
	 * For the second (closing) dynamic segment, returns the concrete value based on first captured value
	 * Uses template for simple substitution instead of fragile regex replacement
	 * Returns undefined for non-dynamic segments or first segment
	 */
	getExpectedSegmentValue(): string | undefined {
		if (!this.descriptor.hasTwoValues || !this.firstCapturedValue) {
			return undefined
		}

		// Check if current expected segment is the last one (closing dynamic segment)
		if (this.expectedSegmentIndex === this.descriptor.segments.length - 1) {
			const lastSegment = this.descriptor.segments[this.expectedSegmentIndex]
			// If it's a dynamic segment, use template for substitution
			if (typeof lastSegment !== 'string') {
				// Simple string substitution using template - no regex needed
				return lastSegment.template.replace('{}', this.firstCapturedValue)
			}
		}

		return undefined
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
