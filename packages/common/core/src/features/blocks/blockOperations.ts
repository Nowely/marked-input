import {BLOCK_SEPARATOR} from './config'
import type {Block} from './splitTokensIntoBlocks'

export function addBlock(value: string, blocks: Block[], afterIndex: number): string {
	if (afterIndex >= blocks.length - 1) {
		return value + BLOCK_SEPARATOR
	}

	const insertPos = blocks[afterIndex + 1].startPos
	return value.slice(0, insertPos) + BLOCK_SEPARATOR + value.slice(insertPos)
}

export function deleteBlock(value: string, blocks: Block[], index: number): string {
	if (blocks.length <= 1) return ''

	if (index >= blocks.length - 1) {
		return value.slice(0, blocks[index - 1].endPos)
	}

	return value.slice(0, blocks[index].startPos) + value.slice(blocks[index + 1].startPos)
}

/**
 * Returns the raw-value position of the join point between block[index-1] and block[index].
 *
 * Normally this is `blocks[index-1].endPos` — the position right after the previous block's
 * content, before the `\n\n` separator.
 *
 * Exception: when a mark token (e.g. a heading `# …\n\n`) consumes the `\n\n` as part of its
 * content, `splitTokensIntoBlocks` sets `endPos = token.position.end` (which is AFTER the `\n\n`)
 * and the next block's `startPos` equals that same value. In that case the separator is embedded
 * inside the previous block's range, and the true join point is `endPos - BLOCK_SEPARATOR.length`.
 */
export function getMergeJoinPos(blocks: Block[], index: number): number {
	if (index <= 0 || index >= blocks.length) return 0
	const prev = blocks[index - 1]
	const curr = blocks[index]
	if (prev.endPos === curr.startPos) {
		return prev.endPos - BLOCK_SEPARATOR.length
	}
	return prev.endPos
}

/**
 * Merges block at `index` into block at `index - 1` by removing the separator between them.
 * Returns the new value string with the separator removed.
 * Use `getMergeJoinPos` to obtain the raw caret position after the merge.
 */
export function mergeBlocks(value: string, blocks: Block[], index: number): string {
	if (index <= 0 || index >= blocks.length) return value
	const prev = blocks[index - 1]
	const curr = blocks[index]
	if (prev.endPos === curr.startPos) {
		// The \n\n separator is embedded inside the previous block's mark token.
		// Remove it from the end of prev's content.
		return value.slice(0, prev.endPos - BLOCK_SEPARATOR.length) + value.slice(curr.startPos)
	}
	// Remove everything between endPos of previous block and startPos of current block
	return value.slice(0, prev.endPos) + value.slice(curr.startPos)
}

export function duplicateBlock(value: string, blocks: Block[], index: number): string {
	const block = blocks[index]
	const blockText = value.substring(block.startPos, block.endPos)

	if (index >= blocks.length - 1) {
		return value + BLOCK_SEPARATOR + blockText
	}

	const insertPos = blocks[index + 1].startPos
	return value.slice(0, insertPos) + blockText + BLOCK_SEPARATOR + value.slice(insertPos)
}