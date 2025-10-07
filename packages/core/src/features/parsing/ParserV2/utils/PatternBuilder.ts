import {MarkupDescriptor} from '../core/MarkupDescriptor'
import {PatternChain, MatchSegment} from './PatternChainManager'
import {UniqueMatch} from '../types'

/**
 * Complete match of a pattern with all its parts
 */
export interface PatternMatch {
	descriptorIndex: number
	parts: MatchSegment[]
}

/**
 * Pattern builder for building complete patterns from chains
 */
export class PatternBuilder {
	private readonly descriptors: MarkupDescriptor[]

	constructor(descriptors: MarkupDescriptor[]) {
		this.descriptors = descriptors
	}

	/**
	 * Tries to extend a chain with a new segment match
	 * Returns {completed: PatternMatch | null, extended: PatternChain | null}
	 */
	tryExtendChain(chain: PatternChain, match: UniqueMatch, isClosingSegment: boolean = false): { completed: PatternMatch | null; extended: PatternChain | null } {
		const descriptor = this.descriptors[chain.descriptorIndex]

		// Check if this segment matches what this chain expects
		const expectedSegment = descriptor.segments[chain.nextSegmentIndex]
		if (expectedSegment !== match.value) {
			return { completed: null, extended: null } // This segment doesn't match what this chain expects
		}

		// Context-aware matching: if this is a closing segment and pattern has no nested patterns,
		// prefer immediate closure (shortest match)
		const isLastSegment = chain.nextSegmentIndex === descriptor.segments.length - 1
		if (isLastSegment && isClosingSegment && !chain.hasNestedPatterns && !descriptor.isSymmetric) {
			// This is the first available closing segment for a non-nested pattern
			// Complete it immediately (greedy = false for non-nested)
		}

		const newPatternChain = this.cloneChain(chain)

		// Always add gap between segments (may be empty)
		const gapIndex = newPatternChain.nextSegmentIndex > 0 ? newPatternChain.nextSegmentIndex - 1 : 0
		const gapType = descriptor.gapTypes[gapIndex]

		// Calculate gap positions
		const gapStart = newPatternChain.pos
		const gapEnd = match.start - 1
		
		// If gap would have invalid positions (start > end), make it empty
		// This happens when two segments are adjacent (no gap between them)
		newPatternChain.parts.push({
			type: 'gap',
			start: gapStart,
			end: gapStart > gapEnd ? gapStart - 1 : gapEnd, // Ensure start <= end
			gapType
		})

		// Add segment
		newPatternChain.parts.push({
			type: 'segment',
			start: match.start,
			end: match.end,
			value: match.value
		})

		newPatternChain.pos = match.end + 1
		newPatternChain.nextSegmentIndex++

		// Check if pattern is complete
		if (newPatternChain.nextSegmentIndex === descriptor.segments.length) {
			return {
				completed: {
					descriptorIndex: newPatternChain.descriptorIndex,
					parts: newPatternChain.parts.map(p => ({ ...p }))
				},
				extended: null
			}
		}

		return { completed: null, extended: newPatternChain } // Chain extended but not complete
	}

	/**
	 * Creates a new chain for starting pattern
	 * Returns {completed: PatternMatch | null, chain: PatternChain | null}
	 */
	createNewChain(descriptorIndex: number, match: UniqueMatch, nestingLevel: number = 0): { completed: PatternMatch | null; chain: PatternChain | null } {
		const descriptor = this.descriptors[descriptorIndex]

		// Only start chains at first segment
		if (match.descriptors.find(d => d.descriptorIndex === descriptorIndex)?.segmentIndex !== 0) {
			return { completed: null, chain: null }
		}

		const newPatternChain: PatternChain = {
			descriptorIndex,
			nextSegmentIndex: 1,
			pos: match.end + 1,
			parts: [{
				type: 'segment',
				start: match.start,
				end: match.end,
				value: match.value
			}],
			hasNestedPatterns: false,
			nestingLevel
		}

		// Single-segment pattern is immediately complete
		if (newPatternChain.nextSegmentIndex === descriptor.segments.length) {
			return {
				completed: {
					descriptorIndex: newPatternChain.descriptorIndex,
					parts: newPatternChain.parts
				},
				chain: null
			}
		}

		return { completed: null, chain: newPatternChain }
	}

	/**
	 * Clones a chain for branching
	 */
	private cloneChain(chain: PatternChain): PatternChain {
		return {
			descriptorIndex: chain.descriptorIndex,
			nextSegmentIndex: chain.nextSegmentIndex,
			pos: chain.pos,
			parts: chain.parts.map(p => ({ ...p })),
			hasNestedPatterns: chain.hasNestedPatterns,
			nestingLevel: chain.nestingLevel
		}
	}
}
