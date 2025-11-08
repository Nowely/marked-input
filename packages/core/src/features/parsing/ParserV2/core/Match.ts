import {GapType, GAP_TYPE} from '../constants'
import {PositionRange} from '../types'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'
import {MarkupRegistry} from '../utils/MarkupRegistry'

/**
 * Unified structure for storing positions of all gap types
 * Replaces individual properties (valueStart/End, nestedStart/End, etc.)
 */
export interface GapPositions {
	value?: PositionRange
	secondValue?: PositionRange
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

	constructor(
		public readonly descriptor: MarkupDescriptor,
		public expectedSegmentIndex: number,
		public readonly start: number,
		public end: number,
		private readonly registry: MarkupRegistry
	) {}

	/**
	 * Check if the pattern is completed
	 */
	isCompleted(): boolean {
		return isNaN(this.expectedSegmentIndex)
	}

	/**
	 * Check if the pattern is completing (on the last segment)
	 */
	isCompleting(): boolean {
		return this.expectedSegmentIndex === this.descriptor.segments.length - 1
	}

	/**
	 * Get the next expected segment index
	 */
	getNextSegment(): number | undefined {
		if (this.isCompleted()) {
			return undefined
		}
		const segment = this.descriptor.segments[this.expectedSegmentIndex]
		return this.registry.segmentToIndex.get(segment)
	}

	/**
	 * Validates and updates two value positions for hasTwoValues patterns
	 * Returns true if values match, false otherwise
	 */
	private validateTwoValues(gapStart: number, gapEnd: number, input: string): boolean {
		if (this.gaps.value === undefined) {
			this.gaps.value = {start: gapStart, end: gapEnd}
			return true
		}

		const firstValue = input.substring(this.gaps.value.start, this.gaps.value.end)
		const secondValue = input.substring(gapStart, gapEnd)

		if (firstValue !== secondValue) {
			return false
		}

		this.gaps.secondValue = {start: gapStart, end: gapEnd}
		return true
	}

	/**
	 * Updates an extendable gap (nested or meta) by extending its end position
	 */
	private updateExtendableGap(gapType: GapType, gapStart: number, gapEnd: number): void {
		const gapKey = gapType === GAP_TYPE.Nested ? 'nested' : 'meta'
		const gap = (this.gaps[gapKey] ??= {start: gapStart, end: gapEnd})
		gap.end = gapEnd
	}

	/**
	 * Resets an extendable gap (nested or meta) to start-only state for rollback
	 */
	private resetExtendableGapForRollback(gapType: GapType): void {
		const gapKey = gapType === GAP_TYPE.Nested ? 'nested' : 'meta'
		const gap = this.gaps[gapKey]
		if (gap) {
			gap.end = gap.start
		}
	}

	/**
	 * Updates gap position for a specific gap type
	 */
	private updateGapPosition(gapType: GapType, gapStart: number, gapEnd: number): void {
		switch (gapType) {
			case GAP_TYPE.Value:
				this.gaps.value = {start: gapStart, end: gapEnd}
				break
			case GAP_TYPE.Nested:
			case GAP_TYPE.Meta:
				this.updateExtendableGap(gapType, gapStart, gapEnd)
				break
		}
	}

	/**
	 * Update state with new segment by setting gap positions
	 * Returns true if state is valid, false if validation failed (for hasTwoValues patterns)
	 */
	updateWithSegment(segment: SegmentMatch, input: string): boolean {
		const gapStart = this.end
		const gapEnd = segment.start
		const gapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]

		// Handle value gap with special validation for hasTwoValues patterns
		if (gapType === GAP_TYPE.Value && this.descriptor.hasTwoValues) {
			if (!this.validateTwoValues(gapStart, gapEnd, input)) {
				return false
			}
		} else {
			// Handle other gap types (value without hasTwoValues, nested, meta)
			this.updateGapPosition(gapType, gapStart, gapEnd)
		}

		this.end = segment.end
		this.expectedSegmentIndex++
		return true
	}

	/**
	 * Rollback state after validation failure for hasTwoValues patterns
	 * Returns the previous segment index that this state should wait for
	 */
	rollback(): number {
		// Rollback: decrement expectedSegmentIndex to wait for previous segment again
		this.expectedSegmentIndex--

		// Rollback end position to before the previous segment
		// When validation fails, we need to "rewind" the end position back by the length
		// of the previous segment, so the state can be retried with different input
		const previousSegment = this.descriptor.segments[this.expectedSegmentIndex]
		this.end = this.end - previousSegment.length

		// Clear the gap END position that was set for the segment before this one
		// Keep the START position so we can extend the gap to the next occurrence
		const previousGapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]
		if (previousGapType === GAP_TYPE.Nested || previousGapType === GAP_TYPE.Meta) {
			this.resetExtendableGapForRollback(previousGapType)
		}

		return this.registry.segmentToIndex.get(previousSegment)!
	}

	/**
	 * Mark state as completed
	 */
	markCompleted(segment: SegmentMatch): void {
		this.expectedSegmentIndex = NaN
		this.end = segment.end
	}
}
