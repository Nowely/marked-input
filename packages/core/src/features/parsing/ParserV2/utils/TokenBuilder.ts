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
		return [createFullTextToken(input)]
	}

	const tokens: NestedToken[] = []
	let currentPosition = 0

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i]
		const nextMatch = matches[i + 1]

		currentPosition = processMatch(tokens, input, markups, parser, match, nextMatch, currentPosition)
	}

	return tokens
}

/**
 * Creates a single text token for input without any matches
 */
function createFullTextToken(input: string): TextToken {
	return {
		type: 'text',
		content: input,
		position: {
			start: 0,
			end: input.length
		}
	}
}

/**
 * Processes a single match and adds appropriate tokens
 */
function processMatch(
	tokens: NestedToken[],
	input: string,
	markups: Markup[],
	parser: ParserV2,
	match: MatchResult,
	nextMatch: MatchResult | undefined,
	currentPosition: number
): number {
	let pos = currentPosition

	// Add text before marker (if any)
	pos = addLeadingText(tokens, input, match, pos)

	// Add marker
	tokens.push(createMarkToken(input, markups, parser, match))

	// Update current position
	pos = match.end

	// Add text between markers or after last marker
	pos = addTrailingText(tokens, input, nextMatch, pos)

	return pos
}

/**
 * Adds text token before a marker if needed
 */
function addLeadingText(tokens: NestedToken[], input: string, match: MatchResult, currentPosition: number): number {
	if (match.start > currentPosition) {
		tokens.push(createTextToken(input, currentPosition, match.start))
		return currentPosition
	} else if (tokens.length === 0) {
		// First marker starts at position 0, add empty text
		tokens.push(createTextToken(input, 0, 0))
		return 0
	}
	return currentPosition
}

/**
 * Adds text token after marker (between markers or at end)
 */
function addTrailingText(tokens: NestedToken[], input: string, nextMatch: MatchResult | undefined, currentPosition: number): number {
	if (nextMatch) {
		return addInterMarkerText(tokens, input, nextMatch, currentPosition)
	} else {
		return addFinalText(tokens, input, currentPosition)
	}
}

/**
 * Adds text between two markers
 */
function addInterMarkerText(tokens: NestedToken[], input: string, nextMatch: MatchResult, currentPosition: number): number {
	const nextStart = nextMatch.start

	if (nextStart > currentPosition) {
		// There's text between markers
		tokens.push(createTextToken(input, currentPosition, nextStart))
		return nextStart
	} else {
		// Next marker starts immediately, add empty text
		tokens.push(createTextToken(input, currentPosition, currentPosition))
		return currentPosition
	}
}

/**
 * Adds final text after the last marker
 */
function addFinalText(tokens: NestedToken[], input: string, currentPosition: number): number {
	if (currentPosition < input.length) {
		// There's remaining text after marker
		tokens.push(createTextToken(input, currentPosition, input.length))
	} else {
		// Marker at end of string, add empty text
		tokens.push(createTextToken(input, currentPosition, currentPosition))
	}
	return currentPosition
}
