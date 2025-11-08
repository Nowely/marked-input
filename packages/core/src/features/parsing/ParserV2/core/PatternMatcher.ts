/**
 * PatternMatcher - State Machine for Markup Pattern Recognition
 *
 * Implements a high-performance state machine that processes segments to identify
 * and match markup patterns. Manages Match objects representing parsing states
 * for different markup descriptors, handling gap positions and completion logic.
 *
 * Key features:
 * - State machine approach for pattern matching
 * - Position-based indexing for efficient lookups
 * - Priority-based conflict resolution for overlapping matches
 * - Gap position management for nested content extraction
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'
import {PositionRange} from '../types'
import {GapType, GAP_TYPE} from '../constants'

/**
 * Unified structure for storing positions of all gap types
 * Replaces individual properties (valueStart/End, nestedStart/End, etc.)
 */
interface GapPositions {
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
		public end: number
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
	 * Get the next expected segment
	 */
	getNextSegment(): string | undefined {
		if (this.isCompleted()) {
			return undefined
		}
		return this.descriptor.segments[this.expectedSegmentIndex]
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
		const gap = this.gaps[gapKey] ??= {start: gapStart, end: gapEnd}
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
	 * Returns the previous segment that this state should wait for
	 */
	rollback(): string {
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

		return previousSegment
	}

	/**
	 * Mark state as completed
	 */
	markCompleted(segment: SegmentMatch): void {
		this.expectedSegmentIndex = NaN
		this.end = segment.end
	}
}

/**
 * Priority comparison functions for match states
 */
class MatchPriority {
	/**
	 * Compare states by completing priority (states completing have higher priority)
	 * Used for sorting waiting states to process completing patterns first
	 */
	static compareCompleting(a: Match, b: Match): number {
		const aCompleting = a.isCompleting() ? 1 : 0
		const bCompleting = b.isCompleting() ? 1 : 0
		return aCompleting - bCompleting
	}

	/**
	 * Compare matches by overall priority for deterministic ordering
	 * Priority rules:
	 * 1. Longer first segment wins (** > *)
	 * 2. Longer match wins
	 * 3. More segments wins
	 * Used for sorting completed matches at the same position
	 */
	static compareMatchPriority(a: Match, b: Match): number {
		// Longer first segment wins (** > *)
		const aFirstSegLen = a.descriptor.segments[0].length
		const bFirstSegLen = b.descriptor.segments[0].length
		if (aFirstSegLen !== bFirstSegLen) {
			return bFirstSegLen - aFirstSegLen
		}

		// Longer match wins
		const firstMatchLength = a.end - a.start
		const secondMatchLength = b.end - b.start
		if (firstMatchLength !== secondMatchLength) {
			return secondMatchLength - firstMatchLength
		}

		// More segments wins
		return b.descriptor.segments.length - a.descriptor.segments.length
	}
}

/**
 * Optimized parser using state machine approach
 */
export class PatternMatcher {
	private readonly registry: MarkupRegistry

	private readonly waitingStates: Map<string, Match[]> = new Map()
	// Changed from Map to array of {position, matches} to maintain sorted order
	private readonly completedStates: Array<{position: number; matches: Match[]}> = []

	constructor(registry: MarkupRegistry) {
		this.registry = registry
	}

	/**
	 * Process segments with state machine to create match states
	 * Main method that converts found segments into structured match states
	 */
	process(segments: SegmentMatch[], input: string): Match[] {
		this.waitingStates.clear()
		this.completedStates.length = 0

		for (const segment of segments) {
			this.processWaitingStates(segment, input)

			this.tryStartNewStates(segment)
		}

		return this.flattenMatchesByPosition()
	}

	/**
	 * Adds a state to the waiting list for a specific segment
	 */
	private addToWaitingList(match: Match, segment: string): void {
		if (!this.waitingStates.has(segment)) {
			this.waitingStates.set(segment, [])
		}
		this.waitingStates.get(segment)!.push(match)
	}

	/**
	 * Handles a successfully updated state - either completes it or adds to waiting list
	 */
	private handleUpdatedState(match: Match, segment: SegmentMatch): void {
		if (match.expectedSegmentIndex >= match.descriptor.segments.length) {
			// Pattern is complete
			match.markCompleted(segment)
			this.addToPositionIndex(match)
		} else {
			// Continue waiting for next segment
			const nextSegment = match.getNextSegment()!
			this.addToWaitingList(match, nextSegment)
		}
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		// Sort states by completing priority (completing states should be processed first)
		// Completing states have higher priority and come at the end after sorting
		const sortedStates = waiting.toSorted(MatchPriority.compareCompleting)

		// Try states by priority until one is valid (iterate from end to start for safe removal)
		for (let i = sortedStates.length - 1; i >= 0; i--) {
			const match = sortedStates[i]
			waiting.splice(waiting.indexOf(match), 1)

			const isSuccess = match.updateWithSegment(segment, input)
			if (!isSuccess) {
				// Validation failed - rollback and re-add to waiting list
				const previousSegment = match.rollback()
				this.addToWaitingList(match, previousSegment)
				continue
			}

			// State updated successfully - handle completion or continue waiting
			this.handleUpdatedState(match, segment)
			break
		}
	}

	/**
	 * Try to start new pattern states
	 */
	private tryStartNewStates(segment: SegmentMatch): void {
		const descriptors = this.registry.firstSegmentsMap.get(segment.value)

		if (!descriptors) return

		for (const descriptor of descriptors) {
			// Create match for pattern (both single and multi-segment)
			const match = new Match(descriptor, 1, segment.start, segment.end)

			// Single segment pattern - complete immediately through general mechanism
			if (descriptor.segments.length === 1) {
				match.markCompleted(segment)
				// For single segment patterns, the entire segment is the value
				match.gaps.value = {start: segment.start, end: segment.end}
				this.addToPositionIndex(match)
				continue
			}

			// Multi-segment pattern - add to waiting list for next segment
			const nextSegment = match.getNextSegment()!
			this.addToWaitingList(match, nextSegment)
		}
	}

	/**
	 * Add match to position-indexed array, maintaining sorted order
	 * Uses binary search to find insertion point
	 * TreeBuilder will filter overlaps based on nesting rules
	 */
	private addToPositionIndex(match: Match): void {
		const position = match.start

		// Binary search to find the insertion point or existing position
		let left = 0
		let right = this.completedStates.length

		while (left < right) {
			const mid = Math.floor((left + right) / 2)
			if (this.completedStates[mid].position < position) {
				left = mid + 1
			} else {
				right = mid
			}
		}

		// Check if we found an existing entry at this position
		if (left < this.completedStates.length && this.completedStates[left].position === position) {
			// Position exists - insert match in sorted order by priority
			const matches = this.completedStates[left].matches
			
			// Find insertion point in matches array to maintain priority order
			// compareMatchPriority(a, b) returns positive when b has higher priority
			// Insert before the first match with higher priority (comparison > 0)
			// For equal priority (comparison === 0), insert after (stable sort)
			let insertIdx = 0
			while (insertIdx < matches.length) {
				const comparison = MatchPriority.compareMatchPriority(match, matches[insertIdx])
				if (comparison > 0) {
					// matches[insertIdx] has higher priority, insert before it
					break
				}
				insertIdx++
			}
			
			matches.splice(insertIdx, 0, match)
		} else {
			// New position - insert new entry at the correct position
			this.completedStates.splice(left, 0, {position, matches: [match]})
		}
	}

	/**
	 * Flatten position-indexed array into flat array of matches
	 * No sorting needed - positions and priorities are already maintained by addToPositionIndex
	 */
	private flattenMatchesByPosition(): Match[] {
		if (this.completedStates.length === 0) {
			return []
		}

		const result: Match[] = []

		// Simply flatten the already-sorted structure
		for (const entry of this.completedStates) {
			result.push(...entry.matches)
		}

		return result
	}
}
