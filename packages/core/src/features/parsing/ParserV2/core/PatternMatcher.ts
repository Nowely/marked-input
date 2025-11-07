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
 * Unified match state structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */
export class MatchState {
	constructor(
		public readonly descriptor: MarkupDescriptor,
		public expectedSegmentIndex: number,
		public readonly start: number,
		public end: number,
		public valueStart?: number,
		public valueEnd?: number,
		public secondValueStart?: number,
		public secondValueEnd?: number,
		public nestedStart?: number,
		public nestedEnd?: number,
		public metaStart?: number,
		public metaEnd?: number
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
	 * Update state with new segment by setting gap positions
	 * Returns true if state is valid, false if validation failed (for hasTwoValues patterns)
	 */
	updateWithSegment(segment: SegmentMatch, input: string): boolean {
		const gapStart = this.end
		const gapEnd = segment.start
		const gapType = this.descriptor.gapTypes[this.expectedSegmentIndex - 1]

		// Set gap positions based on type
		switch (gapType) {
			case 'value':
				if (this.descriptor.hasTwoValues) {
					if (this.valueStart === undefined) {
						this.valueStart = gapStart
						this.valueEnd = gapEnd
					} else {
						const firstValue = input.substring(this.valueStart, this.valueEnd)
						const secondValue = input.substring(gapStart, gapEnd)

						if (firstValue !== secondValue) {
							return false
						}

						this.secondValueStart = gapStart
						this.secondValueEnd = gapEnd
					}
					break
				}
				this.valueStart = gapStart
				this.valueEnd = gapEnd
				break
			case 'nested':
				this.nestedStart ??= gapStart
				this.nestedEnd = gapEnd
				break
			case 'meta':
				this.metaStart ??= gapStart
				this.metaEnd = gapEnd
				break
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
		if (previousGapType === 'nested') {
			this.nestedEnd = undefined
		} else if (previousGapType === 'meta') {
			this.metaEnd = undefined
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

	/**
	 * Comparator for sorting states by priority rules for deterministic behavior
	 * Higher priority states are processed first to ensure consistent parsing
	 * States that are completing (on last segment) have higher priority
	 */
	static compareCompletingPriority(a: MatchState, b: MatchState): number {
		const aCompleting = a.isCompleting() ? 1 : 0
		const bCompleting = b.isCompleting() ? 1 : 0
		return aCompleting - bCompleting
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
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		const sortedStates = waiting.toSorted(MatchState.compareCompletingPriority)

		// Try states by priority until one is valid (iterate from end to start for safe removal)
		for (let i = sortedStates.length - 1; i >= 0; i--) {
			const state = sortedStates[i]
			waiting.splice(waiting.indexOf(state), 1)

			const isSuccess = state.updateWithSegment(segment, input)
			if (!isSuccess) {
				const previousSegment = state.rollback()
				if (!this.waitingStates.has(previousSegment)) {
					this.waitingStates.set(previousSegment, [])
				}
				this.waitingStates.get(previousSegment)!.push(state)
				continue
			}

			// Check if pattern is complete
			if (state.expectedSegmentIndex >= state.descriptor.segments.length) {
				state.markCompleted(segment)
				this.addToPositionIndex(state)
			} else {
				const nextSegment = state.getNextSegment()!
				if (!this.waitingStates.has(nextSegment)) {
					this.waitingStates.set(nextSegment, [])
				}
				this.waitingStates.get(nextSegment)!.push(state)
			}

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
			// Single segment pattern - complete immediately
			//TODO it's not correct. need tests
			if (descriptor.segments.length === 1) {
				const match = new MatchState(
					descriptor,
					NaN, // Single segment pattern - complete immediately
					segment.start,
					segment.end,
					segment.start,
					segment.end
				)

				this.addToPositionIndex(match)
				continue
			}

			// Multi-segment pattern - create state
			const state = new MatchState(descriptor, 1, segment.start, segment.end)

			// Add to waiting list for next segment
			const nextSegment = state.getNextSegment()!
			if (!this.waitingStates.has(nextSegment)) {
				this.waitingStates.set(nextSegment, [])
			}
			this.waitingStates.get(nextSegment)!.push(state)
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
				matches.sort((a, b) => {
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
				})

				// Add all matches (TreeBuilder will filter overlaps)
				result.push(...matches)
			}
		}

		return result
	}

	/**
	 * Check if a waiting state conflicts with a completed state
	 *
	 * Conflict rules:
	 * 1. Completed state that started AFTER waiting state cannot cancel it (younger cannot cancel older)
	 * 2. If both start at same position - longer completed state wins
	 * 3. If waiting state has no nested → conflicts (will overlap)
	 * 4. If waiting state has nested but completed state doesn't fit in expected range → conflicts
	 */
	// private isConflicting(waitingState: MatchState, completedState: MatchState): boolean {
	// 	// Rule 1: Completed state started after waiting state - cannot cancel it
	// 	// "Younger brother" cannot cancel "older brother"
	// 	if (completedState.start > waitingState.start) {
	// 		return false
	// 	}

	// 	// Rule 2: Same start position - longer completed state wins
	// 	if (waitingState.start === completedState.start) {
	// 		// If completed state is longer or equal, cancel the waiting state
	// 		return completedState.end >= waitingState.end
	// 	}

	// 	// From here: completedState.start < waitingState.start
	// 	// Completed state started before waiting state

	// 	// Rule 3: Waiting state has no nested → will conflict with any completed state that overlaps
	// 	if (!waitingState.descriptor.hasNested) {
	// 		// Check if completed state overlaps with waiting state
	// 		return completedState.end > waitingState.start
	// 	}

	// 	// Rule 4: Waiting state has nested - check if completed state could fit in nested range
	// 	// We need to check if the completed state would be inside the potential nested range
	// 	// The nested range would be from waitingState.end (current position) to some future closing segment
	// 	// If completedState ends before waitingState starts, no conflict
	// 	if (completedState.end <= waitingState.start) {
	// 		return false
	// 	}

	// 	// If we have nestedStart/nestedEnd already set, check if completed state fits
	// 	if (waitingState.nestedStart !== undefined && waitingState.nestedEnd !== undefined) {
	// 		// Completed state must be fully inside nested range
	// 		const fitsInNested =
	// 			completedState.start >= waitingState.nestedStart &&
	// 			completedState.end <= waitingState.nestedEnd
	// 		return !fitsInNested
	// 	}

	// 	// Completed state overlaps with waiting state's current position
	// 	// This is a conflict
	// 	return completedState.end > waitingState.start
	// }

	/**
	 * Cancel waiting states that conflict with a newly completed state
	 *
	 * This optimization removes states early that will never complete successfully
	 * due to conflicts with already completed patterns.
	 *
	 * Checks all waiting states with start <= completedState.start
	 */
	// private cancelInvalidWaitingStates(completedState: MatchState): void {
	// 	// Iterate over Map entries directly (no need to sort - we filter anyway)
	// 	for (const [startPos, states] of this.waitingStatesByStart) {
	// 		// Skip positions that started after the completed state
	// 		if (startPos > completedState.start) continue

	// 		// Check each state at this position (iterate backwards for safe removal)
	// 		for (let i = states.length - 1; i >= 0; i--) {
	// 			const waitingState = states[i]

	// 			// Check if this waiting state conflicts with the completed state
	// 			if (this.isConflicting(waitingState, completedState)) {
	// 				// Remove from all indices
	// 				// We need to find which segment this state is waiting for
	// 				const nextSegment = waitingState.descriptor.segments[waitingState.expectedSegmentIndex]
	// 				this.removeWaitingState(waitingState, nextSegment)
	// 			}
	// 		}
	// 	}
	// }
}
