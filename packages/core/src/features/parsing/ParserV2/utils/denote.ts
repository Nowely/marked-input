import {ParserV2} from '../ParserV2'
import {MarkToken, Markup, NestedToken} from '../types'
import {annotate} from './annotate'

/**
 * Transform annotated text to another text by recursively processing all tokens
 *
 * @param value - Annotated text to process
 * @param callback - Function to transform each MarkToken
 * @param markups - Markup patterns to parse
 * @returns Transformed text
 *
 * @example
 * ```typescript
 * const text = '@[Hello](world) and #[nested @[content]]'
 * const result = denote(text, mark => mark.value, '@[__value__](__meta__)', '#[__nested__]')
 * // Returns: 'Hello and nested content'
 * ```
 */
export function denote(
	value: string,
	callback: (mark: MarkToken) => string,
	...markups: Markup[]
): string {
	if (!markups.length) return value

	const tokens = new ParserV2(markups).split(value)

	function processTokens(tokens: NestedToken[]): string {
		let result = ''
		for (const token of tokens) {
			if (token.type === 'text') {
				result += token.content
			} else {
				// For MarkToken with children, we need to decide:
				// - If we want to transform the mark itself AND its children
				// - Or transform children and include them in the mark's transformation
				
				if (token.children.length > 0) {
					// Recursively process children to get their transformed content
					const processedChildren = processTokens(token.children)
					
					// Create a modified token with processed children as the value
					// This allows the callback to use the already-processed nested content
					const modifiedToken: MarkToken = {
						...token,
						value: processedChildren
					}
					result += callback(modifiedToken)
				} else {
					result += callback(token)
				}
			}
		}
		return result
	}

	return processTokens(tokens)
}

