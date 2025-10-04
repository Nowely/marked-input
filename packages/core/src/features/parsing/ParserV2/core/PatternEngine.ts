import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../utils/PatternBuilder'
import {SegmentMatcher} from '../utils/SegmentMatcher'
import {PatternProcessor} from './PatternProcessor'
import {GapMaterializer} from './GapMaterializer'

/**
 * Pattern engine using segment-based matching with Aho-Corasick algorithm
 * Efficiently finds all occurrences of markup patterns by treating them as segment sequences
 */
export class PatternEngine {
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternProcessor: PatternProcessor
	private readonly gapMaterializer: GapMaterializer

	constructor(descriptors: MarkupDescriptor[]) {
		this.segmentMatcher = new SegmentMatcher(descriptors)
		this.patternProcessor = new PatternProcessor(descriptors)
		this.gapMaterializer = new GapMaterializer()
	}

	/**
	 * Finds all complete pattern matches in text
	 * Uses pattern exclusivity: a pattern cannot start a new match while already active (prevents self-nesting)
	 * Uses position-based matching with segment value grouping for proper nesting
	 */
	search(text: string): PatternMatch[] {
		const uniqueMatches = this.segmentMatcher.findDeduplicatedMatches(text)
		return this.patternProcessor.processMatches(uniqueMatches)
	}

	/**
	 * Materializes gap values from text (lazy evaluation)
	 */
	materializeGaps(match: PatternMatch, text: string): void {
		this.gapMaterializer.materializeGaps(match, text)
	}
}
