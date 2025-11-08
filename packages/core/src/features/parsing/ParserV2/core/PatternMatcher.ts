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
import {Match} from './Match'

/**
 * Priority comparison functions for match states
 */
class MatchPriority {
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
	private readonly pendingStates: Map<number, Match[]> = new Map()
	private readonly completingStates: Map<number, Match[]> = new Map()
	// Changed from Map to array of {position, matches} to maintain sorted order
	private readonly completedStates: Array<{position: number; matches: Match[]}> = []

	constructor(private readonly registry: MarkupRegistry) {}

	/** Main method that converts found segments into structured matches */
	process(segments: SegmentMatch[], input: string): Match[] {
		this.pendingStates.clear()
		this.completingStates.clear()
		this.completedStates.length = 0

		for (const segment of segments) {
			this.processWaitingStates(segment, input)
			this.tryStartNewStates(segment)
		}

		return this.completedStates.flatMap(entry => entry.matches)
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 * Process completing states first (higher priority), then pending states
	 * Process only one state per call
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const match = this.dequeueWaitingMatch(segment.index)
		if (match) {
			const isSuccess = match.updateWithSegment(segment, input)
			if (!isSuccess) {
				// Validation failed - rollback and re-add to waiting list
				const previousSegmentIndex = match.rollback()
				this.addToWaiting(match, previousSegmentIndex)
			} else {
				// State updated successfully - handle completion or continue waiting
				this.handleUpdatedState(match, segment)
			}
		}
	}

	/**
	 * Gets the next waiting match for the given segment index
	 * Prioritizes completing states over pending states
	 * Returns undefined if no waiting matches exist
	 */
	private dequeueWaitingMatch(segmentIndex: number): Match | undefined {
		// Try completing states first (higher priority)
		const completingArray = this.completingStates.get(segmentIndex)
		if (completingArray?.length) {
			return completingArray.shift()
		}

		// Try pending states if no completing states
		const pendingArray = this.pendingStates.get(segmentIndex)
		if (pendingArray?.length) {
			return pendingArray.shift()
		}

		return undefined
	}

	private tryStartNewStates(segment: SegmentMatch): void {
		this.registry.firstSegmentIndexMap.get(segment.index)?.forEach(descriptor => {
			const match = new Match(descriptor, 1, segment.start, segment.end)

			if (match.isCompleted) return this.addToCompleted(match)

			this.addToWaiting(match, match.nextSegment!)
		})
	}

	/**
	 * Adds a state to the waiting list for a specific segment
	 * Inserts both pending and completing states at the beginning (LIFO order)
	 */
	private addToWaiting(match: Match, segmentIndex: number): void {
		if (match.isCompleting) {
			const states = this.completingStates.get(segmentIndex) || []
			if (states.length === 0) {
				this.completingStates.set(segmentIndex, states)
			}
			// Completing states go to the beginning (LIFO order - last added, first processed)
			states.unshift(match)
		} else {
			const states = this.pendingStates.get(segmentIndex) || []
			if (states.length === 0) {
				this.pendingStates.set(segmentIndex, states)
			}
			// Pending states go to the beginning (LIFO order - last added, first processed)
			states.unshift(match)
		}
	}

	/**
	 * Handles a successfully updated state - either completes it or adds to waiting list
	 */
	private handleUpdatedState(match: Match, segment: SegmentMatch): void {
		if (match.expectedSegmentIndex >= match.descriptor.segments.length) {
			// Pattern is complete
			match.markCompleted(segment)
			this.addToCompleted(match)
		} else {
			// Continue waiting for next segment
			const nextSegmentIndex = match.nextSegment!
			this.addToWaiting(match, nextSegmentIndex)
		}
	}

	/**
	 * Add match to position-indexed array, maintaining sorted order
	 * Uses binary search to find insertion point
	 * TreeBuilder will filter overlaps based on nesting rules
	 */
	private addToCompleted(match: Match): void {
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
}
