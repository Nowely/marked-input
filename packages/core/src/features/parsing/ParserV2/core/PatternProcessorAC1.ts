/**
 * Pattern Processor - Approach 1: Pattern-Level Aho-Corasick
 * 
 * Concept: Build Aho-Corasick automaton over SegmentMatch[] sequences
 * 
 * Algorithm:
 * 1. Convert SegmentMatch[] into a sequence of segment indices
 * 2. Build AC automaton where patterns are sequences of segment indices
 * 3. Search for pattern sequences in the segment index array
 * 4. Validate gap constraints (positions, distances)
 * 5. Filter overlapping matches
 * 
 * Benefits:
 * - Simpler than state machine approach
 * - Automatic pattern matching via AC
 * - Clear separation between pattern matching and gap validation
 * 
 * Concerns:
 * - Need to validate gaps after AC finds pattern sequences
 * - Position tracking requires mapping back to original segments
 * - Memory overhead for segment-based trie
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'
import {MatchResult} from '../types'

/**
 * Node in segment-based Aho-Corasick automaton
 */
class SegmentACNode {
	next: Map<number, SegmentACNode> = new Map()
	fail: SegmentACNode | null = null
	out: Array<{descriptorIndex: number; patternLength: number}> = []
}

/**
 * Potential match found by AC that needs gap validation
 */
interface PotentialMatch {
	descriptorIndex: number
	// Indices into the segments array
	segmentIndices: number[]
	// Start position in text
	start: number
	// End position in text
	end: number
}

/**
 * Pattern-Level Aho-Corasick processor
 */
export class PatternProcessorAC1 {
	private readonly registry: MarkupRegistry
	private readonly descriptors: MarkupDescriptor[]
	private readonly root = new SegmentACNode()
	
	// Map from segment value to its index in registry.segments
	private readonly segmentValueToIndex: Map<string, number>

	constructor(registry: MarkupRegistry) {
		this.registry = registry
		this.descriptors = registry.descriptors
		
		// Build segment value to index mapping
		this.segmentValueToIndex = new Map()
		registry.segments.forEach((seg, idx) => {
			this.segmentValueToIndex.set(seg, idx)
		})
		
		// Build AC automaton over segment sequences
		this.buildTrie()
		this.buildFailures()
	}

	/**
	 * Process segments to find pattern matches
	 */
	processSegments(segments: SegmentMatch[], input: string): MatchResult[] {
		return this.processSegmentsImproved(segments, input)
	}

	/**
	 * Build trie from pattern segment sequences
	 */
	private buildTrie(): void {
		for (let descIdx = 0; descIdx < this.descriptors.length; descIdx++) {
			const descriptor = this.descriptors[descIdx]
			let node = this.root
			
			// Build path for this pattern's segment sequence
			for (const segment of descriptor.segments) {
				const segmentIdx = this.segmentValueToIndex.get(segment)
				if (segmentIdx === undefined) {
					throw new Error(`Segment "${segment}" not found in registry`)
				}
				
				if (!node.next.has(segmentIdx)) {
					node.next.set(segmentIdx, new SegmentACNode())
				}
				node = node.next.get(segmentIdx)!
			}
			
			// Mark this node as accepting this pattern
			node.out.push({
				descriptorIndex: descIdx,
				patternLength: descriptor.segments.length,
			})
		}
	}

	/**
	 * Build failure links for AC automaton
	 */
	private buildFailures(): void {
		const queue: SegmentACNode[] = []
		this.root.fail = this.root
		
		// Initialize depth 1 nodes
		for (const [, node] of this.root.next) {
			node.fail = this.root
			queue.push(node)
		}
		
		// BFS to build failure links
		while (queue.length > 0) {
			const current = queue.shift()!
			
			for (const [segmentIdx, next] of current.next) {
				queue.push(next)
				
				// Find failure link
				let fail = current.fail
				while (fail !== this.root && !fail!.next.has(segmentIdx)) {
					fail = fail!.fail
				}
				
				if (fail!.next.has(segmentIdx) && fail!.next.get(segmentIdx) !== next) {
					next.fail = fail!.next.get(segmentIdx)!
				} else {
					next.fail = this.root
				}
				
				// Merge output from failure node
				if (next.fail && next.fail.out.length > 0) {
					next.out = next.out.concat(next.fail.out)
				}
			}
		}
	}

	/**
	 * Find potential matches by running AC over segment sequence
	 * Modified to handle multiple active states (NFA-like approach)
	 */
	private findPotentialMatches(segments: SegmentMatch[]): PotentialMatch[] {
		const results: PotentialMatch[] = []
		
		// Keep track of multiple active states
		// Each state tracks: current node and the segments we've matched so far
		interface ActiveState {
			node: SegmentACNode
			startIdx: number
			matchedSegments: number[] // indices into segments array
		}
		
		const activeStates: ActiveState[] = [{
			node: this.root,
			startIdx: 0,
			matchedSegments: [],
		}]
		
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i]
			const segmentIdx = this.segmentValueToIndex.get(segment.value)
			
			if (segmentIdx === undefined) {
				continue
			}
			
			const newStates: ActiveState[] = []
			
			// Process each active state
			for (const state of activeStates) {
				// Try to take transition
				if (state.node.next.has(segmentIdx)) {
					const nextNode = state.node.next.get(segmentIdx)!
					const newMatchedSegments = [...state.matchedSegments, i]
					
					newStates.push({
						node: nextNode,
						startIdx: state.startIdx,
						matchedSegments: newMatchedSegments,
					})
					
					// Check if this completes any patterns
					for (const {descriptorIndex, patternLength} of nextNode.out) {
						if (newMatchedSegments.length === patternLength) {
							const startSegment = segments[newMatchedSegments[0]]
							const endSegment = segments[i]
							
							results.push({
								descriptorIndex,
								segmentIndices: newMatchedSegments,
								start: startSegment.start,
								end: endSegment.end + 1,
							})
						}
					}
				}
				
				// Also try failure links
				let failNode = state.node.fail
				while (failNode && failNode !== this.root) {
					if (failNode.next.has(segmentIdx)) {
						const nextNode = failNode.next.get(segmentIdx)!
						// For failure links, we start a new match
						newStates.push({
							node: nextNode,
							startIdx: i,
							matchedSegments: [i],
						})
						break
					}
					failNode = failNode.fail
				}
			}
			
			// Always allow starting new matches from root
			if (this.root.next.has(segmentIdx)) {
				newStates.push({
					node: this.root.next.get(segmentIdx)!,
					startIdx: i,
					matchedSegments: [i],
				})
			}
			
			// Update active states
			activeStates.length = 0
			activeStates.push(...newStates)
			
			// Keep root state active too
			if (!activeStates.some(s => s.node === this.root)) {
				activeStates.push({
					node: this.root,
					startIdx: i + 1,
					matchedSegments: [],
				})
			}
		}
		
		return results
	}

	/**
	 * Improved process that keeps segment references
	 */
	processSegmentsImproved(segments: SegmentMatch[], input: string): MatchResult[] {
		if (segments.length === 0) return []
		
		// Find potential matches
		const potentialMatches = this.findPotentialMatches(segments)
		
		// Validate and convert in one pass
		const validMatches: MatchResult[] = []
		
		for (const match of potentialMatches) {
			const descriptor = this.descriptors[match.descriptorIndex]
			
			// Validate segment sequence
			let isValid = true
			let lastEnd = -1
			
			for (let i = 0; i < match.segmentIndices.length; i++) {
				const segIdx = match.segmentIndices[i]
				const segment = segments[segIdx]
				const expectedSegment = descriptor.segments[i]
				
				if (segment.value !== expectedSegment || (lastEnd !== -1 && segment.start < lastEnd)) {
					isValid = false
					break
				}
				
				lastEnd = segment.end + 1
			}
			
			if (!isValid) continue
			
			// Extract gap content
			let value = ''
			let valueStart = match.start
			let valueEnd = match.start
			let nested: string | undefined
			let nestedStart: number | undefined
			let nestedEnd: number | undefined
			let meta: string | undefined
			let metaStart: number | undefined
			let metaEnd: number | undefined
			
			// Process gaps between segments
			for (let i = 0; i < descriptor.gapTypes.length; i++) {
				const gapType = descriptor.gapTypes[i]
				const segIdx = match.segmentIndices[i]
				const nextSegIdx = match.segmentIndices[i + 1]
				
				const gapStart = segments[segIdx].end + 1
				const gapEnd = segments[nextSegIdx].start
				const gapContent = input.substring(gapStart, gapEnd)
				
				if (gapType === 'value') {
					value = gapContent
					valueStart = gapStart
					valueEnd = gapEnd
				} else if (gapType === 'nested') {
					nested = gapContent
					nestedStart = gapStart
					nestedEnd = gapEnd
				} else if (gapType === 'meta') {
					meta = gapContent
					metaStart = gapStart
					metaEnd = gapEnd
				}
			}
			
			// Validate two-value patterns
			if (descriptor.hasTwoValues) {
				const firstValueIdx = descriptor.gapTypes.indexOf('value')
				const lastValueIdx = descriptor.gapTypes.lastIndexOf('value')
				
				if (firstValueIdx !== -1 && lastValueIdx !== -1 && firstValueIdx !== lastValueIdx) {
					const seg1 = match.segmentIndices[firstValueIdx]
					const seg2 = match.segmentIndices[firstValueIdx + 1]
					const val1 = input.substring(segments[seg1].end + 1, segments[seg2].start)
					
					const seg3 = match.segmentIndices[lastValueIdx]
					const seg4 = match.segmentIndices[lastValueIdx + 1]
					const val2 = input.substring(segments[seg3].end + 1, segments[seg4].start)
					
					if (val1 !== val2) continue
					
					// Use the last value as the main value
					value = val2
					valueStart = segments[seg3].end + 1
					valueEnd = segments[seg4].start
				}
			}
			
			validMatches.push({
				start: match.start,
				end: match.end,
				content: input.substring(match.start, match.end),
				value: value || input.substring(match.start, match.end),
				valueStart,
				valueEnd,
				nested,
				nestedStart,
				nestedEnd,
				meta,
				metaStart,
				metaEnd,
				descriptorIndex: match.descriptorIndex,
			})
		}
		
		// Filter overlapping
		return this.filterOverlappingMatchResults(validMatches)
	}

	/**
	 * Filter overlapping MatchResults
	 */
	private filterOverlappingMatchResults(matches: MatchResult[]): MatchResult[] {
		if (matches.length === 0) return []
		
		// Sort by start, then by length
		matches.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start
			if (a.end !== b.end) return b.end - a.end
			
			const aDesc = this.descriptors[a.descriptorIndex]
			const bDesc = this.descriptors[b.descriptorIndex]
			const aSegLen = aDesc.segments[0].length
			const bSegLen = bDesc.segments[0].length
			
			if (aSegLen !== bSegLen) return bSegLen - aSegLen
			return bDesc.segments.length - aDesc.segments.length
		})
		
		const filtered: MatchResult[] = []
		
		for (const match of matches) {
			let shouldFilter = false
			
			for (const existing of filtered) {
				// Same start - keep first
				if (match.start === existing.start) {
					shouldFilter = true
					break
				}
				
				// Check for containment and overlaps
				const matchDesc = this.descriptors[match.descriptorIndex]
				const existingDesc = this.descriptors[existing.descriptorIndex]
				
				// Match inside existing
				if (match.start >= existing.start && match.end <= existing.end) {
					// Check if it's valid nesting
					if (match.start > existing.start || match.end < existing.end) {
						// Potentially valid nesting - check nested content
						if (existingDesc.hasNested && existing.nestedStart !== undefined && existing.nestedEnd !== undefined) {
							const isInNested = match.start >= existing.nestedStart && match.end <= existing.nestedEnd
							if (isInNested) {
								// Valid nesting - keep match
								continue
							}
						}
					}
					shouldFilter = true
					break
				}
				
				// Partial overlap
				const overlaps = (
					match.start < existing.end && match.end > existing.start &&
					!(match.start >= existing.start && match.end <= existing.end) &&
					!(existing.start >= match.start && existing.end <= match.end)
				)
				
				if (overlaps) {
					shouldFilter = true
					break
				}
			}
			
			if (!shouldFilter) {
				filtered.push(match)
			}
		}
		
		return filtered
	}
}

