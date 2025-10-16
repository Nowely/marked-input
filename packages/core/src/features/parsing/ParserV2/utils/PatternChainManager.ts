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
 */
export class PatternChainManager {
	private activeChains = new Map<string, PatternChain[]>()

	/**
	 * Adds a chain to waiting list for specific segment value
	 */
	addToWaiting(segmentValue: string, chain: PatternChain): void {
		if (!this.activeChains.has(segmentValue)) {
			this.activeChains.set(segmentValue, [])
		}
		this.activeChains.get(segmentValue)!.push(chain)
	}

	/**
	 * Gets chains waiting for specific segment value
	 */
	getWaiting(segmentValue: string): PatternChain[] {
		return this.activeChains.get(segmentValue) || []
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
		}
	}

	/**
	 * Clears all active chains
	 */
	clear(): void {
		this.activeChains.clear()
	}
}
