import type {Token, TextToken} from '../parsing/ParserV2/types'

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

	const flushBlock = (endPos: number) => {
		if (currentTokens.length === 0) return
		blocks.push({
			id: generateBlockId(blockStart),
			tokens: [...currentTokens],
			startPos: blockStart,
			endPos,
		})
		currentTokens = []
		blockStart = -1
	}

	for (const token of tokens) {
		if (token.type === 'mark') {
			const endsWithNewline = token.content.endsWith('\n')

			if (endsWithNewline) {
				flushBlock(token.position.start)

				blocks.push({
					id: generateBlockId(token.position.start),
					tokens: [token],
					startPos: token.position.start,
					endPos: token.position.end,
				})
			} else {
				if (blockStart === -1) blockStart = token.position.start
				currentTokens.push(token)
			}
			continue
		}

		if (token.type !== 'text') continue

		const textToken = token
		const parts = splitTextByNewlines(textToken)

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			if (part.isNewline) {
				flushBlock(part.position.start)
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

	if (currentTokens.length > 0) {
		const lastToken = currentTokens[currentTokens.length - 1]
		flushBlock(lastToken.position.end)
	}

	return blocks
}

interface TextPart {
	content: string
	position: {start: number; end: number}
	isNewline: boolean
}

function splitTextByNewlines(token: TextToken): TextPart[] {
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
				isNewline: false,
			})
			offset += text.length
			chars.length = 0
		}
	}

	for (let i = 0; i < content.length; i++) {
		const char = content[i]

		if (char === '\n') {
			flushText()
			parts.push({
				content: '\n',
				position: {start: offset, end: offset + 1},
				isNewline: true,
			})
			offset += 1
		} else if (char === '\r') {
			if (i + 1 < content.length && content[i + 1] === '\n') {
				flushText()
				parts.push({
					content: '\n',
					position: {start: offset, end: offset + 2},
					isNewline: true,
				})
				offset += 2
				i++
			} else {
				flushText()
				parts.push({
					content: '\n',
					position: {start: offset, end: offset + 1},
					isNewline: true,
				})
				offset += 1
			}
		} else {
			chars.push(char)
		}
	}

	flushText()

	return parts
}