/**
 * Pattern Processor - Approach 2: Two-Level Aho-Corasick
 * 
 * Concept: Hierarchical matching with two AC automata
 * 
 * Architecture:
 * 1. Level 1: Character-based AC (reuse existing AhoCorasick) → SegmentMatch[]
 * 2. Level 2: Segment-based AC → pattern matches
 * 3. Integrated pipeline with optimized data flow
 * 
 * Benefits:
 * - Leverages AC efficiency at both levels
 * - Clear separation of concerns (segment finding vs pattern assembly)
 * - Potential for optimization (caching, parallel processing)
 * 
 * Concerns:
 * - Coordination overhead between levels
 * - Double memory footprint (two automata)
 * - Need to validate gap constraints after Level 2
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {AhoCorasick, SegmentMatch} from '../utils/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'
import {MatchResult} from '../types'

/**
 * Node in Level 2 (pattern-level) AC automaton
 */
class PatternACNode {
	// Transitions are based on segment values (not indices)
	next: Map<string, PatternACNode> = new Map()
	fail: PatternACNode | null = null
	// Patterns that end at this node
	out: Array<{
		descriptorIndex: number
		segmentCount: number
	}> = []
}

/**
 * Candidate pattern match from Level 2 AC
 */
interface PatternCandidate {
	descriptorIndex: number
	// The actual segment matches involved
	segments: SegmentMatch[]
	start: number
	end: number
}

/**
 * Two-Level Aho-Corasick processor
 */
export class PatternProcessorAC2 {
	private readonly registry: MarkupRegistry
	private readonly descriptors: MarkupDescriptor[]
	
	// Level 1: Character → Segments (reused from Parser)
	private readonly level1AC: AhoCorasick
	
	// Level 2: Segments → Patterns
	private readonly level2Root = new PatternACNode()
	
	constructor(registry: MarkupRegistry) {
		this.registry = registry
		this.descriptors = registry.descriptors
		
		// Level 1 is already built by Parser, we just store reference
		this.level1AC = new AhoCorasick(registry.segments)
		
		// Build Level 2 automaton
		this.buildLevel2Trie()
		this.buildLevel2Failures()
	}

	/**
	 * Process segments to find pattern matches
	 * 
	 * This is the main entry point. Since Level 1 (segment finding) is already
	 * done by Parser, we just need to run Level 2 on the segments.
	 */
	processSegments(segments: SegmentMatch[], input: string): MatchResult[] {
		if (segments.length === 0) return []
		
		// Sort segments by position for correct processing
		const sortedSegments = [...segments].sort((a, b) => a.start - b.start)
		
		// Run Level 2: find pattern candidates
		const candidates = this.runLevel2(sortedSegments)
		
		// Validate gap constraints
		const validated = this.validateCandidates(candidates, input)
		
		// Filter overlapping matches
		return this.filterOverlapping(validated)
	}

	/**
	 * Build Level 2 trie from pattern descriptors
	 * Each pattern is a sequence of segment values
	 */
	private buildLevel2Trie(): void {
		for (let descIdx = 0; descIdx < this.descriptors.length; descIdx++) {
			const descriptor = this.descriptors[descIdx]
			let node = this.level2Root
			
			// Build path for this pattern's segment sequence
			for (const segmentValue of descriptor.segments) {
				if (!node.next.has(segmentValue)) {
					node.next.set(segmentValue, new PatternACNode())
				}
				node = node.next.get(segmentValue)!
			}
			
			// Mark this node as accepting this pattern
			node.out.push({
				descriptorIndex: descIdx,
				segmentCount: descriptor.segments.length,
			})
		}
	}

	/**
	 * Build failure links for Level 2 AC automaton
	 */
	private buildLevel2Failures(): void {
		const queue: PatternACNode[] = []
		this.level2Root.fail = this.level2Root
		
		// Initialize depth 1 nodes
		for (const [, node] of this.level2Root.next) {
			node.fail = this.level2Root
			queue.push(node)
		}
		
		// BFS to build failure links
		while (queue.length > 0) {
			const current = queue.shift()!
			
			for (const [segmentValue, next] of current.next) {
				queue.push(next)
				
				// Find failure link
				let fail = current.fail
				while (fail !== this.level2Root && !fail!.next.has(segmentValue)) {
					fail = fail!.fail
				}
				
				if (fail!.next.has(segmentValue) && fail!.next.get(segmentValue) !== next) {
					next.fail = fail!.next.get(segmentValue)!
				} else {
					next.fail = this.level2Root
				}
				
				// Merge output from failure node
				if (next.fail && next.fail.out.length > 0) {
					next.out = next.out.concat(next.fail.out)
				}
			}
		}
	}

	/**
	 * Run Level 2 AC on segment sequence
	 */
	private runLevel2(segments: SegmentMatch[]): PatternCandidate[] {
		const candidates: PatternCandidate[] = []
		let node = this.level2Root
		
		// Process segments in order
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i]
			
			// Follow failure links
			while (node !== this.level2Root && !node.next.has(segment.value)) {
				node = node.fail!
			}
			
			// Take transition
			if (node.next.has(segment.value)) {
				node = node.next.get(segment.value)!
			}
			
			// Report all patterns that end at this position
			for (const {descriptorIndex, segmentCount} of node.out) {
				const startIdx = i - segmentCount + 1
				
				if (startIdx >= 0) {
					// Collect the segments involved in this match
					const matchedSegments = segments.slice(startIdx, i + 1)
					
					// Verify segment sequence is contiguous (no gaps with other patterns)
					// This is a key validation step
					let isContiguous = true
					for (let j = 1; j < matchedSegments.length; j++) {
						const prev = matchedSegments[j - 1]
						const curr = matchedSegments[j]
						
						// Check that segments are in order (no backwards jumps)
						if (curr.start < prev.end) {
							isContiguous = false
							break
						}
					}
					
					if (isContiguous) {
						candidates.push({
							descriptorIndex,
							segments: matchedSegments,
							start: matchedSegments[0].start,
							end: matchedSegments[matchedSegments.length - 1].end + 1,
						})
					}
				}
			}
		}
		
		return candidates
	}

	/**
	 * Validate pattern candidates by checking gap constraints
	 */
	private validateCandidates(
		candidates: PatternCandidate[],
		input: string
	): MatchResult[] {
		const validated: MatchResult[] = []
		
		for (const candidate of candidates) {
			const descriptor = this.descriptors[candidate.descriptorIndex]
			
			// Extract gap content
			let value = ''
			let valueStart = candidate.start
			let valueEnd = candidate.start
			let nested: string | undefined
			let nestedStart: number | undefined
			let nestedEnd: number | undefined
			let meta: string | undefined
			let metaStart: number | undefined
			let metaEnd: number | undefined
			
			// Process gaps between segments
			for (let i = 0; i < descriptor.gapTypes.length; i++) {
				const gapType = descriptor.gapTypes[i]
				const seg1 = candidate.segments[i]
				const seg2 = candidate.segments[i + 1]
				
				const gapStart = seg1.end + 1
				const gapEnd = seg2.start
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
					const seg1 = candidate.segments[firstValueIdx]
					const seg2 = candidate.segments[firstValueIdx + 1]
					const val1 = input.substring(seg1.end + 1, seg2.start)
					
					const seg3 = candidate.segments[lastValueIdx]
					const seg4 = candidate.segments[lastValueIdx + 1]
					const val2 = input.substring(seg3.end + 1, seg4.start)
					
					if (val1 !== val2) {
						// Values don't match - skip this candidate
						continue
					}
					
					// Use the last value as the main value
					value = val2
					valueStart = seg3.end + 1
					valueEnd = seg4.start
				}
			}
			
			validated.push({
				start: candidate.start,
				end: candidate.end,
				content: input.substring(candidate.start, candidate.end),
				value: value || input.substring(candidate.start, candidate.end),
				valueStart,
				valueEnd,
				nested,
				nestedStart,
				nestedEnd,
				meta,
				metaStart,
				metaEnd,
				descriptorIndex: candidate.descriptorIndex,
			})
		}
		
		return validated
	}

	/**
	 * Filter overlapping matches
	 */
	private filterOverlapping(matches: MatchResult[]): MatchResult[] {
		if (matches.length === 0) return []
		
		// Sort by start position, then by length (longer first), then by first segment length
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
				// Same start position - keep only the first (longest due to sort)
				if (match.start === existing.start) {
					shouldFilter = true
					break
				}
				
				// Check for containment
				const matchDesc = this.descriptors[match.descriptorIndex]
				const existingDesc = this.descriptors[existing.descriptorIndex]
				
				// Match completely inside existing
				if (match.start >= existing.start && match.end <= existing.end) {
					// Check if it's valid nesting
					if (match.start > existing.start || match.end < existing.end) {
						// Check if inside nestable content
						if (existingDesc.hasNested && 
							existing.nestedStart !== undefined && 
							existing.nestedEnd !== undefined) {
							const isInNested = match.start >= existing.nestedStart && 
											   match.end <= existing.nestedEnd
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
					match.start < existing.end && 
					match.end > existing.start &&
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

