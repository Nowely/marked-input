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
import {SegmentDefinition, SegmentMatch} from '../utils/SegmentMatcher'
import {Match} from './Match'
import {getSegmentIndex} from '../utils/getSegmentIndex'

/**
 * Gets the length of a segment definition
 * For static segments returns string length, for dynamic segments returns pattern length
 */
function getSegmentLength(segment: SegmentDefinition): number {
	return typeof segment === 'string' ? segment.length : segment.pattern.length
}

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
		const aFirstSegLen = getSegmentLength(a.descriptor.segments[0])
		const bFirstSegLen = getSegmentLength(b.descriptor.segments[0])
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
		const match = this.dequeueWaitingMatch(segment)
		if (!match) return

		match.updateWithSegment(segment, input)

		if (match.isCompleted) {
			this.addToCompleted(match)
		} else {
			// Continue waiting for next segment
			this.addToWaiting(match)
		}
	}

	private tryStartNewStates(segment: SegmentMatch): void {
		this.registry.firstSegmentIndexMap.get(segment.index)?.forEach(descriptor => {
			const match = new Match(descriptor, segment)

			if (match.isCompleted) return this.addToCompleted(match)

			this.addToWaiting(match)
		})
	}

	/**
	 * Gets the next waiting match for the given segment
	 * Uses value-specific index for dynamic segments, base index for static segments
	 */
	private dequeueWaitingMatch(segment: SegmentMatch): Match | undefined {
		const index = segment.captured ? getSegmentIndex(segment.index, segment.value) : segment.index

		const completingArray = this.completingStates.get(index)
		if (completingArray?.length) return completingArray.pop()

		const pendingArray = this.pendingStates.get(index)
		if (pendingArray?.length) return pendingArray.pop()
	}

	/**
	 * Adds a state to the waiting list for the next expected segment
	 */
	private addToWaiting(match: Match): void {
		const segmentIndex = match.nextSegment!

		if (match.isAwaitingLastSegment) {
			const states = this.completingStates.get(segmentIndex) || []
			if (states.length === 0) this.completingStates.set(segmentIndex, states)
			states.push(match)
		} else {
			const states = this.pendingStates.get(segmentIndex) || []
			if (states.length === 0) this.pendingStates.set(segmentIndex, states)
			states.push(match)
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
