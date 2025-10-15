import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternChainManager, PatternChain} from '../utils/PatternChainManager'
import {PatternBuilder, PatternMatch} from '../utils/PatternBuilder'
import {UniqueMatch} from '../types'

/**
 * Pattern processor responsible for managing pattern matching chains
 * Handles the core logic of extending and starting pattern chains
 */
export class PatternProcessor {
	private readonly descriptors: MarkupDescriptor[]
	private readonly patternBuilder: PatternBuilder
	private readonly chainManager: PatternChainManager

	constructor(descriptors: MarkupDescriptor[]) {
		this.descriptors = descriptors
		this.patternBuilder = new PatternBuilder(descriptors)
		this.chainManager = new PatternChainManager()
	}

	/**
	 * Processes all unique segment matches and returns completed pattern matches
	 * 
	 * Strategy: Create ALL possible matches on first pass (even invalid ones),
	 * then filter out matches based on gap types:
	 * - Matches inside __meta__ gaps are removed (meta data is plain text)
	 * - Matches inside __value__ gaps are removed (values don't support nesting)
	 * - Matches inside __nested__ gaps are kept (nested patterns allowed)
	 * This ensures we don't miss valid matches due to premature blocking.
	 */
	processMatches(uniqueMatches: UniqueMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const nestingStack: PatternChain[] = [] // Stack of active chains for tracking nesting
		const consumedPositions = new Set<number>() // Track positions consumed by pattern segments
		const consumedStartPositions = new Map<number, number>() // Track prefix conflicts: position -> segment length

		// Process each unique segment occurrence
		// NOTE: We removed activePatterns check to allow creating ALL possible matches
		for (const match of uniqueMatches) {
			this.processWaitingChains(match, results, nestingStack, consumedPositions, uniqueMatches)
			this.startNewChains(match, results, nestingStack, consumedPositions, consumedStartPositions)
		}

		// Filter stage 1: remove matches that start inside __value__ or __label__ gaps
		let filtered = this.filterMatchesInsideNonNestedGaps(results)

		// Filter stage 2: remove incomplete/overlapping matches of the same descriptor
		filtered = this.filterOverlappingMatches(filtered)

		return filtered
	}

	/**
	 * Filters out matches that start inside __meta__ or __value__ gaps of other matches.
	 * Only __nested__ gaps allow nested patterns.
	 */
	private filterMatchesInsideNonNestedGaps(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const matchStart = match.parts[0].start
			
			// Check if this match starts inside a non-nested gap (__meta__ or __value__) of any other match
			for (const other of matches) {
				if (other === match) continue
				
				// Check all gaps in the other match
				for (const part of other.parts) {
					if (part.type === 'gap' && part.start !== undefined && part.end !== undefined) {
						// Only filter if the gap is NOT a nested gap
						if (part.gapType === 'meta' || part.gapType === 'value') {
							if (matchStart >= part.start && matchStart <= part.end) {
								return false // This match starts inside a non-nested gap
							}
						}
						// If gapType is 'nested', allow the match (nesting is permitted)
					}
				}
			}
			
			return true
		})
	}

	/**
	 * Filters out incomplete/overlapping matches of the same descriptor.
	 * This handles cases like <__value__>__meta__</__value__> where multiple chains
	 * might be created for the same descriptor at overlapping positions.
	 * 
	 * Strategy: Keep the most complete match when there are CONFLICTING matches
	 * of the same descriptor that start at the same position.
	 * 
	 * IMPORTANT: This does NOT filter nested matches (matches inside __nested__ sections).
	 * Only filters matches that share the same starting position and are of the same descriptor.
	 */
	private filterOverlappingMatches(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const matchStart = match.parts[0].start
			const matchEnd = match.parts[match.parts.length - 1].end
			const matchDescriptor = this.descriptors[match.descriptorIndex]
			const matchSegmentCount = match.parts.filter(p => p.type === 'segment').length
			
			// Check if there's a more complete match of the same descriptor starting at the SAME position
			for (const other of matches) {
				if (other === match) continue
				if (match.descriptorIndex !== other.descriptorIndex) continue // Only compare same descriptors
				
				const otherStart = other.parts[0].start
				const otherEnd = other.parts[other.parts.length - 1].end
				const otherSegmentCount = other.parts.filter(p => p.type === 'segment').length
				
				// ONLY consider matches that start at the SAME position (not nested, but conflicting)
				if (matchStart !== otherStart) continue
				
				// If other match has more segments (is more complete), remove this one
				if (otherSegmentCount > matchSegmentCount) {
					return false
				}
				
				// If they have same segment count but other is longer (more complete), remove this one
				if (otherSegmentCount === matchSegmentCount && (otherEnd - otherStart) > (matchEnd - matchStart)) {
					return false
				}
				
				// If they have same segment count and same length but different end positions,
				// keep the one that ends later (more inclusive)
				if (otherSegmentCount === matchSegmentCount && 
					(otherEnd - otherStart) === (matchEnd - matchStart) && 
					otherEnd > matchEnd) {
					return false
				}
			}
			
			return true
		})
	}

	/**
	 * Processes chains waiting for current segment match
	 * Priority logic with lookahead:
	 * 1. Chains without nested patterns in __nested__ gaps (ready to close immediately)
	 * 2. Use lookahead to decide between completing and extending
	 * 3. Later start = inner = higher priority (LIFO)
	 */
	private processWaitingChains(match: UniqueMatch, results: PatternMatch[], nestingStack: PatternChain[], consumedPositions: Set<number>, allMatches: UniqueMatch[]): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Find next match after current position for lookahead
		const currentIndex = allMatches.indexOf(match)
		const nextMatch = currentIndex >= 0 && currentIndex < allMatches.length - 1 ? allMatches[currentIndex + 1] : null

		// Sort waiting chains by priority - prioritize completing chains first
		const sortedWaiting = [...waiting].sort((a, b) => {
			const aDescriptor = this.descriptors[a.descriptorIndex]
			const bDescriptor = this.descriptors[b.descriptorIndex]

			// Check if chains would be complete after this segment
			const aWouldComplete = a.nextSegmentIndex === aDescriptor.segments.length - 1
			const bWouldComplete = b.nextSegmentIndex === bDescriptor.segments.length - 1

			// Prioritize completing chains over extending ones
			if (aWouldComplete && !bWouldComplete) return -1
			if (!aWouldComplete && bWouldComplete) return 1

			// Both complete or both extend: check if they started at the same position
			const aStart = a.parts[0].start
			const bStart = b.parts[0].start
			
			// If chains started at the SAME position (potential conflict), prioritize by progress
			// More collected segments = more specific pattern = higher priority
			if (aStart === bStart) {
				const aProgress = a.nextSegmentIndex // How many segments already collected
				const bProgress = b.nextSegmentIndex
				if (aProgress !== bProgress) {
					return bProgress - aProgress // More progress first
				}
				
				// Same progress: prioritize longer patterns (more total segments = more specific)
				return bDescriptor.segments.length - aDescriptor.segments.length
			}

			// Different start positions: later start = inner = higher priority (LIFO)
			return bStart - aStart
		})

		// Try to match with the first valid chain
		for (const chain of sortedWaiting) {
			// Check if chain expects exactly this segment
			const descriptor = this.descriptors[chain.descriptorIndex]
			const expectedSegment = descriptor.segments[chain.nextSegmentIndex]
			
			// If current match doesn't exactly match expected segment, skip this chain
			if (expectedSegment !== match.value) {
				continue // Chain expects a different segment
			}

			// For patterns with __value__ gaps, segments can be far apart
			// So we only check that segment doesn't appear BEFORE expected position
			if (match.start < chain.pos - 1) {
				continue // Segment appears significantly before chain expects it
			}

			const {completed, extended} = this.patternBuilder.tryExtendChain(chain, match, false)
		
			if (completed) {
				results.push(completed)

				// Mark ALL positions in the completed pattern as consumed (including gaps)
				const completeStart = completed.parts[0].start
				const completeEnd = completed.parts[completed.parts.length - 1].end
				for (let i = completeStart; i <= completeEnd; i++) {
					consumedPositions.add(i)
				}
				
				// Remove from nesting stack
				const stackIndex = nestingStack.indexOf(chain)
				if (stackIndex !== -1) {
					nestingStack.splice(stackIndex, 1)
				}
				
				// Cancel any other chains that start at the same position and are waiting for segments
				// within the completed pattern's range
				// This handles cases like @[simple] completing while @[simple](value) is still waiting
				const chainsToCancel: PatternChain[] = []
				for (const otherChain of nestingStack) {
					const otherStart = otherChain.parts[0].start
					// Only cancel chains that start at exactly the same position
					if (otherStart === completeStart) {
						const otherDescriptor = this.descriptors[otherChain.descriptorIndex]
						const completedDescriptor = this.descriptors[chain.descriptorIndex]
						// Check if they share the same first segment (trigger)
						if (otherDescriptor.segments[0] === completedDescriptor.segments[0]) {
							// Check if other chain is waiting for a segment that would be inside completed pattern
							// otherChain.pos is where it expects the next segment to start
							if (otherChain.pos <= completeEnd) {
								chainsToCancel.push(otherChain)
							}
						}
					}
				}
				for (const cancelChain of chainsToCancel) {
					const cancelIndex = nestingStack.indexOf(cancelChain)
					if (cancelIndex !== -1) {
						nestingStack.splice(cancelIndex, 1)
					}
					this.chainManager.removeChainFromAll(cancelChain)
				}
			} else if (extended) {
				// Chain was extended but not completed - add back to waiting
				const nextSegmentValue = this.descriptors[extended.descriptorIndex].segments[extended.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, extended)
				
				// DO NOT mark positions as consumed when extending a chain
				// Only mark them when the chain completes
				
				// Update in nesting stack
				const stackIndex = nestingStack.indexOf(chain)
				if (stackIndex !== -1) {
					nestingStack[stackIndex] = extended
				}
			}

			this.chainManager.removeFromWaiting(match.value, chain)
			break // One segment occurrence can only complete one chain
		}
	}

	/**
	 * Starts new chains for patterns that begin with current segment
	 * Context-aware: tracks nesting level and marks parent chains as having nested content
	 * Prioritizes more specific patterns (longer triggers, more complex patterns) to prevent conflicts
	 * 
	 * NOTE: activePatterns check removed to allow ALL possible matches to be created.
	 * Invalid matches will be filtered later.
	 */
	private startNewChains(match: UniqueMatch, results: PatternMatch[], nestingStack: PatternChain[], consumedPositions: Set<number>, consumedStartPositions: Map<number, number>): void {
		// Sort descriptors by pattern priority (shorter patterns first, but avoid conflicts)
		const sortedDescriptors = match.descriptors
			.filter(descInfo => descInfo.segmentIndex === 0)
			.sort((a, b) => {
				const descA = this.descriptors[a.descriptorIndex]
				const descB = this.descriptors[b.descriptorIndex]

				// Special case: prefer longer first segments to avoid conflicts like * vs ** or # vs ##
				const firstSegmentLenA = descA.segments[0].length
				const firstSegmentLenB = descB.segments[0].length
				if (firstSegmentLenA !== firstSegmentLenB) {
					return firstSegmentLenB - firstSegmentLenA // longer first segments first
				}

			// General case: longer patterns first (more segments = more specific = higher priority)
			// This ensures that patterns like <__label__ __value__>__nested__</__label__> (5 segments)
			// are tried before <__label__>__nested__</__label__> (4 segments)
			const segmentsA = descA.segments.length
			const segmentsB = descB.segments.length
			return segmentsB - segmentsA // more segments first
			})
		
		for (const descInfo of sortedDescriptors) {
			const descriptor = this.descriptors[descInfo.descriptorIndex]

			// Skip if any position in this segment is already consumed by a COMPLETED pattern
			let isPositionConsumed = false
			for (let i = match.start; i <= match.end; i++) {
				if (consumedPositions.has(i)) {
					isPositionConsumed = true
					break
				}
			}
			if (isPositionConsumed) {
				continue
			}

			// Check for prefix conflicts: if a longer pattern already started and overlaps with this position
			// For example, if "##" started at position 201-202, don't start "#" at position 202
			let hasOverlappingLongerPattern = false
			for (let i = match.start; i <= match.end; i++) {
				const existingSegmentLength = consumedStartPositions.get(i)
				if (existingSegmentLength !== undefined && existingSegmentLength > descriptor.segments[0].length) {
					hasOverlappingLongerPattern = true
					break
				}
			}
			if (hasOverlappingLongerPattern) {
				continue // Skip shorter pattern - longer one already claimed overlapping position
			}
			
			// Determine nesting level based on current stack
			const nestingLevel = nestingStack.length
			
			const {completed, chain} = this.patternBuilder.createNewChain(descInfo.descriptorIndex, match, nestingLevel)

			if (completed) {
				// Single-segment pattern was completed immediately
				results.push(completed)
				
				// Mark ALL positions in the completed pattern as consumed (including gaps)
				const completeStart = completed.parts[0].start
				const completeEnd = completed.parts[completed.parts.length - 1].end
				for (let i = completeStart; i <= completeEnd; i++) {
					consumedPositions.add(i)
				}
				
				consumedStartPositions.set(match.start, descriptor.segments[0].length)
			} else if (chain) {
				// Mark all parent chains as having nested patterns
				for (const parentChain of nestingStack) {
					if (match.start >= parentChain.pos) {
						parentChain.hasNestedPatterns = true
					}
				}
				
				// DO NOT mark positions as consumed when starting a chain
				// Only mark them when the chain completes
				// This allows nested patterns like **bold** to work correctly
				
				// Chain was created and needs to wait for next segment
				const nextSegmentValue = this.descriptors[descInfo.descriptorIndex].segments[chain.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, chain)
				nestingStack.push(chain)
				// Mark all positions in the starting segment to prevent overlapping prefix patterns
				for (let i = match.start; i <= match.end; i++) {
					consumedStartPositions.set(i, descriptor.segments[0].length)
				}
			}
		}
	}
}

