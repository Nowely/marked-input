import {Markup} from '../../../../shared/types'
import {NestedToken, TextToken, MarkToken, MatchResult} from '../types'
import {ParserV2} from '../ParserV2'

/**
 * Creates a text token
 */
export function createTextToken(input: string, start: number, end: number): TextToken {
	return {
		type: 'text',
		content: input.substring(start, end),
		position: {
			start,
			end
		}
	}
}

/**
 * Extracts inner content of a marker for recursive parsing
 * Simply returns label, which already contains text between the first pair of segments
 */
export function extractInnerContent(match: MatchResult): string | null {
	// label already contains text between the first pair of segments (gap of type 'label')
	// This was extracted in MarkupMatcher.extractFromParts()
	return match.label || null
}

/**
 * Creates a mark token from a match
 */
export function createMarkToken(input: string, markups: Markup[], parser: ParserV2, match: MatchResult): MarkToken {
	const children: NestedToken[] = []

	// Extract inner content for recursive parsing
	const innerContent = extractInnerContent(match)

	if (innerContent && parser) {
		// Recursively parse inner content (reuse ParserV2 instance)
		const innerTokens = parser.split(innerContent)

		// Add children only if there are markers among them
		const hasMarks = innerTokens.some((token: NestedToken) => token.type === 'mark')
		if (hasMarks) {
			children.push(...innerTokens)
		}
	}

	return {
		type: 'mark',
		content: match.content,
		children,
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
		// If no markers, return single text token
		return [{
			type: 'text',
			content: input,
			position: {
				start: 0,
				end: input.length
			}
		}]
	}

	const tokens: NestedToken[] = []
	let currentPosition = 0

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]
		const nextMatch = matches[i + 1]

		// Add text before marker (if any)
		if (match.start > currentPosition) {
			tokens.push(createTextToken(input, currentPosition, match.start))
		} else if (tokens.length === 0) {
			// First marker starts at position 0, add empty text
			tokens.push(createTextToken(input, 0, 0))
		}

		// Add marker
		tokens.push(createMarkToken(input, markups, parser, match))

		// Update current position
		currentPosition = match.end

		// Add text between markers (if there's a next match)
		if (nextMatch) {
			const nextStart = nextMatch.start

			if (nextStart > currentPosition) {
				// There's text between markers
				tokens.push(createTextToken(input, currentPosition, nextStart))
				currentPosition = nextStart
			} else {
				// Next marker starts immediately, add empty text
				tokens.push(createTextToken(input, currentPosition, currentPosition))
			}
		} else {
			// This is the last marker
			if (currentPosition < input.length) {
				// There's remaining text after marker
				tokens.push(createTextToken(input, currentPosition, input.length))
			} else {
				// Marker at end of string, add empty text
				tokens.push(createTextToken(input, currentPosition, currentPosition))
			}
		}
	}

	return tokens
}
