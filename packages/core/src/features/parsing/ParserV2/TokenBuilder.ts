import {Markup} from '../../../shared/types'
import {NestedToken, TextToken, MarkToken, MatchResult} from './types'
import {ParserV2} from './ParserV2'

/**
 * Creates a text token
 */
function createTextToken(input: string, start: number, end: number): TextToken {
	return {
		type: 'text',
		content: input.substring(start, end),
		position: {start, end}
	}
}

/**
 * Creates a mark token from a match with recursive parsing
 */
function createMarkToken(input: string, markups: Markup[], parser: ParserV2, match: MatchResult): MarkToken {
	// Recursively parse inner content (label contains text between markup segments)
	const innerTokens = match.label ? parser.split(match.label) : []
	const hasMarks = innerTokens.some((token: NestedToken) => token.type === 'mark')

	return {
		type: 'mark',
		content: match.content,
		children: hasMarks ? innerTokens : [],
		data: {
			label: match.label,
			value: match.value,
			optionIndex: match.descriptor.index
		},
		position: {
			start: match.start,
			end: match.end
		}
	}
}

/**
 * Builds sequence of tokens: text-mark-text-mark-text...
 */
export function buildTokenSequence(
	input: string,
	markups: Markup[],
	parser: ParserV2,
	matches: MatchResult[]
): NestedToken[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const tokens: NestedToken[] = []
	let pos = 0

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]

		// Add text before mark (or empty text if at start/adjacent)
		if (match.start > pos) {
			tokens.push(createTextToken(input, pos, match.start))
		} else if (tokens.length === 0) {
			// First token is a mark starting at position 0, add empty text
			tokens.push(createTextToken(input, 0, 0))
		} else if (match.start === pos && pos > 0) {
			// Adjacent marks, add empty text between them
			tokens.push(createTextToken(input, pos, pos))
		}

		// Add mark token
		tokens.push(createMarkToken(input, markups, parser, match))
		pos = match.end
	}

	// Add final text after last mark
	tokens.push(createTextToken(input, pos, input.length))

	return tokens
}

