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
import {MatchResult} from '../types'
import {MarkupDescriptor} from './MarkupDescriptor'

/**
 * Unified match state structure for both active pattern matching and completed matches
 *
 * Represents the state of a pattern matching process in the parser's state machine.
 * For active states: tracks progress through pattern segments with expectedSegmentIndex
 * For completed matches: contains final positions without expectedSegmentIndex
 */
interface MatchState {
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
export class PatternProcessor {
	private readonly registry: MarkupRegistry

	private readonly activeStates: MatchState[] = []
	private readonly completedMatches: MatchState[] = []
	private readonly waitingStates: Map<string, MatchState[]> = new Map()

	constructor(registry: MarkupRegistry) {
		this.registry = registry
	}

	/**
	 * Process segments with state machine to create match results
	 * Main method that converts found segments into structured match results
	 */
	process(segments: SegmentMatch[], input: string): MatchResult[] {
		// Clear previous state
		this.activeStates.length = 0
		this.completedMatches.length = 0
		this.waitingStates.clear()

		for (const segment of segments) {
			this.processWaitingStates(segment, input)

			this.tryStartNewStates(segment)
		}

		const filtered = this.filterOverlappingMatches()
		return this.convertToMatchResults(input, filtered)
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		const sortedStates = waiting.toSorted(this.ascPriorityComparator)

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
	 * Comparator for sorting states by asc priority
	 */
	private ascPriorityComparator(a: MatchState, b: MatchState) {
		return calculatePriority(a) - calculatePriority(b)

		/**
		 * Calculate priority for a state. Higher = better priority
		 */
		function calculatePriority(state: MatchState): number {
			const descriptor = state.descriptor
			const expectedIndex = state.expectedSegmentIndex

			const isWaitingForLastSegment = expectedIndex === descriptor.segments.length - 1
			const firstSegLength = descriptor.segments[0].length // ** = 2, * = 1

			return (
				(isWaitingForLastSegment ? 10_000_000 : 0) + // Completing patterns first
				firstSegLength * 100_000 + // Longer first segments (** > *)
				state.start * 1000 + // Later starts (LIFO)
				expectedIndex * 100 + // More progress
				descriptor.segments.length * 10 // Longer patterns
			)
		}
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
	 * Filter overlapping and partial matches
	 *
	 * Strategy: Filter only TRUE conflicts, preserve valid nesting
	 * Note: Invalid nested states (outside __nested__ sections) are already canceled
	 * by cancelInvalidNestedStates() in handleCompletedPattern()
	 *
	 * A conflict is when two matches:
	 * 1. Start at the same position (only one can win)
	 * 2. One is completely inside another at the same level (shorter match filtered)
	 * 3. Partial overlap (keep earlier one)
	 *
	 * Complexity: O(N log N) for sort + O(N²) for filtering
	 */
	private filterOverlappingMatches(): MatchState[] {
		if (this.completedMatches.length === 0) return []

		// Sort: start ascending, end descending (longer first), then by segment length
		this.completedMatches.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start
			if (a.end !== b.end) return b.end - a.end

			const aDesc = a.descriptor
			const bDesc = b.descriptor
			const aSegLen = aDesc.segments[0].length
			const bSegLen = bDesc.segments[0].length

			// Longer first segment first (** before *)
			if (aSegLen !== bSegLen) return bSegLen - aSegLen

			// More segments first
			return bDesc.segments.length - aDesc.segments.length
		})

		const filtered: MatchState[] = []

		for (const match of this.completedMatches) {
			let shouldFilter = false

			// Pre-filter: Skip TRULY empty matches (nested content has negative length)
			const matchDesc = match.descriptor
			if (matchDesc.hasNested && match.nestedStart !== undefined && match.nestedEnd !== undefined) {
				const nestedLength = match.nestedEnd - match.nestedStart
				if (nestedLength < 0) {
					shouldFilter = true
					continue
				}
			}

			for (const existing of filtered) {
				// Case 1: Same start position - keep only the longest (first due to sort)
				if (match.start === existing.start) {
					shouldFilter = true
					break
				}

				// Case 2: Match is completely inside existing
				if (match.start >= existing.start && match.end <= existing.end) {
					// If strictly inside (not sharing boundaries), it might be valid nesting
					if (match.start > existing.start || match.end < existing.end) {
						// Check if match is inside existing's nested content (valid nesting)
						// Invalid nesting (in __value__/__meta__ sections) is already filtered by cancelInvalidNestedStates()
						const existingDesc = existing.descriptor
						
						if (
							existingDesc.hasNested &&
							existing.nestedStart !== undefined &&
							existing.nestedEnd !== undefined &&
							match.start >= existing.nestedStart &&
							match.end <= existing.nestedEnd
						) {
							// Valid nesting - match is inside existing's __nested__ section
							// Keep both (don't filter)
							continue
						}
						
						// If we reach here, either:
						// - existing has no __nested__ (shouldn't happen - already canceled)
						// - match is not in nested section (shouldn't happen - already canceled)
						// - they're competing at same level
						// Filter to be safe
						shouldFilter = true
						break
					} else {
						// Same boundaries - filter the shorter/weaker one (already handled by sort)
						shouldFilter = true
						break
					}
				}

				// Case 3: Partial overlap (neither fully contains the other)
				// Example: **bold** [0,8] and *italic* [6,14] overlap at [6,8]
				// Keep the one that started first
				const matchesOverlap =
					match.start < existing.end &&
					match.end > existing.start && // They overlap
					!(match.start >= existing.start && match.end <= existing.end) && // match not inside
					!(existing.start >= match.start && existing.end <= match.end) // existing not inside

				if (matchesOverlap) {
					shouldFilter = true
					break
				}
			}

			if (!shouldFilter) {
				filtered.push(match)
			}
		}

		return filtered
	}

	/**
	 * Convert direct matches to MatchResult format for tree builder
	 */
	private convertToMatchResults(input: string, matches: MatchState[]): MatchResult[] {
		const results: MatchResult[] = []

		for (const match of matches) {
			// Extract content inline
			const value =
				match.valueStart !== undefined && match.valueEnd !== undefined
					? input.substring(match.valueStart, match.valueEnd)
					: ''

			const nested =
				match.nestedStart !== undefined && match.nestedEnd !== undefined
					? input.substring(match.nestedStart, match.nestedEnd)
					: undefined

			const meta =
				match.metaStart !== undefined && match.metaEnd !== undefined
					? input.substring(match.metaStart, match.metaEnd)
					: undefined

			results.push({
				start: match.start,
				end: match.end,
				content: input.substring(match.start, match.end),
				value,
				valueStart: match.valueStart ?? match.start,
				valueEnd: match.valueEnd ?? match.start,
				nested,
				nestedStart: match.nestedStart,
				nestedEnd: match.nestedEnd,
				meta,
				metaStart: match.metaStart,
				metaEnd: match.metaEnd,
				descriptor: match.descriptor,
			})
		}

		return results
	}
}
