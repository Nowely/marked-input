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
	 * Uses pattern exclusivity: a pattern cannot start a new match while already active
	 * Implements context-aware matching: tracks nesting and adjusts matching behavior
	 */
	processMatches(uniqueMatches: UniqueMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const activePatterns = new Set<number>() // descriptorIndex
		const nestingStack: PatternChain[] = [] // Stack of active chains for tracking nesting

		// Process each unique segment occurrence
		for (const match of uniqueMatches) {
			this.processWaitingChains(match, results, activePatterns, nestingStack)
			this.startNewChains(match, results, activePatterns, nestingStack)
		}

		return results
	}

	/**
	 * Processes chains waiting for current segment match
	 * Simplified logic: prioritize chains without nested patterns, then by LIFO order
	 */
	private processWaitingChains(match: UniqueMatch, results: PatternMatch[], activePatterns: Set<number>, nestingStack: PatternChain[]): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Sort waiting chains by priority:
		// 1. Chains without nested patterns (ready to close immediately)
		// 2. Later start = inner = higher priority (LIFO)
		const sortedWaiting = [...waiting].sort((a, b) => {
			const aHasNested = a.hasNestedPatterns
			const bHasNested = b.hasNestedPatterns
			
			// Prioritize chains without nested patterns
			if (!aHasNested && bHasNested) return -1
			if (aHasNested && !bHasNested) return 1
			
			// Same nesting status: later start = higher priority
			return b.parts[0].start - a.parts[0].start
		})

		// Try to match with the first valid chain
		for (const chain of sortedWaiting) {
			if (match.start < chain.pos) {
				continue // Segment appears before chain expects it
			}

			const {completed, extended} = this.patternBuilder.tryExtendChain(chain, match, false)

			if (completed) {
				results.push(completed)
				activePatterns.delete(chain.descriptorIndex)
				
				// Remove from nesting stack
				const stackIndex = nestingStack.indexOf(chain)
				if (stackIndex !== -1) {
					nestingStack.splice(stackIndex, 1)
				}
			} else if (extended) {
				// Chain was extended but not completed - add back to waiting
				const nextSegmentValue = this.descriptors[extended.descriptorIndex].segments[extended.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, extended)
				
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
	 * Prioritizes shorter patterns (fewer segments) to avoid greedy matching
	 */
	private startNewChains(match: UniqueMatch, results: PatternMatch[], activePatterns: Set<number>, nestingStack: PatternChain[]): void {
		// Sort descriptors by pattern length (fewer segments = higher priority)
		const sortedDescriptors = match.descriptors
			.filter(descInfo => descInfo.segmentIndex === 0 && !activePatterns.has(descInfo.descriptorIndex))
			.sort((a, b) => {
				const lengthA = this.descriptors[a.descriptorIndex].segments.length
				const lengthB = this.descriptors[b.descriptorIndex].segments.length
				return lengthA - lengthB // shorter patterns first
			})
		
		// Track which triggers have been started at this position
		const startedTriggers = new Set<string>()
		
		for (const descInfo of sortedDescriptors) {
			const descriptor = this.descriptors[descInfo.descriptorIndex]
			
			// Only start one pattern per trigger at the same position
			// This prevents conflicting patterns from competing
			if (startedTriggers.has(descriptor.trigger)) {
				continue
			}
			
			// Determine nesting level based on current stack
			const nestingLevel = nestingStack.length
			
			const {completed, chain} = this.patternBuilder.createNewChain(descInfo.descriptorIndex, match, nestingLevel)

			if (completed) {
				// Single-segment pattern was completed immediately
				results.push(completed)
				startedTriggers.add(descriptor.trigger)
			} else if (chain) {
				// Mark all parent chains as having nested patterns
				for (const parentChain of nestingStack) {
					if (match.start >= parentChain.pos) {
						parentChain.hasNestedPatterns = true
					}
				}
				
				// Chain was created and needs to wait for next segment
				const nextSegmentValue = this.descriptors[descInfo.descriptorIndex].segments[chain.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, chain)
				activePatterns.add(descInfo.descriptorIndex)
				nestingStack.push(chain)
				startedTriggers.add(descriptor.trigger)
			}
		}
	}
}

