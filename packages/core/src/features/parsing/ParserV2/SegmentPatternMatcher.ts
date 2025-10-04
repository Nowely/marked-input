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
	 * Uses pattern exclusivity: a pattern cannot start a new match while already active (prevents self-nesting)
	 * Uses position-based matching with segment value grouping for proper nesting
	 */
	search(text: string): PatternMatch[] {
		// Find all segment occurrences
		const rawMatches = this.ac.search(text)

		// Convert to matches with descriptor/segment info, then deduplicate by position+value
		// We group by position and value to handle multiple descriptors sharing same segments
		const matchesByPosValue = new Map<string, {
			start: number
			end: number
			value: string
			descriptors: Array<{ descriptorIndex: number; segmentIndex: number }>
		}>()

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

		const results: PatternMatch[] = []

		// Map: segment value -> chains waiting for that segment
		// This allows ANY chain to use ANY occurrence of the segment value
		const activeBySegmentValue = new Map<string, Chain[]>()
		
		// Track active patterns: a pattern cannot start while already active
		const activePatterns = new Set<number>() // descriptorIndex

		const pushToMap = (segmentValue: string, chain: Chain) => {
			if (!activeBySegmentValue.has(segmentValue)) {
				activeBySegmentValue.set(segmentValue, [])
			}
			activeBySegmentValue.get(segmentValue)!.push(chain)
		}

		// Process each unique segment occurrence
		for (const match of uniqueMatches) {
			const waiting = activeBySegmentValue.get(match.value) || []

			if (waiting.length > 0) {
				// Sort waiting chains: later start = inner = higher priority (LIFO)
				// This ensures inner patterns complete before outer patterns
				const sortedWaiting = Array.from(waiting).sort((a, b) => {
					const startPosA = a.parts[0].start
					const startPosB = b.parts[0].start
					return startPosB - startPosA
				})

				// Try to match with the first valid chain
				for (const chain of sortedWaiting) {
					if (match.start >= chain.pos) {
						const descriptor = this.descriptors[chain.descriptorIndex]
						
						// Check if this segment is the expected next segment for this chain
						const expectedSegment = descriptor.segments[chain.nextSegmentIndex]
						if (expectedSegment !== match.value) {
							continue // This segment doesn't match what this chain expects
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
							results.push({
								descriptorIndex: newChain.descriptorIndex,
								parts: newChain.parts.map(p => ({ ...p }))
							})
							activePatterns.delete(newChain.descriptorIndex)
						} else {
							// Continue chain - wait for next segment value
							const nextSegmentValue = descriptor.segments[newChain.nextSegmentIndex]
							pushToMap(nextSegmentValue, newChain)
						}

						// Remove this chain from waiting list
						const chainIndex = waiting.indexOf(chain)
						if (chainIndex !== -1) {
							waiting.splice(chainIndex, 1)
						}

						// This segment occurrence has been consumed by this chain
						break
					}
				}
			}

			// Check if this can start new chains (first segment of any pattern)
			for (const descInfo of match.descriptors) {
				if (descInfo.segmentIndex === 0 && !activePatterns.has(descInfo.descriptorIndex)) {
					const descriptor = this.descriptors[descInfo.descriptorIndex]
					
					const newChain: Chain = {
						descriptorIndex: descInfo.descriptorIndex,
						nextSegmentIndex: 1,
						pos: match.end + 1,
						parts: [{
							type: 'segment',
							start: match.start,
							end: match.end,
							value: match.value
						}]
					}

					if (newChain.nextSegmentIndex === descriptor.segments.length) {
						// Single-segment pattern
						results.push({
							descriptorIndex: newChain.descriptorIndex,
							parts: newChain.parts
						})
					} else {
						// Continue chain - wait for next segment value
						const nextSegmentValue = descriptor.segments[newChain.nextSegmentIndex]
						pushToMap(nextSegmentValue, newChain)
						activePatterns.add(descInfo.descriptorIndex)
					}
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

