/**
 * Part of a matched pattern - either a static segment or a gap
 */
export interface PatternPart {
	type: 'segment' | 'gap'
	start: number
	end: number
	value?: string // Lazy - only materialized when needed
	gapType?: 'value' | 'meta' | 'nested' // For gaps only
}

/**
 * Active chain tracking partial pattern matches
 */
export interface PatternChain {
	descriptorIndex: number
	nextSegmentIndex: number
	pos: number // Next expected position in text
	parts: PatternPart[]
	hasNestedPatterns: boolean // True if any nested pattern has started inside this chain
	nestingLevel: number // Depth of nesting (0 = root level)
}

/**
 * Pattern chain manager for tracking active pattern chains
 * Optimization: Maintains sorted lists to avoid repeated sorting
 */
export class PatternChainManager {
	private activeChains = new Map<string, PatternChain[]>()
	// Track if lists need sorting (set to true when chains are added/updated)
	private needsSorting = new Map<string, boolean>()

	/**
	 * Adds a chain to waiting list for specific segment value
	 * Optimization: Marks list as needing sort instead of sorting immediately
	 */
	addToWaiting(segmentValue: string, chain: PatternChain): void {
		if (!this.activeChains.has(segmentValue)) {
			this.activeChains.set(segmentValue, [])
		}
		this.activeChains.get(segmentValue)!.push(chain)
		// Mark that this list needs sorting
		this.needsSorting.set(segmentValue, true)
	}

	/**
	 * Gets chains waiting for specific segment value
	 * Returns empty array (not null) to avoid null checks
	 */
	getWaiting(segmentValue: string): PatternChain[] {
		return this.activeChains.get(segmentValue) || []
	}

	/**
	 * Checks if a segment has waiting chains that need sorting
	 */
	needsSortingFor(segmentValue: string): boolean {
		return this.needsSorting.get(segmentValue) || false
	}

	/**
	 * Marks a segment's waiting list as sorted
	 */
	markAsSorted(segmentValue: string): void {
		this.needsSorting.set(segmentValue, false)
	}

	/**
	 * Updates waiting list with sorted chains
	 * Used after in-place sorting in ChainMatcher
	 */
	updateWaiting(segmentValue: string, sortedChains: PatternChain[]): void {
		this.activeChains.set(segmentValue, sortedChains)
		this.needsSorting.set(segmentValue, false)
	}

	/**
	 * Removes a specific chain from waiting list
	 */
	removeFromWaiting(segmentValue: string, chain: PatternChain): void {
		const waiting = this.activeChains.get(segmentValue)
		if (waiting) {
			const index = waiting.indexOf(chain)
			if (index !== -1) {
				waiting.splice(index, 1)
			}
			// List remains sorted after removal
		}
	}

	/**
	 * Removes a chain from all waiting lists
	 */
	removeChainFromAll(chain: PatternChain): void {
		for (const [, chains] of this.activeChains) {
			const index = chains.indexOf(chain)
			if (index !== -1) {
				chains.splice(index, 1)
			}
			// Lists remain sorted after removal
		}
	}

	/**
	 * Gets all active chains across all waiting lists
	 * Used for cancellation logic when a pattern completes
	 */
	getAllChains(): PatternChain[] {
		const allChains: PatternChain[] = []
		for (const [, chains] of this.activeChains) {
			allChains.push(...chains)
		}
		return allChains
	}

	/**
	 * Clears all active chains
	 */
	clear(): void {
		this.activeChains.clear()
		this.needsSorting.clear()
	}
}
