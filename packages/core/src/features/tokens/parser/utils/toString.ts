import type {Token} from '../types'
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
 * const markups = ['@[__value__](__meta__)', '#[__slot__]']
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

		const {markup, hasSlot} = token.descriptor
		const slot = hasSlot ? (token.children.length > 0 ? toString(token.children) : token.slot?.content) : undefined

		result += annotate(markup, {
			value: token.value,
			meta: token.meta,
			slot,
		})
	}

	return result
}