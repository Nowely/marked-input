import {AhoCorasick, SegmentMatch} from './AhoCorasick'
import {SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'

/**
 * Part of a matched pattern - either a static segment or a gap
 */
export interface MatchPart {
	type: 'segment' | 'gap'
	start: number
	end: number
	value?: string // Lazy - only materialized when needed
	gapType?: 'label' | 'value' // For gaps only
}

/**
 * Complete match of a pattern with all its parts
 */
export interface PatternMatch {
	descriptorIndex: number
	parts: MatchPart[]
}

/**
 * Active chain tracking partial pattern matches
 */
interface Chain {
	descriptorIndex: number
	nextSegmentIndex: number
	pos: number // Next expected position in text
	parts: MatchPart[]
}

/**
 * Deduplicated segment match with descriptor info
 */
interface DeduplicatedMatch {
	start: number
	end: number
	value: string
	descriptors: Array<{ descriptorIndex: number; segmentIndex: number }>
}

/**
 * Chain manager for tracking active pattern chains
 */
class ChainManager {
	private activeChains = new Map<string, Chain[]>()

	/**
	 * Adds a chain to waiting list for specific segment value
	 */
	addToWaiting(segmentValue: string, chain: Chain): void {
		if (!this.activeChains.has(segmentValue)) {
			this.activeChains.set(segmentValue, [])
		}
		this.activeChains.get(segmentValue)!.push(chain)
	}

	/**
	 * Gets chains waiting for specific segment value
	 */
	getWaiting(segmentValue: string): Chain[] {
		return this.activeChains.get(segmentValue) || []
	}

	/**
	 * Removes a specific chain from waiting list
	 */
	removeFromWaiting(segmentValue: string, chain: Chain): void {
		const waiting = this.activeChains.get(segmentValue)
		if (waiting) {
			const index = waiting.indexOf(chain)
			if (index !== -1) {
				waiting.splice(index, 1)
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

/**
 * Pattern assembler for building complete patterns from chains
 */
class PatternAssembler {
	private readonly descriptors: SegmentMarkupDescriptor[]

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.descriptors = descriptors
	}

	/**
	 * Tries to extend a chain with a new segment match
	 * Returns {completed: PatternMatch | null, extended: Chain | null}
	 */
	tryExtendChain(chain: Chain, match: DeduplicatedMatch): { completed: PatternMatch | null; extended: Chain | null } {
		const descriptor = this.descriptors[chain.descriptorIndex]

		// Check if this segment matches what this chain expects
		const expectedSegment = descriptor.segments[chain.nextSegmentIndex]
		if (expectedSegment !== match.value) {
			return { completed: null, extended: null } // This segment doesn't match what this chain expects
		}

		const newChain = this.cloneChain(chain)

		// Add gap if needed
		if (match.start > newChain.pos) {
			const gapIndex = newChain.nextSegmentIndex > 0 ? newChain.nextSegmentIndex - 1 : 0
			const gapType = descriptor.gapTypes[gapIndex]

			newChain.parts.push({
				type: 'gap',
				start: newChain.pos,
				end: match.start - 1,
				gapType
			})
		}

		// Add segment
		newChain.parts.push({
			type: 'segment',
			start: match.start,
			end: match.end,
			value: match.value
		})

		newChain.pos = match.end + 1
		newChain.nextSegmentIndex++

		// Check if pattern is complete
		if (newChain.nextSegmentIndex === descriptor.segments.length) {
			return {
				completed: {
					descriptorIndex: newChain.descriptorIndex,
					parts: newChain.parts.map(p => ({ ...p }))
				},
				extended: null
			}
		}

		return { completed: null, extended: newChain } // Chain extended but not complete
	}

	/**
	 * Creates a new chain for starting pattern
	 * Returns {completed: PatternMatch | null, chain: Chain | null}
	 */
	createNewChain(descriptorIndex: number, match: DeduplicatedMatch): { completed: PatternMatch | null; chain: Chain | null } {
		const descriptor = this.descriptors[descriptorIndex]

		// Only start chains at first segment
		if (match.descriptors.find(d => d.descriptorIndex === descriptorIndex)?.segmentIndex !== 0) {
			return { completed: null, chain: null }
		}

		const newChain: Chain = {
			descriptorIndex,
			nextSegmentIndex: 1,
			pos: match.end + 1,
			parts: [{
				type: 'segment',
				start: match.start,
				end: match.end,
				value: match.value
			}]
		}

		// Single-segment pattern is immediately complete
		if (newChain.nextSegmentIndex === descriptor.segments.length) {
			return {
				completed: {
					descriptorIndex: newChain.descriptorIndex,
					parts: newChain.parts
				},
				chain: null
			}
		}

		return { completed: null, chain: newChain }
	}

	/**
	 * Clones a chain for branching
	 */
	private cloneChain(chain: Chain): Chain {
		return {
			descriptorIndex: chain.descriptorIndex,
			nextSegmentIndex: chain.nextSegmentIndex,
			pos: chain.pos,
			parts: chain.parts.map(p => ({ ...p }))
		}
	}
}

/**
 * Segment matcher using Aho-Corasick algorithm
 */
class SegmentMatcher {
	private readonly segmentList: string[]
	private readonly segmentMap: Array<{ descriptorIndex: number; segmentIndex: number }>
	private readonly ac: AhoCorasick

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.segmentList = []
		this.segmentMap = []

		// Build unified segment list and mapping
		for (let di = 0; di < descriptors.length; di++) {
			const descriptor = descriptors[di]
			for (let si = 0; si < descriptor.segments.length; si++) {
				this.segmentList.push(descriptor.segments[si])
				this.segmentMap.push({ descriptorIndex: di, segmentIndex: si })
			}
		}

		// Build Aho-Corasick automaton
		this.ac = new AhoCorasick(this.segmentList)
	}

	/**
	 * Finds all segment matches and groups them by position+value
	 */
	findDeduplicatedMatches(text: string): DeduplicatedMatch[] {
		const rawMatches = this.ac.search(text)

		// Group by position and value to handle multiple descriptors sharing same segments
		const matchesByPosValue = new Map<string, DeduplicatedMatch>()

		for (const r of rawMatches) {
			const mapInfo = this.segmentMap[r.segIndex]
			const key = `${r.start}:${r.value}`

			if (!matchesByPosValue.has(key)) {
				matchesByPosValue.set(key, {
					start: r.start,
					end: r.end,
					value: r.value,
					descriptors: []
				})
			}
			matchesByPosValue.get(key)!.descriptors.push({
				descriptorIndex: mapInfo.descriptorIndex,
				segmentIndex: mapInfo.segmentIndex
			})
		}

		// Convert to array and sort by position
		const uniqueMatches = Array.from(matchesByPosValue.values())
		uniqueMatches.sort((a, b) => (a.start - b.start) || (a.end - b.end))

		return uniqueMatches
	}
}

/**
 * Segment-based pattern matcher using Aho-Corasick algorithm
 * Efficiently finds all occurrences of markup patterns by treating them as segment sequences
 */
export class SegmentPatternMatcher {
	private readonly descriptors: SegmentMarkupDescriptor[]
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternAssembler: PatternAssembler
	private readonly chainManager: ChainManager

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.descriptors = descriptors
		this.segmentMatcher = new SegmentMatcher(descriptors)
		this.patternAssembler = new PatternAssembler(descriptors)
		this.chainManager = new ChainManager()
	}

	/**
	 * Finds all complete pattern matches in text
	 * Uses pattern exclusivity: a pattern cannot start a new match while already active (prevents self-nesting)
	 * Uses position-based matching with segment value grouping for proper nesting
	 */
	search(text: string): PatternMatch[] {
		const deduplicatedMatches = this.segmentMatcher.findDeduplicatedMatches(text)
		const results: PatternMatch[] = []
		const activePatterns = new Set<number>() // descriptorIndex

		// Process each unique segment occurrence
		for (const match of deduplicatedMatches) {
			this.processWaitingChains(match, results, activePatterns)
			this.startNewChains(match, results, activePatterns)
		}

		return results
	}

	/**
	 * Processes chains waiting for current segment match
	 */
	private processWaitingChains(match: DeduplicatedMatch, results: PatternMatch[], activePatterns: Set<number>): void {
		const waiting = this.chainManager.getWaiting(match.value)

		if (waiting.length === 0) {
			return
		}

		// Sort waiting chains: later start = inner = higher priority (LIFO)
		const sortedWaiting = Array.from(waiting).sort((a, b) => {
			const startPosA = a.parts[0].start
			const startPosB = b.parts[0].start
			return startPosB - startPosA
		})

		// Try to match with the first valid chain
		for (const chain of sortedWaiting) {
			if (match.start < chain.pos) {
				continue // Segment appears before chain expects it
			}

			const { completed, extended } = this.patternAssembler.tryExtendChain(chain, match)

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
	private startNewChains(match: DeduplicatedMatch, results: PatternMatch[], activePatterns: Set<number>): void {
		for (const descInfo of match.descriptors) {
			if (descInfo.segmentIndex === 0 && !activePatterns.has(descInfo.descriptorIndex)) {
				const { completed, chain } = this.patternAssembler.createNewChain(descInfo.descriptorIndex, match)

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

	/**
	 * Materializes gap values from text (lazy evaluation)
	 */
	materializeGaps(match: PatternMatch, text: string): void {
		for (const part of match.parts) {
			if (part.type === 'gap' && part.value === undefined) {
				part.value = text.slice(part.start, part.end + 1)
			}
		}
	}
}

