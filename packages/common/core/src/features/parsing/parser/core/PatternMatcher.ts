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

import {getSegmentIndex} from '../utils/getSegmentIndex'
import type {MarkupDescriptor} from './MarkupDescriptor'
import type {MarkupRegistry} from './MarkupRegistry'
import {Match} from './Match'
import type {SegmentMatch} from './SegmentMatcher'

function getOrCreate<K, V>(map: Map<K, V[]>, key: K): V[] {
	let arr = map.get(key)
	if (!arr) {
		arr = []
		map.set(key, arr)
	}
	return arr
}

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

		//TODO need review it
		this.resolveSlotLeadingMatches()

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

		if (match.isInvalid) return

		if (match.isCompleted) return this.addToCompleted(match)

		this.addToWaiting(match)
	}

	private tryStartNewStates(segment: SegmentMatch): void {
		this.registry.firstSegmentIndexMap.get(segment.index)?.forEach((descriptor: MarkupDescriptor) => {
			const match = new Match(descriptor, segment)

			if (match.isInvalid) return

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
		const map = match.isAwaitingLastSegment ? this.completingStates : this.pendingStates
		getOrCreate(map, segmentIndex).push(match)
	}

	/**
	 * Resolves slot-leading single-segment matches by extending their start backwards.
	 *
	 * For patterns like `__slot__\n\n`, the segment `\n\n` is a suffix delimiter and
	 * the slot content precedes it. After normal processing, such matches only cover
	 * the delimiter. This pass extends each slot-leading match backwards to the end
	 * of the previous slot-leading match (or input start), so that non-slot-leading
	 * matches between them become nested children rather than siblings.
	 */
	private resolveSlotLeadingMatches(): void {
		let hasSlotLeading = false
		for (const entry of this.completedStates) {
			if (this.isSlotLeading(entry.match)) {
				hasSlotLeading = true
				break
			}
		}
		if (!hasSlotLeading) return

		// Only slot-leading match boundaries matter — other matches become nested children
		let boundary = 0
		for (const entry of this.completedStates) {
			const {match} = entry
			if (this.isSlotLeading(match)) {
				const segmentStart = match.start
				match.start = boundary
				entry.position = boundary
				match.gaps.slot = {start: boundary, end: segmentStart}
				boundary = match.end
			}
		}

		this.completedStates.sort((a, b) => a.position - b.position)
	}

	private isSlotLeading(match: Match): boolean {
		return match.descriptor.segments.length === 1 && match.descriptor.hasSlot
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