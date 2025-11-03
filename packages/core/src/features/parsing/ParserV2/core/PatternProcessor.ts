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

/**
 * Minimal match structure - no intermediate conversions
 */
interface DirectMatch {
	start: number
	end: number
	descriptorIndex: number
	// Positions for content extraction
	valueStart: number
	valueEnd: number
	nestedStart?: number
	nestedEnd?: number
	metaStart?: number
	metaEnd?: number
}

/**
 * Active pattern state - minimal structure for state machine
 */
interface ActiveState {
	descriptorIndex: number
	segmentIndex: number  // Current segment we're waiting for
	startPos: number      // Where pattern started
	lastPos: number       // Last segment end position
	// Track gap positions inline (no separate parts array)
	valueStart: number
	valueEnd: number
	nestedStart: number
	nestedEnd: number
	metaStart: number
	metaEnd: number
}

/**
 * Optimized parser using state machine approach
 */
export class PatternProcessor {
	private readonly registry: MarkupRegistry

	// Object pools for zero-allocation parsing
	private readonly statePool: ActiveState[] = []
	private readonly matchPool: DirectMatch[] = []

	// Reusable arrays to avoid allocations
	private readonly activeStates: ActiveState[] = []
	private readonly completedMatches: DirectMatch[] = []
	private readonly waitingStates: Map<string, ActiveState[]> = new Map()

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

		// Process segments with state machine - O(N * M)
		this.processSegmentsInternal(segments, input)

		// Filter overlapping matches - O(N log N)
		const filtered = this.filterOverlappingMatches()

		// Convert matches to MatchResults for tree builder
		return this.convertToMatchResults(input, filtered)
	}

	/**
	 * Process all segments with state machine approach
	 */
	private processSegmentsInternal(segments: SegmentMatch[], input: string): void {
		for (const segment of segments) {
			// Process waiting states first
			this.processWaitingStates(segment, input)
			
			// Try to start new states
			this.tryStartNewStates(segment)
		}
	}

	/**
	 * Process states waiting for this segment
	 * INLINED: All priority logic inline for performance
	 */
	private processWaitingStates(segment: SegmentMatch, input: string): void {
		const waiting = this.waitingStates.get(segment.value)
		if (!waiting || waiting.length === 0) return

		// INLINE: Select best state with inline priority calculation
		let bestIdx = 0
		let bestPriority = this.calculatePriority(waiting[0])
		
		for (let i = 1; i < waiting.length; i++) {
			const priority = this.calculatePriority(waiting[i])
			if (priority > bestPriority) {
				bestIdx = i
				bestPriority = priority
			}
		}

		const best = waiting[bestIdx]
		const descriptor = this.registry.descriptors[best.descriptorIndex]
		
		// Check if segment matches expected
		if (descriptor.segments[best.segmentIndex] !== segment.value) {
			return
		}

		// Update state with new segment
		const gapStart = best.lastPos
		const gapEnd = segment.start
		const gapType = descriptor.gapTypes[best.segmentIndex - 1]
		
		// INLINE: Update gap positions based on type
		if (gapType === 'value') {
			best.valueStart = gapStart
			best.valueEnd = gapEnd
		} else if (gapType === 'nested') {
			best.nestedStart = gapStart
			best.nestedEnd = gapEnd
		} else if (gapType === 'meta') {
			best.metaStart = gapStart
			best.metaEnd = gapEnd
		}
		
		best.lastPos = segment.end + 1
		best.segmentIndex++

		// Check if pattern is complete
		if (best.segmentIndex >= descriptor.segments.length) {
			// Pattern complete - validate and create match
			
		// For patterns with two __value__ placeholders (e.g., <__value__>__nested__</__value__>)
		// both values must be equal (opening and closing tags must match)
		if (descriptor.hasTwoValues) {
			// We need to extract both values from the input
			// The last value is in best.valueStart/valueEnd
			// We need to find the first value
			
			// Find which gaps are values
			let firstValueGapIdx = -1
			let secondValueGapIdx = -1
			for (let i = 0; i < descriptor.gapTypes.length; i++) {
				if (descriptor.gapTypes[i] === 'value') {
					if (firstValueGapIdx === -1) {
						firstValueGapIdx = i
					} else {
						secondValueGapIdx = i
						break
					}
				}
			}
			
			if (firstValueGapIdx !== -1 && secondValueGapIdx !== -1) {
				// Second value we already have
				const value2 = input.substring(best.valueStart, best.valueEnd)
				
				// First value: find it by parsing from the start
				// Position after first segment
				let pos = best.startPos + descriptor.segments[0].length
				
				// Skip gaps before the first value gap
				for (let i = 0; i < firstValueGapIdx; i++) {
					// Find next segment
					const nextSeg = descriptor.segments[i + 1]
					const nextPos = input.indexOf(nextSeg, pos)
					if (nextPos === -1) break
					pos = nextPos + nextSeg.length
				}
				
				// Now pos is at the start of first value gap
				// Find the end of this gap (next segment)
				const nextSeg = descriptor.segments[firstValueGapIdx + 1]
				const endPos = input.indexOf(nextSeg, pos)
				const value1 = endPos !== -1 ? input.substring(pos, endPos) : ''
				
				// Validate
				if (value1 !== value2) {
					// Values don't match - reject
					waiting.splice(bestIdx, 1)
					this.releaseState(best)
					return
				}
			}
		}
			
			const match = this.acquireMatch()
			match.start = best.startPos
			match.end = segment.end + 1
			match.descriptorIndex = best.descriptorIndex
			match.valueStart = best.valueStart
			match.valueEnd = best.valueEnd
			match.nestedStart = best.nestedStart !== -1 ? best.nestedStart : undefined
			match.nestedEnd = best.nestedEnd !== -1 ? best.nestedEnd : undefined
			match.metaStart = best.metaStart !== -1 ? best.metaStart : undefined
			match.metaEnd = best.metaEnd !== -1 ? best.metaEnd : undefined
			
			this.completedMatches.push(match)
			
			// Remove from waiting
			waiting.splice(bestIdx, 1)
			this.releaseState(best)
			
			// Cancel conflicting states
			this.cancelConflictingStates(match.start, descriptor.segments[0])
		} else {
			// Pattern continues - update waiting list
			waiting.splice(bestIdx, 1)
			const nextSegment = descriptor.segments[best.segmentIndex]
			if (!this.waitingStates.has(nextSegment)) {
				this.waitingStates.set(nextSegment, [])
			}
			this.waitingStates.get(nextSegment)!.push(best)
		}
	}

	/**
	 * INLINE priority calculation - no function calls
	 * Higher = better priority
	 * 
	 * Phase 2 optimization: Added segment length for symmetric pattern handling
	 */
	private calculatePriority(state: ActiveState): number {
		const descriptor = this.registry.descriptors[state.descriptorIndex]
		const isCompleting = state.segmentIndex === descriptor.segments.length - 1
		const firstSegLength = descriptor.segments[0].length  // ** = 2, * = 1
		
		return (
			(isCompleting ? 10000000 : 0) +       // Completing patterns first
			(firstSegLength * 100000) +           // Longer first segments (** > *)
			(state.startPos * 1000) +             // Later starts (LIFO)
			(state.segmentIndex * 100) +          // More progress
			(descriptor.segments.length * 10)     // Longer patterns
		)
	}

	/**
	 * Try to start new pattern states
	 */
	private tryStartNewStates(segment: SegmentMatch): void {
		const descriptors = this.registry.getDescriptorsStartingWithSegment(segment.index)
		
		for (const descriptor of descriptors) {
			const descriptorIndex = this.registry.descriptors.indexOf(descriptor)
			
			// Single segment pattern - complete immediately
			if (descriptor.segments.length === 1) {
				const match = this.acquireMatch()
				match.start = segment.start
				match.end = segment.end + 1
				match.descriptorIndex = descriptorIndex
				match.valueStart = segment.start
				match.valueEnd = segment.end + 1
				
				this.completedMatches.push(match)
				continue
			}
			
			// Multi-segment pattern - create state
			const state = this.acquireState()
			state.descriptorIndex = descriptorIndex
			state.segmentIndex = 1  // Next segment to look for
			state.startPos = segment.start
			state.lastPos = segment.end + 1
			state.valueStart = -1
			state.valueEnd = -1
			state.nestedStart = -1
			state.nestedEnd = -1
			state.metaStart = -1
			state.metaEnd = -1
			
			// Add to waiting list for next segment
			const nextSegment = descriptor.segments[1]
			if (!this.waitingStates.has(nextSegment)) {
				this.waitingStates.set(nextSegment, [])
			}
			this.waitingStates.get(nextSegment)!.push(state)
		}
	}

	/**
	 * Cancel states that conflict with completed match
	 * 
	 * Phase 2 optimization: Handle prefix cancellation for symmetric patterns
	 * Example: ** should cancel * when they start at same position
	 */
	private cancelConflictingStates(startPos: number, firstSegment: string): void {
		for (const [segment, states] of this.waitingStates) {
			for (let i = states.length - 1; i >= 0; i--) {
				const state = states[i]
				
				if (state.startPos !== startPos) continue
				
				const stateDescriptor = this.registry.descriptors[state.descriptorIndex]
				const stateFirstSeg = stateDescriptor.segments[0]
				
				// Cancel if:
				// 1. Exact same first segment
				// 2. Completed segment starts with state's segment (** cancels *)
				const shouldCancel = (
					stateFirstSeg === firstSegment ||
					(firstSegment.startsWith(stateFirstSeg) && firstSegment.length > stateFirstSeg.length)
				)
				
				if (shouldCancel) {
					const cancelled = states.splice(i, 1)[0]
					this.releaseState(cancelled)
				}
			}
		}
	}
	
	/**
	 * Filter overlapping and partial matches
	 * 
	 * Strategy: Filter only TRUE conflicts, preserve valid nesting
	 * 
	 * A conflict is when two matches:
	 * 1. Start at the same position (only one can win)
	 * 2. One is completely inside another (shorter match filtered)
	 * 3. Partial overlap (keep earlier one)
	 * 
	 * Also filters:
	 * - Empty/minimal patterns (just segments without content)
	 * 
	 * Complexity: O(N log N) for sort + O(N²) for filtering
	 */
	private filterOverlappingMatches(): DirectMatch[] {
		if (this.completedMatches.length === 0) return []
		
		const DEBUG = false
		if (DEBUG) {
			console.log('\n=== filterOverlappingMatches ===')
			console.log('Completed matches:', this.completedMatches.map(m => 
				`[${m.start},${m.end}] desc=${m.descriptorIndex} nested=[${m.nestedStart},${m.nestedEnd}]`
			).join(' | '))
		}
		
		// Sort: start ascending, end descending (longer first), then by segment length
		this.completedMatches.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start
			if (a.end !== b.end) return b.end - a.end
			
			const aDesc = this.registry.descriptors[a.descriptorIndex]
			const bDesc = this.registry.descriptors[b.descriptorIndex]
			const aSegLen = aDesc.segments[0].length
			const bSegLen = bDesc.segments[0].length
			
			// Longer first segment first (** before *)
			if (aSegLen !== bSegLen) return bSegLen - aSegLen
			
			// More segments first
			return bDesc.segments.length - aDesc.segments.length
		})
		
		const filtered: DirectMatch[] = []
		
		for (const match of this.completedMatches) {
			let shouldFilter = false
			
			// Pre-filter: Skip TRULY empty matches (nested content has length 0)
			// But allow empty-content matches (nested length = 0 but segments exist)
			// Example: "**" can be a valid match for *__nested__* pattern
			const matchDesc = this.registry.descriptors[match.descriptorIndex]
			if (matchDesc.hasNested && match.nestedStart !== undefined && match.nestedEnd !== undefined) {
				const nestedLength = match.nestedEnd - match.nestedStart
				// Only filter if nested region has NEGATIVE length (which shouldn't happen but be safe)
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
			// Strategy: Keep both if match is inside existing's nested/value content (valid nesting)
			// Filter only if they're competing at the same level (e.g., *text* vs **text** with same boundaries)
			if (match.start >= existing.start && match.end <= existing.end) {
				// If strictly inside (not sharing boundaries), check if it's valid nesting
				if (match.start > existing.start || match.end < existing.end) {
					const matchDesc = this.registry.descriptors[match.descriptorIndex]
					const existingDesc = this.registry.descriptors[existing.descriptorIndex]
					
					if (DEBUG) {
						console.log(`\nCase 2: match [${match.start},${match.end}] inside existing [${existing.start},${existing.end}]`)
						console.log(`  Match nested: [${match.nestedStart}, ${match.nestedEnd}]`)
						console.log(`  Existing nested: [${existing.nestedStart}, ${existing.nestedEnd}]`)
						console.log(`  Existing hasNested: ${existingDesc.hasNested}`)
					}
					
					// Check if match is inside existing's nestable content
					// IMPORTANT: Only patterns with __nested__ support nesting
					// Patterns with only __value__ (no __nested__) should NOT allow nested marks
					let isInNestableContent = false
					
					if (existingDesc.hasNested && existing.nestedStart !== undefined && existing.nestedEnd !== undefined) {
						// Existing has __nested__ placeholder - check if match is within nestedStart/nestedEnd
						isInNestableContent = match.start >= existing.nestedStart && match.end <= existing.nestedEnd
						if (DEBUG) console.log(`  isInNestableContent (nested): ${isInNestableContent}`)
					} else {
						// Existing has NO __nested__ placeholder (only __value__ or __meta__)
						// No nesting is allowed - filter any nested match immediately
						if (DEBUG) console.log(`  No __nested__ in existing pattern => FILTER nested match`)
						shouldFilter = true
						break
					}
					
					// Additional check: match should not partially overlap with existing's segments
					// e.g., [1,9] in "**outer *inner* text**" starts at position 1, which is inside the "**" segment
					const overlapsWithExistingSegments = (
						(match.start >= existing.start && match.start < existing.nestedStart!) || // starts in opening segment
						(match.end > existing.nestedEnd! && match.end <= existing.end) // ends in closing segment
					)
					
					if (overlapsWithExistingSegments && existing.nestedStart !== undefined) {
						if (DEBUG) console.log(`  overlapsWithExistingSegments: true => FILTER`)
						shouldFilter = true
						break
					}
					
					if (isInNestableContent) {
						// Valid nesting - keep both
						// Example: *inner* inside **outer *inner* text**
						if (DEBUG) console.log(`  => KEEP (valid nesting)`)
						// Don't check against this 'existing' anymore, but continue with other filtered matches
						// We don't want to filter this match
					} else {
						// Not in nestable content - they're competing at same level
						// Filter if segments conflict and boundaries are very close
						let segmentsConflict = false
						
						for (const matchSeg of matchDesc.segments) {
							for (const existingSeg of existingDesc.segments) {
								if (matchSeg === existingSeg) {
									segmentsConflict = true
									break
								}
								if (matchSeg.includes(existingSeg) || existingSeg.includes(matchSeg)) {
									const matchChars = new Set(matchSeg)
									const existingChars = new Set(existingSeg)
									const hasCommon = Array.from(matchChars).some(c => existingChars.has(c))
									if (hasCommon) {
										segmentsConflict = true
										break
									}
								}
							}
							if (segmentsConflict) break
						}
						
						if (segmentsConflict) {
							const startDist = match.start - existing.start
							const endDist = existing.end - match.end
							
							if (startDist <= 2 && endDist <= 2) {
								shouldFilter = true
								break
							}
						}
					}
				} else {
					// Same boundaries - filter the shorter/weaker one (already handled by sort)
					shouldFilter = true
					break
				}
			}
				
			// Case 3: Partial overlap (neither fully contains the other)
			// Example: **bold** [0,8] and *italic* [6,14] overlap at [6,8]
			// Keep the one that started first
			const matchesOverlap = (
				match.start < existing.end && match.end > existing.start && // They overlap
				!(match.start >= existing.start && match.end <= existing.end) && // match not inside
				!(existing.start >= match.start && existing.end <= match.end)    // existing not inside
			)
			
			if (matchesOverlap) {
				if (DEBUG) console.log(`\nCase 3: Partial overlap [${match.start},${match.end}] vs [${existing.start},${existing.end}]`)
				shouldFilter = true
				break
			}
		}
		
		if (!shouldFilter) {
			filtered.push(match)
			if (DEBUG) {
				console.log(`\nADDED to filtered: [${match.start},${match.end}] desc=${match.descriptorIndex}`)
			}
		} else {
			if (DEBUG) {
				console.log(`\nFILTERED OUT: [${match.start},${match.end}] desc=${match.descriptorIndex}`)
			}
		}
	}
	
	if (DEBUG) {
		console.log('\n=== Final filtered matches ===')
		console.log(filtered.map(m => `[${m.start},${m.end}] desc=${m.descriptorIndex}`).join(' | '))
	}
		
		return filtered
	}

	/**
	 * Convert direct matches to MatchResult format for tree builder
	 */
	private convertToMatchResults(input: string, matches: DirectMatch[]): MatchResult[] {
		const results: MatchResult[] = []
		
		for (const match of matches) {
			const descriptor = this.registry.descriptors[match.descriptorIndex]
			
			// Extract content inline
			const value = match.valueStart !== -1 && match.valueEnd !== -1
				? input.substring(match.valueStart, match.valueEnd)
				: ''
			
			const nested = match.nestedStart !== undefined && match.nestedEnd !== undefined
				? input.substring(match.nestedStart, match.nestedEnd)
				: undefined
			
			const meta = match.metaStart !== undefined && match.metaEnd !== undefined
				? input.substring(match.metaStart, match.metaEnd)
				: undefined
			
			results.push({
				start: match.start,
				end: match.end,
				content: input.substring(match.start, match.end),
				value,
				valueStart: match.valueStart !== -1 ? match.valueStart : match.start,
				valueEnd: match.valueEnd !== -1 ? match.valueEnd : match.start,
				nested,
				nestedStart: match.nestedStart,
				nestedEnd: match.nestedEnd,
				meta,
				metaStart: match.metaStart,
				metaEnd: match.metaEnd,
				descriptorIndex: match.descriptorIndex,
			})
		}
		
		// Sort for tree builder
		results.sort((a, b) => a.start - b.start || a.end - b.end)
		
		return results
	}

	/**
	 * Object pool management - actual reuse
	 */
	private acquireState(): ActiveState {
		return this.statePool.pop() || {
			descriptorIndex: 0,
			segmentIndex: 0,
			startPos: 0,
			lastPos: 0,
			valueStart: -1,
			valueEnd: -1,
			nestedStart: -1,
			nestedEnd: -1,
			metaStart: -1,
			metaEnd: -1,
		}
	}

	private releaseState(state: ActiveState): void {
		// Reset for reuse
		state.segmentIndex = 0
		this.statePool.push(state)
	}

	private acquireMatch(): DirectMatch {
		return this.matchPool.pop() || {
			start: 0,
			end: 0,
			descriptorIndex: 0,
			valueStart: 0,
			valueEnd: 0,
		}
	}
}

