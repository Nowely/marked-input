import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {PatternPart} from '../utils/PatternChainManager'

/**
 * Event types for sweep line algorithm
 */
type EventType = 'match_start' | 'gap_start' | 'gap_end' | 'boundary_start' | 'boundary_end'

/**
 * Event for sweep line algorithm
 */
interface MatchEvent {
	type: EventType
	pos: number
	match: PatternMatch
	matchIndex: number
	gapType?: 'value' | 'meta' | 'nested'
	gapEnd?: number
}

/**
 * Interval for non-nested gaps tracking
 */
interface GapInterval {
	start: number
	end: number
	match: PatternMatch
}

/**
 * Helper to get match start position
 */
function getMatchStart(match: PatternMatch): number {
	return match.parts.length > 0 ? match.parts[0].start : 0
}

/**
 * Helper to get match end position (exclusive)
 */
function getMatchEnd(match: PatternMatch): number {
	return match.parts.length > 0 ? match.parts[match.parts.length - 1].end + 1 : 0
}

/**
 * Helper to get segment count in match
 */
function getSegmentCount(match: PatternMatch): number {
	return match.parts.filter(p => p.type === 'segment').length
}

/**
 * Sweep line filter for efficient match filtering
 * Reduces complexity from O(N²) to O(N log N)
 */
export class SweepLineFilter {
	constructor(private readonly descriptors: MarkupDescriptor[]) {}

	/**
	 * Filter matches that start inside non-nested gaps (__value__ or __meta__)
	 * Uses sweep line algorithm to track active non-nested gaps
	 * 
	 * Complexity: O(N × M log(N × M)) where N = matches, M = parts per match
	 * Previous: O(N² × M)
	 */
	filterByContainment(matches: PatternMatch[]): PatternMatch[] {
		if (matches.length === 0) return matches

		// Create events for non-nested gaps and match starts
		const events = this.createContainmentEvents(matches)

		// Sort events by position
		events.sort((a, b) => {
			if (a.pos !== b.pos) return a.pos - b.pos
			// Priority: gap_start < match_start < gap_end
			return this.getEventPriority(a.type) - this.getEventPriority(b.type)
		})

		// Track active non-nested gaps
		const activeGaps: GapInterval[] = []
		const filtered = new Set<PatternMatch>()

		for (const event of events) {
			if (event.type === 'gap_start') {
				// Add gap to active list
				activeGaps.push({
					start: event.pos,
					end: event.gapEnd!,
					match: event.match
				})
			} else if (event.type === 'gap_end') {
				// Remove gap from active list
				const index = activeGaps.findIndex(g => 
					g.start === event.pos - (event.gapEnd! - event.pos + 1) && 
					g.match === event.match
				)
				if (index !== -1) {
					activeGaps.splice(index, 1)
				}
			} else if (event.type === 'match_start') {
				// Check if match starts inside any active non-nested gap
				const matchStart = event.pos
				for (const gap of activeGaps) {
					if (matchStart >= gap.start && matchStart <= gap.end) {
						// Match starts inside a non-nested gap - filter it
						filtered.add(event.match)
						break
					}
				}
			}
		}

		return matches.filter(m => !filtered.has(m))
	}

	/**
	 * Filter overlapping matches of same descriptor at same position
	 * Keep only the most complete match for each (start, descriptorIndex) pair
	 * 
	 * Complexity: O(N)
	 * Previous: O(N²)
	 */
	filterByDescriptor(matches: PatternMatch[]): PatternMatch[] {
		if (matches.length === 0) return matches

		// Group matches by (start, descriptorIndex)
		const groups = new Map<string, PatternMatch[]>()

		for (const match of matches) {
			const start = getMatchStart(match)
			const key = `${start}_${match.descriptorIndex}`
			if (!groups.has(key)) {
				groups.set(key, [])
			}
			groups.get(key)!.push(match)
		}

		// For each group, keep only the most complete match
		const result: PatternMatch[] = []
		for (const group of groups.values()) {
			if (group.length === 1) {
				result.push(group[0])
			} else {
				// Find the most complete match
				const best = this.findMostComplete(group)
				result.push(best)
			}
		}

		return result
	}

	/**
	 * Filter partial matches (matches that are subsets of longer matches)
	 * A match is partial if another match has:
	 * - Same start but longer (extends further)
	 * - Same end but longer (starts earlier)
	 * 
	 * Complexity: O(N log N)
	 * Previous: O(N²)
	 */
	filterByBoundaries(matches: PatternMatch[]): PatternMatch[] {
		if (matches.length === 0) return matches

		// Group by start and end positions
		const byStart = new Map<number, PatternMatch[]>()
		const byEnd = new Map<number, PatternMatch[]>()

		for (const match of matches) {
			const start = getMatchStart(match)
			const end = getMatchEnd(match)

			if (!byStart.has(start)) byStart.set(start, [])
			byStart.get(start)!.push(match)

			if (!byEnd.has(end)) byEnd.set(end, [])
			byEnd.get(end)!.push(match)
		}

		const filtered = new Set<PatternMatch>()

		// Check matches with same start
		for (const group of byStart.values()) {
			if (group.length > 1) {
				this.markPartialAtSameStart(group, filtered)
			}
		}

		// Check matches with same end
		for (const group of byEnd.values()) {
			if (group.length > 1) {
				this.markPartialAtSameEnd(group, filtered)
			}
		}

		return matches.filter(m => !filtered.has(m))
	}

	/**
	 * Creates events for containment filtering
	 */
	private createContainmentEvents(matches: PatternMatch[]): MatchEvent[] {
		const events: MatchEvent[] = []

		matches.forEach((match, index) => {
			// Add match start event
			events.push({
				type: 'match_start',
				pos: getMatchStart(match),
				match,
				matchIndex: index
			})

			// Add gap events for non-nested gaps
			for (const part of match.parts) {
				if (part.type === 'gap' && (part.gapType === 'value' || part.gapType === 'meta')) {
					// Non-nested gap - add start and end events
					events.push({
						type: 'gap_start',
						pos: part.start,
						match,
						matchIndex: index,
						gapType: part.gapType,
						gapEnd: part.end
					})
					events.push({
						type: 'gap_end',
						pos: part.end + 1, // Exclusive end
						match,
						matchIndex: index,
						gapType: part.gapType,
						gapEnd: part.end
					})
				}
			}
		})

		return events
	}

	/**
	 * Get priority for event type (for sorting events at same position)
	 */
	private getEventPriority(type: EventType): number {
		switch (type) {
			case 'gap_start': return 0
			case 'match_start': return 1
			case 'gap_end': return 2
			case 'boundary_start': return 3
			case 'boundary_end': return 4
		}
	}

	/**
	 * Find the most complete match in a group
	 * More complete = more segments collected, or longer if same segment count
	 */
	private findMostComplete(group: PatternMatch[]): PatternMatch {
		let best = group[0]
		let bestSegments = getSegmentCount(best)
		let bestLength = getMatchEnd(best) - getMatchStart(best)

		for (let i = 1; i < group.length; i++) {
			const match = group[i]
			const segments = getSegmentCount(match)
			const length = getMatchEnd(match) - getMatchStart(match)

			if (segments > bestSegments || (segments === bestSegments && length > bestLength)) {
				best = match
				bestSegments = segments
				bestLength = length
			} else if (segments === bestSegments && length === bestLength) {
				// Same completeness - prefer the one that ends later
				const bestEnd = getMatchEnd(best)
				const matchEnd = getMatchEnd(match)
				if (matchEnd > bestEnd) {
					best = match
				}
			}
		}

		return best
	}

	/**
	 * Mark partial matches that have same start position
	 * Partial = shorter match when another is longer
	 */
	private markPartialAtSameStart(group: PatternMatch[], filtered: Set<PatternMatch>): void {
		// Sort by end position (descending - longest first)
		const sorted = [...group].sort((a, b) => getMatchEnd(b) - getMatchEnd(a))

		// First one is the longest - others are partial if shorter
		const longestEnd = getMatchEnd(sorted[0])
		for (let i = 1; i < sorted.length; i++) {
			const matchEnd = getMatchEnd(sorted[i])
			if (matchEnd < longestEnd) {
				filtered.add(sorted[i])
			}
		}
	}

	/**
	 * Mark partial matches that have same end position
	 * Partial = shorter match when another is longer
	 */
	private markPartialAtSameEnd(group: PatternMatch[], filtered: Set<PatternMatch>): void {
		// Sort by start position (ascending - earliest/longest first)
		const sorted = [...group].sort((a, b) => getMatchStart(a) - getMatchStart(b))

		// First one starts earliest - others are partial if start later
		const earliestStart = getMatchStart(sorted[0])
		for (let i = 1; i < sorted.length; i++) {
			const matchStart = getMatchStart(sorted[i])
			if (matchStart > earliestStart) {
				filtered.add(sorted[i])
			}
		}
	}
}

