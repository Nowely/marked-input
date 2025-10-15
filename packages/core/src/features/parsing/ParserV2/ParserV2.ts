import {InnerOption} from '../../default/types'
import {Markup} from './types'
import {NestedToken} from './types'
import {PatternMatcher} from './core/PatternMatcher'
import {createMarkupDescriptor} from './core/MarkupDescriptor'
import {buildTreeSinglePass} from './core/TreeBuilder'
import {createTextToken} from './core/TokenBuilder'

export class ParserV2 {
	private readonly matcher: PatternMatcher

	constructor(markups: Markup[]) {
		const descriptors = markups.map(createMarkupDescriptor)
		this.matcher = new PatternMatcher(descriptors)
	}

	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		return markups
			? new ParserV2(markups).split(value)
			: [createTextToken(value)]
	}

	split(value: string): NestedToken[] {
		const matches = this.matcher.getAllMatches(value)
		return buildTreeSinglePass(value, matches)
	}
}
