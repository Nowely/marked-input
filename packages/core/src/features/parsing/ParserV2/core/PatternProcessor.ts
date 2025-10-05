import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternChainManager} from '../utils/PatternChainManager'
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
	 */
	processMatches(uniqueMatches: UniqueMatch[]): PatternMatch[] {
		const results: PatternMatch[] = []
		const activePatterns = new Set<number>() // descriptorIndex

		// Process each unique segment occurrence
		for (const match of uniqueMatches) {
			this.processWaitingChains(match, results, activePatterns)
			this.startNewChains(match, results, activePatterns)
		}

		return results
	}

	/**
	 * Processes chains waiting for current segment match
	 */
	private processWaitingChains(match: UniqueMatch, results: PatternMatch[], activePatterns: Set<number>): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Sort waiting chains: later start = inner = higher priority (LIFO)
		const sortedWaiting = [...waiting].sort((a, b) => b.parts[0].start - a.parts[0].start)

		// Try to match with the first valid chain
		for (const chain of sortedWaiting) {
			if (match.start < chain.pos) {
				continue // Segment appears before chain expects it
			}

			const {completed, extended} = this.patternBuilder.tryExtendChain(chain, match)

			if (completed) {
				results.push(completed)
				activePatterns.delete(chain.descriptorIndex)
			} else if (extended) {
				// Chain was extended but not completed - add back to waiting
				const nextSegmentValue = this.descriptors[extended.descriptorIndex].segments[extended.nextSegmentIndex]
				this.chainManager.addToWaiting(nextSegmentValue, extended)
			}

			this.chainManager.removeFromWaiting(match.value, chain)
			break // One segment occurrence can only complete one chain
		}
	}

	/**
	 * Starts new chains for patterns that begin with current segment
	 */
	private startNewChains(match: UniqueMatch, results: PatternMatch[], activePatterns: Set<number>): void {
		for (const descInfo of match.descriptors) {
			if (descInfo.segmentIndex === 0 && !activePatterns.has(descInfo.descriptorIndex)) {
				const {completed, chain} = this.patternBuilder.createNewChain(descInfo.descriptorIndex, match)

				if (completed) {
					// Single-segment pattern was completed immediately
					results.push(completed)
				} else if (chain) {
					// Chain was created and needs to wait for next segment
					const nextSegmentValue = this.descriptors[descInfo.descriptorIndex].segments[chain.nextSegmentIndex]
					this.chainManager.addToWaiting(nextSegmentValue, chain)
					activePatterns.add(descInfo.descriptorIndex)
				}
			}
		}
	}
}

