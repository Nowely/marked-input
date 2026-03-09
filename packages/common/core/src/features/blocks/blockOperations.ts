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
 * Merges block at `index` into block at `index - 1` by removing the separator between them.
 * Returns the new value string with the separator removed.
 * The caret join point in the raw value is `blocks[index - 1].endPos`.
 */
export function mergeBlocks(value: string, blocks: Block[], index: number): string {
	if (index <= 0 || index >= blocks.length) return value
	// Remove everything between endPos of previous block and startPos of current block (the separator)
	return value.slice(0, blocks[index - 1].endPos) + value.slice(blocks[index].startPos)
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