import type {KeyGenerator} from '../../shared/classes'
import type {Token} from '../parsing'

export interface Block {
	id: string
	tokens: Token[]
	startPos: number
	endPos: number
}

export const EMPTY_BLOCK: Block = {id: 'block-empty', tokens: [], startPos: 0, endPos: 0}

export const isMarkBlock = (block: Block): boolean => block.tokens.length === 1 && block.tokens[0].type === 'mark'

export function tokensToBlocks(tokens: Token[], key: KeyGenerator): Block[] {
	return tokens.map(token => ({
		id: String(key.get(token)),
		tokens: [token],
		startPos: token.position.start,
		endPos: token.position.end,
	}))
}