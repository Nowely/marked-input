import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternChainManager, PatternChain} from '../utils/PatternChainManager'
import {PatternBuilder, PatternMatch} from '../utils/PatternBuilder'
import {SegmentMatch} from '../utils/AhoCorasick'
import {PatternSorting} from '../utils/PatternSorting'
import {MarkupRegistry} from '../utils/MarkupRegistry'

/**
 * Chain matcher responsible for building pattern chains from segment matches
 * Extracted from PatternProcessor to separate concerns
 */
export class ChainMatcher {
	private readonly registry: MarkupRegistry
	private readonly descriptors: MarkupDescriptor[]
	private readonly patternBuilder: PatternBuilder
	private readonly chainManager: PatternChainManager

	constructor(registry: MarkupRegistry) {
		this.registry = registry
		this.descriptors = registry.descriptors
		this.patternBuilder = new PatternBuilder(registry.descriptors)
		this.chainManager = new PatternChainManager()
	}

	/**
	 * Builds all possible pattern chains from segment matches
	 * Strategy: Create ALL possible matches (even invalid ones),
	 * validation/filtering happens later in MatchValidator
	 */
	buildChains(segmentMatches: SegmentMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const nestingStack: PatternChain[] = [] // Stack of active chains for tracking nesting
		const consumedPositions = new Set<number>() // Track positions consumed by pattern segments
		const consumedStartPositions = new Map<number, number>() // Track prefix conflicts: position -> segment length

		// Process each segment occurrence
		for (const match of segmentMatches) {
			this.processWaitingChains(match, results, nestingStack, consumedPositions, segmentMatches)
			this.startNewChains(match, results, nestingStack, consumedPositions, consumedStartPositions)
		}

		return results
	}

	/**
	 * Processes chains waiting for current segment match
	 * Priority logic with lookahead:
	 * 1. Chains without nested patterns in __nested__ gaps (ready to close immediately)
	 * 2. Use lookahead to decide between completing and extending
	 * 3. Later start = inner = higher priority (LIFO)
	 */
	private processWaitingChains(
		match: SegmentMatch,
		results: PatternMatch[],
		nestingStack: PatternChain[],
		consumedPositions: Set<number>,
		allMatches: SegmentMatch[]
	): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Sort waiting chains by priority
		const sortedWaiting = PatternSorting.sortWaitingChains(waiting, match, this.descriptors)

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
	private startNewChains(
		match: SegmentMatch,
		results: PatternMatch[],
		nestingStack: PatternChain[],
		consumedPositions: Set<number>,
		consumedStartPositions: Map<number, number>
	): void {
		// Get descriptor indices for this segment from registry
		const descriptorIndices = this.registry.segmentToDescriptors[match.index]
		
		//TODO optimize
		// Create descInfo array with segmentIndex for each descriptor
		const descInfos = descriptorIndices.map(descriptorIndex => {
			const descriptor = this.descriptors[descriptorIndex]
			const segmentIndex = descriptor.segments.indexOf(match.value)
			return { descriptorIndex, segmentIndex }
		}).filter(descInfo => descInfo.segmentIndex === 0) // Only start chains at first segment
		
		// Sort descriptors by pattern priority
		const sortedDescriptors = PatternSorting.sortDescriptors(descInfos, this.descriptors)
		
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

