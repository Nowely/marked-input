import type {MarkToken, Token} from '../types'

/**
 * Internal function to process tokens with a callback
 * @param tokens - Tokens to process
 * @param callback - Function to transform each MarkToken
 * @returns Transformed text
 */
export function processTokensWithCallback(tokens: Token[], callback: (mark: MarkToken) => string): string {
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
				const processedChildren = processTokensWithCallback(token.children, callback)

				// Create a modified token with processed children as the value
				// This allows the callback to use the already-processed nested content
				const modifiedToken: MarkToken = {
					...token,
					value: processedChildren,
				}
				result += callback(modifiedToken)
			} else {
				result += callback(token)
			}
		}
	}
	return result
}