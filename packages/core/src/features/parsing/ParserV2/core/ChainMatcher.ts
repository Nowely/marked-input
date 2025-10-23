import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternChainManager, PatternChain} from '../utils/PatternChainManager'
import {PatternBuilder, PatternMatch} from '../utils/PatternBuilder'
import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupRegistry} from '../utils/MarkupRegistry'
import {IntervalSet} from '../utils/IntervalSet'

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
	 * 
	 * OPTIMIZATION: Use IntervalSet instead of Set<number> for O(log N) overlap checks
	 */
	buildChains(segmentMatches: SegmentMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const nestingStack: PatternChain[] = [] // Stack of active chains for tracking nesting
		const consumedRanges = new IntervalSet() // Track ranges consumed by completed patterns
		const consumedStartPositions = new Map<number, number>() // Track prefix conflicts: position -> segment length

		// Process each segment occurrence
		for (const match of segmentMatches) {
			this.processWaitingChains(match, results, nestingStack, consumedRanges, segmentMatches)
			this.startNewChains(match, results, nestingStack, consumedRanges, consumedStartPositions)
		}

		return results
	}

	/**
	 * Compares two chains for priority sorting
	 * Extracted from PatternSorting.sortWaitingChains for in-place sorting
	 * Returns: negative if a has higher priority, positive if b has higher priority
	 */
	private compareChainPriority(
		a: PatternChain,
		b: PatternChain,
		nextMatch: {value: string; start: number}
	): number {
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
		if (aStart === bStart) {
			const aProgress = a.nextSegmentIndex
			const bProgress = b.nextSegmentIndex
			if (aProgress !== bProgress) {
				return bProgress - aProgress // More progress first
			}

			// Same progress: prioritize longer patterns
			return bDescriptor.segments.length - aDescriptor.segments.length
		}

		// Different start positions: later start = inner = higher priority (LIFO)
		return bStart - aStart
	}

	/**
	 * Processes chains waiting for current segment match
	 * Priority logic with lookahead:
	 * 1. Chains without nested patterns in __nested__ gaps (ready to close immediately)
	 * 2. Use lookahead to decide between completing and extending
	 * 3. Later start = inner = higher priority (LIFO)
	 * 
	 * OPTIMIZATION: Sort only once per segment, reuse sorted list + use IntervalSet
	 */
	private processWaitingChains(
		match: SegmentMatch,
		results: PatternMatch[],
		nestingStack: PatternChain[],
		consumedRanges: IntervalSet,
		allMatches: SegmentMatch[]
	): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Sort waiting chains by priority only if needed (lazy sorting)
		// Once sorted, list stays sorted until new chains are added
		let sortedWaiting: PatternChain[]
		if (this.chainManager.needsSortingFor(match.value)) {
			// In-place sort to avoid array copy
			waiting.sort((a, b) => this.compareChainPriority(a, b, match))
			this.chainManager.markAsSorted(match.value)
			sortedWaiting = waiting
		} else {
			// Already sorted, use as-is
			sortedWaiting = waiting
		}

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

				// Mark entire range of completed pattern as consumed
				const completeStart = completed.parts[0].start
				const completeEnd = completed.parts[completed.parts.length - 1].end
				consumedRanges.addRange(completeStart, completeEnd)
				
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
	 * 
	 * OPTIMIZATION: Descriptors are pre-sorted, use IntervalSet for range checks
	 */
	private startNewChains(
		match: SegmentMatch,
		results: PatternMatch[],
		nestingStack: PatternChain[],
		consumedRanges: IntervalSet,
		consumedStartPositions: Map<number, number>
	): void {
		// Get pre-sorted descriptors where this segment is the first segment
		const descriptors = this.registry.getDescriptorsStartingWithSegment(match.index)

		// Descriptors are already sorted by priority in MarkupRegistry
		for (const descriptor of descriptors) {

			// Skip if this segment range overlaps with any consumed range (O(log N) instead of O(M))
			if (consumedRanges.overlaps(match.start, match.end)) {
				continue
			}

			// Check for prefix conflicts: if a longer pattern already started and overlaps
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
			const descriptorIndex = this.descriptors.indexOf(descriptor)
			const nestingLevel = nestingStack.length

			const {completed, chain} = this.patternBuilder.createNewChain(descriptorIndex, match, nestingLevel)

			if (completed) {
				// Single-segment pattern was completed immediately
				results.push(completed)
				
				// Mark entire range of completed pattern as consumed
				const completeStart = completed.parts[0].start
				const completeEnd = completed.parts[completed.parts.length - 1].end
				consumedRanges.addRange(completeStart, completeEnd)
				
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
			const nextSegmentValue = descriptor.segments[chain.nextSegmentIndex]
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

