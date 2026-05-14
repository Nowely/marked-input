import type {Range} from '../../../shared/editorContracts'
import type {Token} from '../parser/types'
import {toString} from '../parser/utils/toString'

function trimTokensForRange(tokens: readonly Token[], range: Range): Token[] {
	return tokens
		.filter(token => token.position.end > range.start && token.position.start < range.end)
		.map(token => {
			if (token.type === 'text') {
				const start = Math.max(0, range.start - token.position.start)
				const end = Math.min(token.content.length, range.end - token.position.start)
				return Object.assign({}, token, {content: token.content.slice(start, end)})
			}

			if (token.children.length === 0) return token
			return Object.assign({}, token, {children: trimTokensForRange(token.children, range)})
		})
}

export function serializeRange(tokens: readonly Token[], range: Range): string {
	return toString(trimTokensForRange(tokens, range))
}