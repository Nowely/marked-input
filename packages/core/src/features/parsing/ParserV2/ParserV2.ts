import {InnerOption} from '../../default/types'
import {Markup} from './types'
import {NestedToken} from './types'
import {createMarkupDescriptor, MarkupDescriptor} from './core/MarkupDescriptor'
import {SegmentMatcher} from './core/SegmentMatcher'
import {PatternProcessor} from './core/PatternProcessor'
import {MatchPostProcessor} from './core/MatchPostProcessor'
import {AhoCorasick} from './utils/AhoCorasick'
import {buildTree} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'

export class ParserV2 {
	private readonly descriptors: MarkupDescriptor[]
	private readonly ac: AhoCorasick
	private readonly segmentMatcher: SegmentMatcher
	private readonly patternProcessor: PatternProcessor

	constructor(markups: Markup[]) {
		this.descriptors = markups.map(createMarkupDescriptor)
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
		const segmentMatches = this.ac.search(value)
		const uniqueMatches = this.segmentMatcher.deduplicateMatches(segmentMatches)
		const sortedValidatedMatches = this.patternProcessor.processMatches(uniqueMatches, value)
		const matchResults = MatchPostProcessor.convertToResults(sortedValidatedMatches, value, this.descriptors)

		return buildTree(value, matchResults)
	}
}
