import type {Token, TextToken} from '../parsing/ParserV2/types'

export interface Block {
	id: string
	tokens: Token[]
	startPos: number
	endPos: number
}

/**
 * Groups a flat list of root-level tokens into blocks by splitting on newline boundaries.
 *
 * Block-level marks (whose markup ends with `\n`) form their own block.
 * Text tokens containing `\n` are split at newline boundaries — each line
 * becomes a separate block along with any adjacent marks.
 */
export function splitTokensIntoBlocks(tokens: Token[]): Block[] {
	if (tokens.length === 0) return []

	const blocks: Block[] = []
	let currentTokens: Token[] = []
	let blockStart = -1

	const flushBlock = (endPos: number) => {
		if (currentTokens.length === 0) return
		blocks.push({
			id: `block-${blockStart}`,
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
					id: `block-${token.position.start}`,
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

		const textToken = token as TextToken
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
	let current = ''

	for (let i = 0; i < content.length; i++) {
		if (content[i] === '\n') {
			if (current.length > 0) {
				parts.push({
					content: current,
					position: {start: offset, end: offset + current.length},
					isNewline: false,
				})
			}
			parts.push({
				content: '\n',
				position: {start: offset + current.length, end: offset + current.length + 1},
				isNewline: true,
			})
			offset = offset + current.length + 1
			current = ''
		} else {
			current += content[i]
		}
	}

	if (current.length > 0) {
		parts.push({
			content: current,
			position: {start: offset, end: offset + current.length},
			isNewline: false,
		})
	}

	return parts
}
