import {MarkupDescriptor} from '../core/MarkupDescriptor'
import {PatternChain, PatternPart} from './PatternChainManager'
import {SegmentMatch} from '../utils/AhoCorasick'

/**
 * Complete match of a pattern with all its parts
 */
export interface PatternMatch {
	descriptorIndex: number
	parts: PatternPart[]
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
	 * 
	 * OPTIMIZATION: Structural sharing - reuse existing parts array, only append new parts
	 */
	tryExtendChain(chain: PatternChain, match: SegmentMatch, isClosingSegment: boolean = false): { completed: PatternMatch | null; extended: PatternChain | null } {
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

		// OPTIMIZATION: Structural sharing instead of full clone
		// Reuse existing parts, only create new gap and segment
		const gapIndex = chain.nextSegmentIndex > 0 ? chain.nextSegmentIndex - 1 : 0
		const gapType = descriptor.gapTypes[gapIndex]

		// Calculate gap positions
		const gapStart = chain.pos
		const gapEnd = match.start - 1
		
		const newGap: PatternPart = {
			type: 'gap',
			start: gapStart,
			end: gapStart > gapEnd ? gapStart - 1 : gapEnd, // Ensure start <= end
			gapType
		}

		const newSegment: PatternPart = {
			type: 'segment',
			start: match.start,
			end: match.end,
			value: match.value
		}

		// Create new parts array with structural sharing
		const newParts = [...chain.parts, newGap, newSegment]

		const newChain: PatternChain = {
			descriptorIndex: chain.descriptorIndex,
			nextSegmentIndex: chain.nextSegmentIndex + 1,
			pos: match.end + 1,
			parts: newParts,
			hasNestedPatterns: chain.hasNestedPatterns,
			nestingLevel: chain.nestingLevel
		}

		// Check if pattern is complete
		if (newChain.nextSegmentIndex === descriptor.segments.length) {
			return {
				completed: {
					descriptorIndex: newChain.descriptorIndex,
					parts: newChain.parts // No need to copy, we just created a new array
				},
				extended: null
			}
		}

		return { completed: null, extended: newChain }
	}

	/**
	 * Creates a new chain for starting pattern
	 * Returns {completed: PatternMatch | null, chain: PatternChain | null}
	 */
	createNewChain(descriptorIndex: number, match: SegmentMatch, nestingLevel: number = 0): { completed: PatternMatch | null; chain: PatternChain | null } {
		const descriptor = this.descriptors[descriptorIndex]

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
}
