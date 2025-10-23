import {Token, Markup} from '../types'
import {annotate} from './annotate'

/**
 * Convert parsed tokens back to annotated string (inverse of `split`).
 *
 * This function is useful for reconstructing annotated text from tokens,
 * similar to toString in text-manipulation/utils but for ParserV2
 *
 * @param tokens - Array of parsed tokens (from ParserV2.split)
 * @param markups - Original markup patterns used for parsing
 * @returns Reconstructed annotated string
 *
 * @example
 * ```typescript
 * const markups = ['@[__value__](__meta__)', '#[__nested__]']
 * const tokens = new ParserV2(markups).split('@[Hello](world) #[test]')
 * const result = toString(tokens, markups)
 * // Returns: '@[Hello](world) #[test]'
 * ```
 */
export function toString(tokens: Token[], markups: Markup[]): string {
	let result = ''

	for (const token of tokens) {
		if (token.type === 'text') {
			result += token.content
		} else {
			const markup = markups[token.optionIndex]

			// Determine what to use for nested content
			// If markup has __nested__ placeholder, we need to reconstruct from children
			let nestedContent: string | undefined
			if (markup.includes('__nested__')) {
				if (token.children.length > 0) {
					// Recursively reconstruct nested content from children
					nestedContent = toString(token.children, markups)
				} else if (token.nested) {
					// If no children but nested exists, use nested content directly
					// (This can happen with empty nested content)
					nestedContent = token.nested.content
				}
			}

			result += annotate(markup, {
				value: token.value,
				meta: token.meta,
				nested: nestedContent
			})
		}
	}

	return result
}

