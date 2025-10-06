import {TextToken, MatchResult, NestedToken} from '../types'
import {buildTreeSinglePass} from './TreeBuilder'

export const createTextToken = (input: string, start = 0, end = input.length): TextToken => {
	return {
		type: 'text',
		content: input.substring(start, end),
		position: { start, end }
	}
}

/**
 * Builds nested token tree using single-pass algorithm
 * No recursive parsing - all structure is built from match positions
 * 
 * @param input - Original input text
 * @param matches - All matches found by PatternMatcher (with position info)
 * @returns Nested token tree with proper parent-child relationships
 */
export function buildTokenSequence(
	input: string,
	matches: MatchResult[]
): NestedToken[] {
	return buildTreeSinglePass(input, matches)
}

