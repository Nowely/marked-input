import {Parser} from '../Parser'
import type {MarkToken, Markup, Token} from '../types'

function processTokensWithCallback(tokens: Token[], callback: (mark: MarkToken) => string): string {
	let result = ''
	for (const token of tokens) {
		if (token.type === 'text') {
			result += token.content
		} else if (token.children.length > 0) {
			// Nested content is transformed first and handed to the callback as `value`, so a
			// callback reading `mark.value` sees already-denoted children instead of raw markup.
			result += callback({...token, value: processTokensWithCallback(token.children, callback)})
		} else {
			// A childless mark keeps its parsed `value` field: it is not derivable from children.
			result += callback(token)
		}
	}
	return result
}

/**
 * Transform annotated text to another text by recursively processing all tokens
 *
 * @param value - Annotated text to process
 * @param callback - Function to transform each MarkToken
 * @param markups - Array of markup patterns to parse
 * @returns Transformed text
 *
 * @example
 * ```typescript
 * const text = '@[Hello](world) and #[nested @[content]]'
 * const result = denote(text, mark => mark.value, ['@[__value__](__meta__)', '#[__slot__]'])
 * // Returns: 'Hello and nested content'
 * ```
 */
export function denote(value: string, callback: (mark: MarkToken) => string, markups: Markup[]): string {
	if (!markups.length) return value

	return processTokensWithCallback(new Parser(markups).parse(value), callback)
}