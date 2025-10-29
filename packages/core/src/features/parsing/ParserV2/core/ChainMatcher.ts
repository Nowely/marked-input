import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternChainManager, PatternChain} from '../utils/PatternChainManager'
import {PatternBuilder, PatternMatch} from '../utils/PatternBuilder'
import {SegmentMatch} from '../utils/AhoCorasick'
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
	 *
	 * ORDER-INDEPENDENT: Processes segments in sorted order with deterministic priority rules.
	 * Tracks completed patterns to prevent creating conflicting chains.
	 */
	buildChains(segmentMatches: SegmentMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const completedRanges: Array<{start: number; end: number; firstSegment: string}> = []

		// Process each segment match
		for (const match of segmentMatches) {
			this.processWaitingChains(match, results, completedRanges)
			this.startNewChains(match, results, completedRanges)
		}

		return results
	}

	/**
	 * Processes chains waiting for current segment match
	 * ORDER-INDEPENDENT: Selects the best matching chain using deterministic priority rules.
	 * One segment can only extend ONE chain (the highest priority one).
	 */
	private processWaitingChains(
		match: SegmentMatch,
		results: PatternMatch[],
		completedRanges: Array<{start: number; end: number; firstSegment: string}>
	): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Filter chains that can actually use this segment
		const validChains = waiting.filter(chain => {
			const descriptor = this.descriptors[chain.descriptorIndex]
			const expectedSegment = descriptor.segments[chain.nextSegmentIndex]

			// Skip if segment doesn't match
			if (expectedSegment !== match.value) {
				return false
			}

			// Skip if segment appears before expected position (basic sanity check)
			if (match.start < chain.pos - 1) {
				return false
			}

			return true
		})

		if (validChains.length === 0) {
			return
		}

		// Select the best chain using deterministic priority rules
		const bestChain = this.selectBestChain(validChains, match)

		const {completed, extended} = this.patternBuilder.tryExtendChain(bestChain, match, false)

		if (completed) {
			results.push(completed)
			this.chainManager.removeFromWaiting(match.value, bestChain)

			// Track completed range to prevent creating conflicting chains
			const completeStart = completed.parts[0].start
			const completeEnd = completed.parts[completed.parts.length - 1].end
			const completedDescriptor = this.descriptors[bestChain.descriptorIndex]
			completedRanges.push({
				start: completeStart,
				end: completeEnd,
				firstSegment: completedDescriptor.segments[0],
			})

			// Cancel ALL other chains that started at the same position with the same first segment
			// This handles cases like @[simple] completing while @[simple](value) is still waiting
			// We cancel them regardless of where they're waiting, because shorter pattern has priority
			const chainsToCancel: PatternChain[] = []
			
			// Check ALL waiting chains, not just validChains
			// because other chains might be waiting for different segments
			const allChains = this.chainManager.getAllChains()
			for (const otherChain of allChains) {
				if (otherChain === bestChain) continue

				const otherStart = otherChain.parts[0].start
				// Only cancel chains that start at exactly the same position
				if (otherStart === completeStart) {
					const otherDescriptor = this.descriptors[otherChain.descriptorIndex]
					// Check if they share the same first segment (trigger)
					if (otherDescriptor.segments[0] === completedDescriptor.segments[0]) {
						chainsToCancel.push(otherChain)
					}
				}
			}

			// Remove cancelled chains from all waiting lists
			for (const cancelChain of chainsToCancel) {
				this.chainManager.removeChainFromAll(cancelChain)
			}
		} else if (extended) {
			// Chain extended - update waiting list
			const nextSegmentValue = this.descriptors[extended.descriptorIndex].segments[extended.nextSegmentIndex]
			this.chainManager.addToWaiting(nextSegmentValue, extended)
			this.chainManager.removeFromWaiting(match.value, bestChain)
		}
	}

	/**
	 * Selects the best chain from multiple candidates using deterministic priority rules
	 * Priority (highest to lowest):
	 * 1. Chains that would complete with this segment
	 * 2. Chains that started later (inner chains, LIFO)
	 * 3. Chains with more progress
	 * 4. Chains with longer patterns
	 */
	private selectBestChain(chains: PatternChain[], match: SegmentMatch): PatternChain {
		return chains.reduce((best, current) => {
			const bestDescriptor = this.descriptors[best.descriptorIndex]
			const currentDescriptor = this.descriptors[current.descriptorIndex]

			// Check if chains would be complete after this segment
			const bestWouldComplete = best.nextSegmentIndex === bestDescriptor.segments.length - 1
			const currentWouldComplete = current.nextSegmentIndex === currentDescriptor.segments.length - 1

			// 1. Prioritize completing chains
			if (currentWouldComplete && !bestWouldComplete) return current
			if (!currentWouldComplete && bestWouldComplete) return best

			// 2. Prioritize later start (inner chains, LIFO)
			const bestStart = best.parts[0].start
			const currentStart = current.parts[0].start
			if (currentStart !== bestStart) {
				return currentStart > bestStart ? current : best
			}

			// 3. Prioritize more progress
			if (current.nextSegmentIndex !== best.nextSegmentIndex) {
				return current.nextSegmentIndex > best.nextSegmentIndex ? current : best
			}

			// 4. Prioritize longer patterns
			if (currentDescriptor.segments.length !== bestDescriptor.segments.length) {
				return currentDescriptor.segments.length > bestDescriptor.segments.length ? current : best
			}

			// 5. Fallback: keep first (stable sort)
			return best
		})
	}

	/**
	 * Starts new chains for patterns that begin with current segment
	 * ORDER-INDEPENDENT: Creates pattern chains while respecting completed ranges.
	 * Prevents creating chains that would conflict with already completed patterns.
	 */
	private startNewChains(
		match: SegmentMatch,
		results: PatternMatch[],
		completedRanges: Array<{start: number; end: number; firstSegment: string}>
	): void {
		// Get descriptors where this segment is the first segment
		const descriptors = this.registry.getDescriptorsStartingWithSegment(match.index)

		// Check if this segment is inside a completed pattern with the same first segment
		const isInsideCompleted = completedRanges.some(range => {
			// Check if match overlaps with completed range
			if (match.start >= range.start && match.start <= range.end) {
				// Only block if the first segments match (same pattern family)
				return range.firstSegment === match.value
			}
			return false
		})

		if (isInsideCompleted) {
			// Don't start new chains if this segment is inside a completed pattern
			return
		}

		// Try to start ALL matching patterns
		for (const descriptor of descriptors) {
			const descriptorIndex = this.descriptors.indexOf(descriptor)

			// Create new chain (nestingLevel = 0, we don't track nesting during building)
			const {completed, chain} = this.patternBuilder.createNewChain(descriptorIndex, match, 0)

			if (completed) {
				// Single-segment pattern was completed immediately
				results.push(completed)

				// Track completed range
				completedRanges.push({
					start: completed.parts[0].start,
					end: completed.parts[completed.parts.length - 1].end,
					firstSegment: descriptor.segments[0],
				})
			} else if (chain) {
				// Chain created - add to waiting list
				const nextSegmentValue = descriptor.segments[chain.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, chain)
			}
		}
	}
}
