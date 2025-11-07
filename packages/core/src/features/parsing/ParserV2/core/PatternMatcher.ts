/**
 * Optimized Parser - Phase 1 & 2 Optimizations
 *
 * Key improvements:
 * 1. Direct SegmentMatch → Match → Token pipeline (no intermediate conversions)
 * 2. Inlined hot path functions (selectBestChain, priority calculations)
 * 3. Object pooling with actual reuse
 * 4. Minimal allocations in hot loops
 * 5. State machine approach instead of complex chain management
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {MarkupDescriptor} from './MarkupDescriptor'

/**
 * Position range for a gap (start and end positions)
 */
interface GapRange {
	start: number
	end: number
}

/**
 * Unified structure for storing positions of all gap types
 * Replaces individual properties (valueStart/End, nestedStart/End, etc.)
 */
interface GapPositions {
	value?: GapRange
	secondValue?: GapRange
	nested?: GapRange
	meta?: GapRange
}

/**
 * Unified match state structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */
export class MatchState {
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
	 * Updates gap position for a specific gap type
	 */
	private updateGapPosition(gapType: 'value' | 'nested' | 'meta', gapStart: number, gapEnd: number): void {
		switch (gapType) {
			case 'value':
				this.gaps.value = {start: gapStart, end: gapEnd}
				break
			case 'nested':
				this.gaps.nested ??= {start: gapStart, end: gapEnd}
				this.gaps.nested.end = gapEnd
				break
			case 'meta':
				this.gaps.meta ??= {start: gapStart, end: gapEnd}
				this.gaps.meta.end = gapEnd
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
		if (gapType === 'value' && this.descriptor.hasTwoValues) {
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
		const previousSegment = this.descriptor.segments[this.expectedSegmentIndex]
		this.end = this.end - previousSegment.length

		// Clear the gap END position that was set for the segment before this one
		// Keep the START position so we can extend the gap to the next occurrence
		const previousGapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]
		if (previousGapType === 'nested' || previousGapType === 'meta') {
			if (previousGapType === 'nested' && this.gaps.nested) {
				this.gaps.nested = {start: this.gaps.nested.start, end: this.gaps.nested.start}
			} else if (previousGapType === 'meta' && this.gaps.meta) {
				this.gaps.meta = {start: this.gaps.meta.start, end: this.gaps.meta.start}
			}
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
	static compareCompleting(a: MatchState, b: MatchState): number {
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
	static compareMatchPriority(a: MatchState, b: MatchState): number {
		// Longer first segment wins (** > *)
		const aFirstSegLen = a.descriptor.segments[0].length
		const bFirstSegLen = b.descriptor.segments[0].length
		if (aFirstSegLen !== bFirstSegLen) {
			return bFirstSegLen - aFirstSegLen
		}

		// Longer match wins
		const aLen = a.end - a.start
		const bLen = b.end - b.start
		if (aLen !== bLen) {
			return bLen - aLen
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

	private readonly waitingStates: Map<string, MatchState[]> = new Map()
	private readonly completedStates: Map<number, MatchState[]> = new Map()

	constructor(registry: MarkupRegistry) {
		this.registry = registry
	}

	/**
	 * Process segments with state machine to create match states
	 * Main method that converts found segments into structured match states
	 */
	process(segments: SegmentMatch[], input: string): MatchState[] {
		this.waitingStates.clear()
		this.completedStates.clear()

		for (const segment of segments) {
			this.processWaitingStates(segment, input)

			this.tryStartNewStates(segment)
		}

		return this.flattenMatchesByPosition()
	}

	/**
	 * Adds a state to the waiting list for a specific segment
	 */
	private addToWaitingList(state: MatchState, segment: string): void {
		if (!this.waitingStates.has(segment)) {
			this.waitingStates.set(segment, [])
		}
		this.waitingStates.get(segment)!.push(state)
	}

	/**
	 * Handles a successfully updated state - either completes it or adds to waiting list
	 */
	private handleUpdatedState(state: MatchState, segment: SegmentMatch): void {
		if (state.expectedSegmentIndex >= state.descriptor.segments.length) {
			// Pattern is complete
			state.markCompleted(segment)
			this.addToPositionIndex(state)
		} else {
			// Continue waiting for next segment
			const nextSegment = state.getNextSegment()!
			this.addToWaitingList(state, nextSegment)
		}
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		const sortedStates = waiting.toSorted(MatchPriority.compareCompleting)

		// Try states by priority until one is valid (iterate from end to start for safe removal)
		for (let i = sortedStates.length - 1; i >= 0; i--) {
			const state = sortedStates[i]
			waiting.splice(waiting.indexOf(state), 1)

			const isSuccess = state.updateWithSegment(segment, input)
			if (!isSuccess) {
				// Validation failed - rollback and re-add to waiting list
				const previousSegment = state.rollback()
				this.addToWaitingList(state, previousSegment)
				continue
			}

			// State updated successfully - handle completion or continue waiting
			this.handleUpdatedState(state, segment)
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
			// Create state for pattern (both single and multi-segment)
			const state = new MatchState(descriptor, 1, segment.start, segment.end)

			// Single segment pattern - complete immediately through general mechanism
			if (descriptor.segments.length === 1) {
				state.markCompleted(segment)
				// For single segment patterns, the entire segment is the value
				state.gaps.value = {start: segment.start, end: segment.end}
				this.addToPositionIndex(state)
				continue
			}

			// Multi-segment pattern - add to waiting list for next segment
			const nextSegment = state.getNextSegment()!
			this.addToWaitingList(state, nextSegment)
		}
	}

	/**
	 * Add match to position-indexed Map, handling collisions by keeping all matches
	 * TreeBuilder will filter them based on priority and nesting rules
	 */
	private addToPositionIndex(state: MatchState): void {
		const position = state.start
		const existing = this.completedStates.get(position)

		if (!existing) {
			// No collision - create new array with this match
			this.completedStates.set(position, [state])
			return
		}

		// Collision detected - add to array, will be sorted later
		existing.push(state)
	}

	/**
	 * Flatten position-indexed Map into sorted array of matches
	 * When multiple matches exist at same position, sort by priority:
	 * - Longer first segment first (** before *)
	 * - Longer total match first
	 * - More segments first
	 *
	 * Optimization: Only iterate over actual match positions, not entire input length
	 */
	private flattenMatchesByPosition(): MatchState[] {
		if (this.completedStates.size === 0) {
			return []
		}

		// Sort positions once
		const positions = Array.from(this.completedStates.keys()).sort((a, b) => a - b)
		const result: MatchState[] = []

		for (const position of positions) {
			const matches = this.completedStates.get(position)!

			if (matches.length === 1) {
				result.push(matches[0])
			} else {
				// Multiple matches at same position - sort by priority
				matches.sort(MatchPriority.compareMatchPriority)

				// Add all matches (TreeBuilder will filter overlaps)
				result.push(...matches)
			}
		}

		return result
	}
}
