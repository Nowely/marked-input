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
 * Segment-based pattern matcher using Aho-Corasick algorithm
 * Efficiently finds all occurrences of markup patterns by treating them as segment sequences
 */
export class SegmentPatternMatcher {
	private readonly descriptors: SegmentMarkupDescriptor[]
	private readonly segmentList: string[]
	private readonly segmentMap: Array<{ descriptorIndex: number; segmentIndex: number }>
	private readonly ac: AhoCorasick

	constructor(descriptors: SegmentMarkupDescriptor[]) {
		this.descriptors = descriptors
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
	 * Finds all complete pattern matches in text
	 * Uses pattern exclusivity: a pattern cannot start a new match while already active
	 */
	search(text: string): PatternMatch[] {
		// Find all segment occurrences
		const rawMatches = this.ac.search(text)

		// Convert to matches with descriptor/segment info
		const matches = rawMatches.map(r => {
			const mapInfo = this.segmentMap[r.segIndex]
			return {
				descriptorIndex: mapInfo.descriptorIndex,
				segmentIndex: mapInfo.segmentIndex,
				start: r.start,
				end: r.end,
				value: r.value
			}
		})

		// Sort by position (start, then end for determinism)
		matches.sort((a, b) => (a.start - b.start) || (a.end - b.end))

		const results: PatternMatch[] = []

		// Map: "descriptorIndex:segmentIndex" -> chains waiting for that segment
		const activeByExpected = new Map<string, Chain[]>()
		
		// Track active patterns: a pattern cannot start while already active
		// This prevents self-nesting and eliminates the need for bracket counting
		const activePatterns = new Set<number>() // descriptorIndex

		const pushToMap = (key: string, chain: Chain) => {
			if (!activeByExpected.has(key)) {
				activeByExpected.set(key, [])
			}
			activeByExpected.get(key)!.push(chain)
		}

		for (const match of matches) {
			const key = `${match.descriptorIndex}:${match.segmentIndex}`
			const waiting = activeByExpected.get(key) || []

			// Process chains waiting for this segment (use array copy to avoid modification issues)
			for (const chain of Array.from(waiting)) {
				// Check if match position is valid (at or after expected position)
				if (match.start >= chain.pos) {
					const descriptor = this.descriptors[chain.descriptorIndex]
					
					// Clone chain to create new branch
					const newChain = this.cloneChain(chain)

					// Add gap if there's space before this segment
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
						// Complete match - save it and free the pattern
						results.push({
							descriptorIndex: newChain.descriptorIndex,
							parts: newChain.parts.map(p => ({ ...p })) // Deep copy
						})
						// Free this pattern - it can start new matches now
						activePatterns.delete(newChain.descriptorIndex)
					} else {
						// Continue chain - wait for next segment
						const nextKey = `${newChain.descriptorIndex}:${newChain.nextSegmentIndex}`
						pushToMap(nextKey, newChain)
					}
				}
			}

			// Start new chains if this is the first segment of a pattern
			// BUT only if the pattern is not already active (prevents self-nesting)
			if (match.segmentIndex === 0 && !activePatterns.has(match.descriptorIndex)) {
				const newChain: Chain = {
					descriptorIndex: match.descriptorIndex,
					nextSegmentIndex: 1,
					pos: match.end + 1,
					parts: [{
						type: 'segment',
						start: match.start,
						end: match.end,
						value: match.value
					}]
				}

				const descriptor = this.descriptors[match.descriptorIndex]
				if (newChain.nextSegmentIndex === descriptor.segments.length) {
					// Single-segment pattern (edge case)
					results.push({
						descriptorIndex: newChain.descriptorIndex,
						parts: newChain.parts
					})
				} else {
					const nextKey = `${match.descriptorIndex}:1`
					pushToMap(nextKey, newChain)
					// Mark this pattern as active
					activePatterns.add(match.descriptorIndex)
				}
			}
		}

		return results
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

