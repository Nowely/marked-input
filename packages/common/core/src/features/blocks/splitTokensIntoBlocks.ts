import type {Token, TextToken} from '../parsing/ParserV2/types'
import {BLOCK_SEPARATOR} from './config'

export interface Block {
	id: string
	tokens: Token[]
	startPos: number
	endPos: number
}

let blockIdCounter = 0

function generateBlockId(startPos: number): string {
	return `block-${blockIdCounter++}-${startPos}`
}

export function resetBlockIdCounter(): void {
	blockIdCounter = 0
}

export function splitTokensIntoBlocks(tokens: Token[]): Block[] {
	if (tokens.length === 0) return []

	resetBlockIdCounter()

	const blocks: Block[] = []
	let currentTokens: Token[] = []
	let blockStart = -1
	let blockStartFromText = false

	const flushBlock = (endPos: number, canCreateEmpty = false) => {
		const isEmpty = currentTokens.length === 0
		if (blockStart === -1 && isEmpty) return
		if (isEmpty && !canCreateEmpty) return
		const startPos = blockStart === -1 ? endPos : blockStart
		blocks.push({
			id: generateBlockId(startPos),
			tokens: [...currentTokens],
			startPos,
			endPos: isEmpty ? startPos : endPos,
		})
		currentTokens = []
		blockStart = -1
		blockStartFromText = false
	}

	for (const token of tokens) {
		if (token.type === 'mark') {
			const endsWithBlockSeparator = token.content.endsWith(BLOCK_SEPARATOR)

			if (endsWithBlockSeparator) {
				flushBlock(token.position.start)

				blocks.push({
					id: generateBlockId(token.position.start),
					tokens: [token],
					startPos: token.position.start,
					endPos: token.position.end,
				})
				blockStart = token.position.end
				blockStartFromText = false
			} else {
				if (blockStart === -1) blockStart = token.position.start
				currentTokens.push(token)
			}
			continue
		}

		if (token.type !== 'text') continue

		const textToken = token
		const parts = splitTextByBlockSeparator(textToken)

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			if (part.isBlockSeparator) {
				flushBlock(part.position.start, true)
				blockStart = part.position.end
				blockStartFromText = true
				continue
			}

			if (part.content.length === 0) continue

			if (blockStart === -1) blockStart = part.position.start
			currentTokens.push({
				type: 'text',
				content: part.content,
				position: part.position,
			})
		}
	}

	const lastPos = currentTokens.length > 0 ? currentTokens[currentTokens.length - 1].position.end : blockStart
	if (blockStart !== -1 || currentTokens.length > 0) {
		flushBlock(lastPos === -1 ? 0 : lastPos, currentTokens.length > 0 || blockStartFromText)
	}

	return blocks
}

interface TextPart {
	content: string
	position: {start: number; end: number}
	isBlockSeparator: boolean
}

function splitTextByBlockSeparator(token: TextToken): TextPart[] {
	const parts: TextPart[] = []
	const {content, position} = token

	let offset = position.start
	const chars: string[] = []

	const flushText = () => {
		if (chars.length > 0) {
			const text = chars.join('')
			parts.push({
				content: text,
				position: {start: offset, end: offset + text.length},
				isBlockSeparator: false,
			})
			offset += text.length
			chars.length = 0
		}
	}

	for (let i = 0; i < content.length; i++) {
		const char = content[i]

		if (char === '\n') {
			if (i + 1 < content.length && content[i + 1] === '\n') {
				flushText()
				parts.push({
					content: BLOCK_SEPARATOR,
					position: {start: offset, end: offset + 2},
					isBlockSeparator: true,
				})
				offset += 2
				i++
			} else {
				chars.push(char)
				offset++
			}
		} else if (char === '\r') {
			if (i + 1 < content.length && content[i + 1] === '\n') {
				if (
					i + 2 < content.length &&
					content[i + 2] === '\r' &&
					i + 3 < content.length &&
					content[i + 3] === '\n'
				) {
					flushText()
					parts.push({
						content: BLOCK_SEPARATOR,
						position: {start: offset, end: offset + 4},
						isBlockSeparator: true,
					})
					offset += 4
					i += 3
				} else {
					chars.push('\n')
					offset += 2
					i++
				}
			} else {
				chars.push('\n')
				offset++
			}
		} else {
			chars.push(char)
		}
	}

	flushText()

	return parts
}