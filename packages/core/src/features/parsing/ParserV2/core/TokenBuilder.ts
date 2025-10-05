import {TextToken, MarkToken, MatchResult, NestedToken} from '../types'
import {ParserV2} from '../ParserV2'

/**
 * Creates a text token from input substring
 */
const createTextToken = (input: string, start: number, end: number): TextToken => ({
	type: 'text',
	content: input.substring(start, end),
	position: { start, end }
})

/**
 * Creates a mark token from match with nested parsing
 */
const createMarkToken = (parser: ParserV2, match: MatchResult): MarkToken => {
	const innerTokens = match.label ? parser.split(match.label) : []
	const hasNestedMarks = innerTokens.some(token => token.type === 'mark')

	return {
		type: 'mark',
		content: match.content,
		children: hasNestedMarks ? innerTokens : [],
		data: {
			label: match.label,
			value: match.value,
			optionIndex: match.descriptor.index
		},
		position: { start: match.start, end: match.end }
	}
}

/**
 * Builds token sequence: text-mark-text-mark-text...
 * Always alternates between text and mark tokens
 */
export function buildTokenSequence(
	input: string,
	parser: ParserV2,
	matches: MatchResult[]
): NestedToken[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const tokens: NestedToken[] = []
	let pos = 0

	for (const match of matches) {
		// Always add text before mark (may be empty)
		tokens.push(createTextToken(input, pos, match.start))
		tokens.push(createMarkToken(parser, match))
		pos = match.end
	}

	// Add final text after last mark
	tokens.push(createTextToken(input, pos, input.length))

	return tokens
}

