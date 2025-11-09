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
 * - Processing order-based conflict resolution for overlapping matches
 * - Gap position management for nested content extraction
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {SegmentMatch} from '../utils/SegmentMatcher'
import {Match} from './Match'
import {getSegmentIndex} from '../utils/getSegmentIndex'

/**
 * Optimized parser using state machine approach
 */
export class PatternMatcher {
	private readonly pendingStates: Map<number, Match[]> = new Map()
	private readonly completingStates: Map<number, Match[]> = new Map()
	private readonly completedStates: Array<{position: number; match: Match}> = []

	constructor(private readonly registry: MarkupRegistry) {}

	/** Main method that converts found segments into structured matches */
	process(segments: SegmentMatch[]): Match[] {
		this.pendingStates.clear()
		this.completingStates.clear()
		this.completedStates.length = 0

		for (const segment of segments) {
			this.processWaitingStates(segment)
			this.tryStartNewStates(segment)
		}

		return this.completedStates.map(entry => entry.match)
	}

	/**
	 * Process states waiting for this segment
	 * Try states by priority until one is valid, keeping rejected states for later attempts
	 * Process completing states first (higher priority), then pending states
	 * Process only one state per call
	 */
	private processWaitingStates(segment: SegmentMatch): void {
		const match = this.dequeueWaitingMatch(segment)
		if (!match) return

		match.processNext(segment)

		if (match.isCompleted) return this.addToCompleted(match)

		this.addToWaiting(match)
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
	 * Add match to position-indexed array, replacing any existing match at the same position
	 * Uses binary search to find insertion point and maintains sorted order
	 * Relies on processing order to determine which match to keep
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
			// Position exists - replace with the new match
			this.completedStates[left].match = match
		} else {
			// New position - insert new entry at the correct position
			this.completedStates.splice(left, 0, {position, match})
		}
	}
}
