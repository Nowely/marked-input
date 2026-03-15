import type {Token, TextToken} from '../parsing/parser/types'
import {BLOCK_SEPARATOR} from './config'

export interface Block {
	id: string
	tokens: Token[]
	startPos: number
	endPos: number
}

export interface TextPart {
	content: string
	position: {start: number; end: number}
	isBlockSeparator: boolean
}

export function splitTextByBlockSeparator(token: TextToken): TextPart[] {
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

let dragRowIdCounter = 0

function generateRowId(startPos: number): string {
	return `drag-${dragRowIdCounter++}-${startPos}`
}

export function resetDragRowIdCounter(): void {
	dragRowIdCounter = 0
}

/**
 * Splits a flat token list into drag rows where each top-level token = one row.
 *
 * Unlike `splitTokensIntoBlocks` (which grouped multiple tokens per block separated by `\n\n`),
 * this function makes each individual token its own row:
 * - MarkToken → one row (auto-delimited by mark syntax, no `\n\n` needed between marks)
 * - TextToken → split by `\n\n` → one row per non-separator fragment
 *
 * Separator rules:
 * - Adjacent marks: gap = 0 (no `\n\n` needed)
 * - Adjacent text rows: gap = 2 (`\n\n` required in value)
 * - Mark + text or text + mark: gap = 0
 * - A trailing `\n\n` creates an empty text row at the end
 * - Two consecutive `\n\n` in a text region creates an empty text row between them
 */
export function splitTokensIntoDragRows(tokens: Token[]): Block[] {
	if (tokens.length === 0) return []

	resetDragRowIdCounter()

	const rows: Block[] = []

	// Tracks the position right after the last `\n\n` separator seen inside a text token.
	// Used to detect consecutive separators (→ empty text row) or trailing separators.
	let afterSeparatorPos: number | null = null

	for (const token of tokens) {
		if (token.type === 'mark') {
			// A mark absorbs any pending separator gap — no empty text row is created
			// between a `\n\n` separator and the following mark.
			afterSeparatorPos = null
			rows.push({
				id: generateRowId(token.position.start),
				tokens: [token],
				startPos: token.position.start,
				endPos: token.position.end,
			})
		} else if (token.type === 'text') {
			const parts = splitTextByBlockSeparator(token as TextToken)
			for (const part of parts) {
				if (part.isBlockSeparator) {
					// Another separator seen while afterSeparatorPos was already set
					// → the gap between two separators is an empty text row.
					if (afterSeparatorPos !== null) {
						rows.push({
							id: generateRowId(afterSeparatorPos),
							tokens: [],
							startPos: afterSeparatorPos,
							endPos: afterSeparatorPos,
						})
					}
					afterSeparatorPos = part.position.end
				} else if (part.content.trim().length > 0) {
					afterSeparatorPos = null
					rows.push({
						id: generateRowId(part.position.start),
						tokens: [
							{
								type: 'text',
								content: part.content,
								position: part.position,
							} satisfies TextToken,
						],
						startPos: part.position.start,
						endPos: part.position.end,
					})
				}
			}
		}
	}

	// A trailing `\n\n` (afterSeparatorPos still set) creates an empty text row at the end.
	if (afterSeparatorPos !== null) {
		rows.push({
			id: generateRowId(afterSeparatorPos),
			tokens: [],
			startPos: afterSeparatorPos,
			endPos: afterSeparatorPos,
		})
	}

	return rows
}