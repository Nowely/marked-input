import type {Token} from '../parsing'

export const EMPTY_TEXT_TOKEN: Token = {type: 'text', content: '', position: {start: 0, end: 0}}

export function filterDragTokens(tokens: Token[]): Token[] {
	return tokens.filter(t => !(t.type === 'text' && t.position.start === t.position.end))
}