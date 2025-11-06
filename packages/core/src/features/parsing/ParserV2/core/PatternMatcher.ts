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
import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'

/**
 * Unified match state structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */
export interface MatchState {
	/** Descriptor defining the markup pattern being matched */
	descriptor: MarkupDescriptor
	/** Index of the next expected segment (NaN for completed matches) */
	expectedSegmentIndex: number
	/** Starting position of the pattern in the input text */
	start: number
	/** End position of the last processed segment */
	end: number
	/** Track gap positions inline (no separate parts array) */
	valueStart?: number
	valueEnd?: number
	/** For patterns with two __value__ placeholders - store second __value__ separately */
	secondValueStart?: number
	secondValueEnd?: number
	nestedStart?: number
	nestedEnd?: number
	metaStart?: number
	metaEnd?: number
}

/**
 * Optimized parser using state machine approach
 */
export class PatternMatcher {
	private readonly registry: MarkupRegistry

	private readonly activeStates: MatchState[] = []
	private readonly completedMatches: MatchState[] = []
	private readonly waitingStates: Map<string, MatchState[]> = new Map()
	private readonly matchesByPosition: Map<number, MatchState[]> = new Map()

	constructor(registry: MarkupRegistry) {
		this.registry = registry
	}

	/**
	 * Process segments with state machine to create match states
	 * Main method that converts found segments into structured match states
	 * 
	 * Optimization: Uses position-indexed Map to store matches by their start position
	 * This provides natural sorting and enables O(N) filtering in TreeBuilder
	 * Map is more efficient than sparse array for texts with few matches
	 */
	process(segments: SegmentMatch[], input: string): MatchState[] {
		// Clear previous state
		this.activeStates.length = 0
		this.completedMatches.length = 0
		this.waitingStates.clear()
		this.matchesByPosition.clear()

		for (const segment of segments) {
			this.processWaitingStates(segment, input)

			this.tryStartNewStates(segment)
		}

		// Flatten position-indexed Map into sorted result
		return this.flattenMatchesByPosition()
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		const sortedStates = waiting.toSorted((a, b) => this.ascPriorityComparator(a, b))

		// Try states by priority until one is valid (iterate from end to start for safe removal)
		for (let i = sortedStates.length - 1; i >= 0; i--) {
			const state = sortedStates[i]
			waiting.splice(waiting.indexOf(state), 1)

			const isSuccess = this.tryUpdateStateWithSegment(state, segment, input)
			if (!isSuccess) {
				this.rollbackState(state)
				continue
			}

			// Check if pattern is complete
			if (state.expectedSegmentIndex >= state.descriptor.segments.length) {
				this.handleCompletedPattern(state, segment)
			} else {
				this.handleIncompletePattern(state)
			}

			break
		}
	}

	/**
	 * Rollback state after validation failure for hasTwoValues patterns
	 * Returns the state to waiting for the previous segment
	 */
	private rollbackState(state: MatchState): void {
		// Rollback: decrement expectedSegmentIndex to wait for previous segment again
		state.expectedSegmentIndex--

		// Rollback end position to before the previous segment
		const previousSegment = state.descriptor.segments[state.expectedSegmentIndex]
		state.end = state.end - previousSegment.length

		// Clear the gap END position that was set for the segment before this one
		// Keep the START position so we can extend the gap to the next occurrence
		const previousGapType = state.descriptor.gapTypes[state.expectedSegmentIndex - 1]
		if (previousGapType === 'nested') {
			state.nestedEnd = undefined
		} else if (previousGapType === 'meta') {
			state.metaEnd = undefined
		}

		// Put state back to waiting for the previous segment
		if (!this.waitingStates.has(previousSegment)) {
			this.waitingStates.set(previousSegment, [])
		}
		this.waitingStates.get(previousSegment)!.push(state)
	}

	/**
	 * Comparator for sorting states by priority rules for deterministic behavior
	 * Higher priority states are processed first to ensure consistent parsing
	 */
	private ascPriorityComparator(a: MatchState, b: MatchState): number {
		// Calculate priority scores for both states
		const aPriority = this.calculateDeterministicPriority(a)
		const bPriority = this.calculateDeterministicPriority(b)
		return aPriority - bPriority
	}

	/**
	 * Calculate deterministic priority score for a match state
	 * Higher scores = higher priority = processed first
	 */
	private calculateDeterministicPriority(state: MatchState): number {
		const descriptor = state.descriptor
		const expectedIndex = state.expectedSegmentIndex

		// Priority components (higher values = higher priority):
		// 1. States waiting for last segment get highest boost (10M)
		const completionBonus = expectedIndex === descriptor.segments.length - 1 ? 10_000_000 : 0

		// 2. Longer first segments get higher priority (** > *, 100K scale)
		const firstSegmentBonus = descriptor.segments[0].length * 100_000

		// 3. Later start positions get slight priority (LIFO, 1K scale)
		const positionBonus = state.start * 1000

		// 4. More progressed states get higher priority (100 scale)
		const progressBonus = expectedIndex * 100

		// 5. Patterns with more segments get slight priority (10 scale)
		const complexityBonus = descriptor.segments.length * 10

		return completionBonus + firstSegmentBonus + positionBonus + progressBonus + complexityBonus
	}

	/**
	 * Update match state with new segment by setting gap positions
	 * Returns true if state is valid, false if validation failed (for hasTwoValues patterns)
	 */
	private tryUpdateStateWithSegment(state: MatchState, segment: SegmentMatch, input: string): boolean {
		const gapStart = state.end
		const gapEnd = segment.start
		const gapType = state.descriptor.gapTypes[state.expectedSegmentIndex - 1]

		// Set gap positions based on type
		switch (gapType) {
			case 'value':
				if (state.descriptor.hasTwoValues) {
					if (state.valueStart === undefined) {
						state.valueStart = gapStart
						state.valueEnd = gapEnd
					} else {
						const firstValue = input.substring(state.valueStart, state.valueEnd)
						const secondValue = input.substring(gapStart, gapEnd)

						if (firstValue !== secondValue) {
							return false
						}

						state.secondValueStart = gapStart
						state.secondValueEnd = gapEnd
					}
					break
				}
				state.valueStart = gapStart
				state.valueEnd = gapEnd
				break
			case 'nested':
				state.nestedStart ??= gapStart
				state.nestedEnd = gapEnd
				break
			case 'meta':
				state.metaStart ??= gapStart
				state.metaEnd = gapEnd
				break
		}

		state.end = segment.end
		state.expectedSegmentIndex++
		return true
	}

	private handleCompletedPattern(state: MatchState, segment: SegmentMatch): void {
		state.expectedSegmentIndex = NaN
		state.end = segment.end
		this.completedMatches.push(state)
		
		// Add to position-indexed array
		this.addToPositionIndex(state)
	}

	private handleIncompletePattern(state: MatchState): void {
		const nextSegment = state.descriptor.segments[state.expectedSegmentIndex]
		if (!this.waitingStates.has(nextSegment)) {
			this.waitingStates.set(nextSegment, [])
		}
		this.waitingStates.get(nextSegment)!.push(state)
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
				const match: MatchState = {
					descriptor,
					expectedSegmentIndex: NaN, // Single segment pattern - complete immediately
					start: segment.start,
					end: segment.end,
					valueStart: segment.start,
					valueEnd: segment.end,
				}

				this.completedMatches.push(match)
				this.addToPositionIndex(match)
				continue
			}

			// Multi-segment pattern - create state
			const state: MatchState = {
				descriptor,
				expectedSegmentIndex: 1,
				start: segment.start,
				end: segment.end,
			}

			// Add to waiting list for next segment
			const nextSegment = descriptor.segments[state.expectedSegmentIndex!]
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
		const existing = this.matchesByPosition.get(position)

		if (!existing) {
			// No collision - create new array with this match
			this.matchesByPosition.set(position, [state])
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
		if (this.matchesByPosition.size === 0) {
			return []
		}

		// Sort positions once
		const positions = Array.from(this.matchesByPosition.keys()).sort((a, b) => a - b)
		const result: MatchState[] = []
		
		for (const position of positions) {
			const matches = this.matchesByPosition.get(position)!
			
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

}
