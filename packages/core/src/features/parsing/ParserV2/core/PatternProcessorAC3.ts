/**
 * Pattern Processor - Approach 3: Extended Aho-Corasick with Gaps
 * 
 * Concept: Single modified AC that handles patterns with variable-length gaps
 * 
 * Algorithm:
 * 1. Build a modified AC automaton where nodes can have "gap transitions"
 * 2. Gap transitions have constraints:
 *    - Type: value, nested, or meta
 *    - Can span any number of characters
 * 3. Search directly in text, transitioning through both segments and gaps
 * 4. Single-pass: text → complete pattern matches
 * 
 * Benefits:
 * - Single-pass algorithm (no intermediate SegmentMatch[])
 * - Most elegant theoretical solution
 * - Potential best performance (no multi-phase overhead)
 * 
 * Concerns:
 * - Complex implementation (most invasive change)
 * - Need to handle gap constraints efficiently
 * - May break AC O(n) time complexity (gaps can cause backtracking)
 */

import {MarkupRegistry} from '../utils/MarkupRegistry'
import {SegmentMatch} from '../utils/AhoCorasick'
import {MarkupDescriptor} from './MarkupDescriptor'
import {MatchResult} from '../types'

/**
 * Transition type in the extended AC automaton
 */
type TransitionType = 'segment' | 'gap'

/**
 * Gap constraint information
 */
interface GapConstraint {
	type: 'value' | 'nested' | 'meta'
	// For validation purposes
	minLength?: number
	maxLength?: number
}

/**
 * Node in extended Aho-Corasick automaton
 * Supports both character transitions (segments) and gap transitions
 */
class ExtendedACNode {
	// Character-based transitions (for segments)
	charNext: Map<string, ExtendedACNode> = new Map()
	
	// Gap transitions - move to next node after consuming a gap
	gapNext: Array<{
		node: ExtendedACNode
		constraint: GapConstraint
	}> = []
	
	// Failure link
	fail: ExtendedACNode | null = null
	
	// Patterns that complete at this node
	out: Array<{
		descriptorIndex: number
		// Positions of gaps we've passed (for content extraction)
		gapPositions: Array<{type: 'value' | 'nested' | 'meta'; index: number}>
	}> = []
	
	// For tracking which segment/gap we're in
	depth: number = 0
}

/**
 * Active state during parsing
 */
interface ActiveState {
	node: ExtendedACNode
	startPos: number
	// Track gap boundaries as we traverse
	gaps: Array<{
		type: 'value' | 'nested' | 'meta'
		start: number
		end: number
	}>
	// Track which descriptor we're matching
	descriptorIndex?: number
}

/**
 * Extended Aho-Corasick with gap support
 */
export class PatternProcessorAC3 {
	private readonly registry: MarkupRegistry
	private readonly descriptors: MarkupDescriptor[]
	private readonly root = new ExtendedACNode()
	
	constructor(registry: MarkupRegistry) {
		this.registry = registry
		this.descriptors = registry.descriptors
		
		// Build extended automaton
		this.buildExtendedTrie()
		// Note: Failure links are complex with gaps - simplified approach
	}

	/**
	 * Process segments - but in this approach we actually bypass segments
	 * and work directly with text
	 */
	processSegments(segments: SegmentMatch[], input: string): MatchResult[] {
		// For this approach, we ignore segments and parse directly
		return this.parseDirectly(input)
	}

	/**
	 * Build extended trie with segment and gap transitions
	 */
	private buildExtendedTrie(): void {
		for (let descIdx = 0; descIdx < this.descriptors.length; descIdx++) {
			const descriptor = this.descriptors[descIdx]
			let node = this.root
			let depth = 0
			
			// Build path alternating between segments and gaps
			for (let i = 0; i < descriptor.segments.length; i++) {
				const segment = descriptor.segments[i]
				
				// Add segment transition (character by character)
				for (const char of segment) {
					if (!node.charNext.has(char)) {
						const newNode = new ExtendedACNode()
						newNode.depth = ++depth
						node.charNext.set(char, newNode)
						node = newNode
					} else {
						node = node.charNext.get(char)!
						depth++
					}
				}
				
				// Add gap transition (if not last segment)
				if (i < descriptor.segments.length - 1) {
					const gapType = descriptor.gapTypes[i]
					const gapNode = new ExtendedACNode()
					gapNode.depth = ++depth
					
					node.gapNext.push({
						node: gapNode,
						constraint: {type: gapType},
					})
					
					node = gapNode
				}
			}
			
			// Mark this node as accepting
			const gapPositions = descriptor.gapTypes.map((type, index) => ({
				type,
				index,
			}))
			
			node.out.push({
				descriptorIndex: descIdx,
				gapPositions,
			})
		}
	}

	/**
	 * Parse text directly using extended AC
	 * 
	 * This is simplified - a full implementation would need:
	 * - Proper state management for multiple concurrent partial matches
	 * - Gap boundary detection
	 * - Failure link handling with gaps
	 */
	private parseDirectly(input: string): MatchResult[] {
		const results: MatchResult[] = []
		const activeStates: ActiveState[] = []
		
		// Start with root state
		activeStates.push({
			node: this.root,
			startPos: 0,
			gaps: [],
		})
		
		for (let pos = 0; pos < input.length; pos++) {
			const char = input[pos]
			const newStates: ActiveState[] = []
			
			// Process each active state
			for (const state of activeStates) {
				// Try character transitions
				if (state.node.charNext.has(char)) {
					const nextNode = state.node.charNext.get(char)!
					newStates.push({
						node: nextNode,
						startPos: state.startPos,
						gaps: [...state.gaps],
						descriptorIndex: state.descriptorIndex,
					})
					
					// Check if this completes a pattern
					if (nextNode.out.length > 0) {
						for (const {descriptorIndex, gapPositions} of nextNode.out) {
							// Extract match information
							const match = this.createMatchResult(
								input,
								state.startPos,
								pos + 1,
								descriptorIndex,
								state.gaps
							)
							if (match) {
								results.push(match)
							}
						}
					}
				}
				
				// Try gap transitions
				for (const {node: gapNode, constraint} of state.node.gapNext) {
					// For now, allow any gap content
					// In full implementation, would track gap start and validate later
					newStates.push({
						node: gapNode,
						startPos: state.startPos,
						gaps: [
							...state.gaps,
							{
								type: constraint.type,
								start: pos,
								end: pos, // Will be updated as we consume gap
							},
						],
						descriptorIndex: state.descriptorIndex,
					})
				}
			}
			
			// Add root state for starting new matches
			newStates.push({
				node: this.root,
				startPos: pos + 1,
				gaps: [],
			})
			
			// Update active states (limit to prevent explosion)
			activeStates.length = 0
			activeStates.push(...newStates.slice(0, 1000))
		}
		
		return this.filterOverlapping(results)
	}

	/**
	 * Create MatchResult from completed state
	 */
	private createMatchResult(
		input: string,
		start: number,
		end: number,
		descriptorIndex: number,
		gaps: Array<{type: 'value' | 'nested' | 'meta'; start: number; end: number}>
	): MatchResult | null {
		const descriptor = this.descriptors[descriptorIndex]
		
		let value = ''
		let valueStart = start
		let valueEnd = start
		let nested: string | undefined
		let nestedStart: number | undefined
		let nestedEnd: number | undefined
		let meta: string | undefined
		let metaStart: number | undefined
		let metaEnd: number | undefined
		
		// Extract gap content
		for (const gap of gaps) {
			const content = input.substring(gap.start, gap.end)
			
			if (gap.type === 'value') {
				value = content
				valueStart = gap.start
				valueEnd = gap.end
			} else if (gap.type === 'nested') {
				nested = content
				nestedStart = gap.start
				nestedEnd = gap.end
			} else if (gap.type === 'meta') {
				meta = content
				metaStart = gap.start
				metaEnd = gap.end
			}
		}
		
		// Validate two-value patterns
		if (descriptor.hasTwoValues) {
			const valueGaps = gaps.filter(g => g.type === 'value')
			if (valueGaps.length === 2) {
				const val1 = input.substring(valueGaps[0].start, valueGaps[0].end)
				const val2 = input.substring(valueGaps[1].start, valueGaps[1].end)
				
				if (val1 !== val2) {
					return null
				}
			}
		}
		
		return {
			start,
			end,
			content: input.substring(start, end),
			value: value || input.substring(start, end),
			valueStart,
			valueEnd,
			nested,
			nestedStart,
			nestedEnd,
			meta,
			metaStart,
			metaEnd,
			descriptorIndex,
		}
	}

	/**
	 * Filter overlapping matches
	 */
	private filterOverlapping(matches: MatchResult[]): MatchResult[] {
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
				if (match.start === existing.start) {
					shouldFilter = true
					break
				}
				
				const existingDesc = this.descriptors[existing.descriptorIndex]
				
				if (match.start >= existing.start && match.end <= existing.end) {
					if (match.start > existing.start || match.end < existing.end) {
						if (existingDesc.hasNested && 
							existing.nestedStart !== undefined && 
							existing.nestedEnd !== undefined) {
							const isInNested = match.start >= existing.nestedStart && 
											   match.end <= existing.nestedEnd
							if (isInNested) {
								continue
							}
						}
					}
					shouldFilter = true
					break
				}
				
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

