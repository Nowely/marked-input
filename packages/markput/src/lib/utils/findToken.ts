import type {MarkToken, Token} from '@markput/core'

export interface TokenContext {
	depth: number
	parent?: MarkToken
}

export function findToken(
	tokens: Token[],
	target: Token,
	depth = 0,
	parent?: MarkToken
): TokenContext | undefined {
	for (const token of tokens) {
		if (token === target) return {depth, parent}
		if (token.type === 'mark') {
			const result = findToken(token.children, target, depth + 1, token)
			if (result) return result
		}
	}
}
