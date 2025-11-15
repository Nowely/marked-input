import {Token} from '../types'
import {PLACEHOLDER} from '../constants'
import {annotate} from './annotate'

/**
 * Convert parsed tokens back to annotated string (inverse of `parse`).
 *
 * This function is useful for reconstructing annotated text from tokens,
 * similar to toString in text-manipulation/utils but for ParserV2
 *
 * @param tokens - Array of parsed tokens (from ParserV2.parse)
 * @returns Reconstructed annotated string
 *
 * @example
 * ```typescript
 * const markups = ['@[__value__](__meta__)', '#[__nested__]']
 * const tokens = new ParserV2(markups).parse('@[Hello](world) #[test]')
 * const result = toString(tokens)
 * // Returns: '@[Hello](world) #[test]'
 * ```
 */
export function toString(tokens: Token[]): string {
	let result = ''

	for (const token of tokens) {
		if (token.type === 'text') {
			result += token.content
			continue
		}

		const markup = token.descriptor.markup
		const nested = markup.includes(PLACEHOLDER.Nested)
			? token.children.length > 0
				? toString(token.children)
				: token.nested?.content
			: undefined

		result += annotate(markup, {
			value: token.value,
			meta: token.meta,
			nested,
		})
	}

	return result
}
