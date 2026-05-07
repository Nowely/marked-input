import type {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'

/**
 * Parse a string value using the given parser.
 * If no parser is provided, returns a single plain-text token.
 */
export function parseWithParser(parser: Parser | undefined, value: string): Token[] {
	if (!parser) {
		return [{type: 'text' as const, content: value, position: {start: 0, end: value.length}}]
	}
	return parser.parse(value)
}

/**
 * Extract tokens from a string value using the given parser.
 */
export function computeTokensFromValue(parser: Parser | undefined, value: string): Token[] {
	return parseWithParser(parser, value)
}

/**
 * Parse tokens from selected indexes in an existing token array, concatenated.
 */
export function parseUnionLabels(parser: Parser | undefined, tokens: readonly Token[], ...indexes: number[]): Token[] {
	let span = ''
	for (const index of indexes) {
		span += tokens[index]?.content ?? ''
	}
	return parseWithParser(parser, span)
}

/**
 * Get the raw start positions of each token.
 */
export function getRangeMap(tokens: readonly Token[]): number[] {
	let position = 0
	return tokens.map(token => {
		const length = token.content.length
		position += length
		return position - length
	})
}