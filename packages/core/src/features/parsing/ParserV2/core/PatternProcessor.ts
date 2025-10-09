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
	 * then filter out matches that start inside __value__ of other matches.
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

		// Filter: remove matches that start inside __value__ of other matches
		return this.filterMatchesInsideValue(results)
	}

	/**
	 * Filters out matches that start inside __value__ of other matches
	 */
	private filterMatchesInsideValue(matches: PatternMatch[]): PatternMatch[] {
		return matches.filter(match => {
			const matchStart = match.parts[0].start
			
			// Check if this match starts inside __value__ of any other match
			for (const other of matches) {
				if (other === match) continue
				
				const valueGap = other.parts.find(p => p.type === 'gap' && p.gapType === 'value')
				if (valueGap && valueGap.start !== undefined && valueGap.end !== undefined) {
					if (matchStart >= valueGap.start && matchStart <= valueGap.end) {
						return false // This match starts inside another's __value__
					}
				}
			}
			
			return true
		})
	}

	/**
	 * Processes chains waiting for current segment match
	 * Priority logic with lookahead:
	 * 1. Chains without nested patterns (ready to close immediately)
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

		// Sort waiting chains by priority
		const sortedWaiting = [...waiting].sort((a, b) => {
			const aHasNested = a.hasNestedPatterns
			const bHasNested = b.hasNestedPatterns
			
			// Prioritize chains without nested patterns (they should close first)
			if (!aHasNested && bHasNested) return -1
			if (aHasNested && !bHasNested) return 1
			
			const aDescriptor = this.descriptors[a.descriptorIndex]
			const bDescriptor = this.descriptors[b.descriptorIndex]
			
			// Check if chains would be complete after this segment
			const aWouldComplete = a.nextSegmentIndex === aDescriptor.segments.length - 1
			const bWouldComplete = b.nextSegmentIndex === bDescriptor.segments.length - 1
			
			// Use lookahead to decide priority
			// If a chain can be extended and the next segment is available, prioritize it
			if (!aWouldComplete && bWouldComplete) {
				const nextSegment = aDescriptor.segments[a.nextSegmentIndex + 1]
				if (nextMatch && nextMatch.value === nextSegment && nextMatch.start === match.end + 1) {
					return -1 // Prioritize extendable chain if next segment is immediately available
				}
				return 1 // Otherwise, prioritize completing chain
			}
			if (aWouldComplete && !bWouldComplete) {
				const nextSegment = bDescriptor.segments[b.nextSegmentIndex + 1]
				if (nextMatch && nextMatch.value === nextSegment && nextMatch.start === match.end + 1) {
					return 1 // Prioritize extendable chain if next segment is immediately available
				}
				return -1 // Otherwise, prioritize completing chain
			}
			
			// Same completion status: later start = higher priority (LIFO)
			return b.parts[0].start - a.parts[0].start
		})

		// Try to match with the first valid chain
		for (const chain of sortedWaiting) {
			if (match.start < chain.pos) {
				continue // Segment appears before chain expects it
			}

			// Check if chain expects exactly this segment
			const descriptor = this.descriptors[chain.descriptorIndex]
			const expectedSegment = descriptor.segments[chain.nextSegmentIndex]
			
			// If current match doesn't exactly match expected segment, skip this chain
			if (expectedSegment !== match.value) {
				continue // Chain expects a different segment
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

				// General case: shorter patterns first (fewer segments = higher priority)
				const segmentsA = descA.segments.length
				const segmentsB = descB.segments.length
				return segmentsA - segmentsB // fewer segments first
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

