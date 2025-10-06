import {InnerOption} from '../../default/types'
import {Markup} from '../../../shared/types'
import {NestedToken} from './types'
import {PatternMatcher} from './core/PatternMatcher'
import {createMarkupDescriptor} from './core/MarkupDescriptor'
import {buildTokenSequence} from './core/TokenBuilder'

/**
 * Tree-based parser for processing nested markup constructions in text
 * Uses Aho-Corasick algorithm for efficient multi-pattern matching
 */
export class ParserV2 {
	private readonly matcher: PatternMatcher

	constructor(markups: Markup[]) {
		const descriptors = markups.map(createMarkupDescriptor)
		this.matcher = new PatternMatcher(descriptors)
	}

	/**
	 * Static method for parsing with options
	 */
	static split(value: string, options?: InnerOption[]): NestedToken[] {
		const markups = options?.map(c => c.markup)
		return markups ? new ParserV2(markups).split(value) : [{
			type: 'text',
			content: value,
			position: {
				start: 0,
				end: value.length
			}
		}]
	}

	/**
	 * Splits text into tokens with nested markup support
	 */
	split(value: string): NestedToken[] {
		// Find all pattern matches
		const matches = this.matcher.getAllMatches(value)

		// Build token sequence
		return buildTokenSequence(value, this, matches)
	}
}
