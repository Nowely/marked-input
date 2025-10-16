import {InnerOption} from '../../default/types'
import {Markup} from './types'
import {NestedToken} from './types'
import {createMarkupDescriptor, MarkupDescriptor} from './core/MarkupDescriptor'
import {SegmentMatcher} from './core/SegmentMatcher'
import {PatternProcessor} from './core/PatternProcessor'
import {MatchPostProcessor} from './core/MatchPostProcessor'
import {AhoCorasick} from './utils/AhoCorasick'
import {buildTreeSinglePass} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'

export class ParserV2 {
	private readonly descriptors: MarkupDescriptor[]
	private readonly ac: AhoCorasick
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternProcessor: PatternProcessor

	constructor(markups: Markup[]) {
		// Compile markups to descriptors
		this.descriptors = markups.map(createMarkupDescriptor)

		// Initialize pipeline components
		this.ac = AhoCorasick.Create(this.descriptors)
		this.segmentMatcher = new SegmentMatcher(this.descriptors)
		this.patternProcessor = new PatternProcessor(this.descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		if (!markups || markups.length === 0) {
			return [createTextToken(value)]
		}
		return new ParserV2(markups).split(value)
	}

	split(value: string): NestedToken[] {
		// Execute explicit pipeline
		const rawMatches = this.ac.search(value)
		const uniqueMatches = this.segmentMatcher.deduplicateMatches(rawMatches)
		const patternMatches = this.patternProcessor.processMatches(uniqueMatches)
		const sortedMatches = MatchPostProcessor.sortByPositionAndLength(patternMatches)
		const filteredMatches = MatchPostProcessor.removeOverlaps(sortedMatches, value, this.descriptors)

		return buildTreeSinglePass(value, filteredMatches)
	}
}
