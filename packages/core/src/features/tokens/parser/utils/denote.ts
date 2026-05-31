import {Parser} from '../Parser'
import type {MarkToken, Markup} from '../types'
import {processTokensWithCallback} from './processTokens'

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

	const tokens = new Parser(markups).parse(value)

	return processTokensWithCallback(tokens, callback)
}