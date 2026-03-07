import type {Block} from './splitTokensIntoBlocks'

export function addBlock(value: string, blocks: Block[], afterIndex: number): string {
	if (blocks.length === 0) return value + '\n'

	if (afterIndex >= blocks.length - 1) {
		return value + '\n'
	}

	const insertPos = blocks[afterIndex + 1].startPos
	return value.slice(0, insertPos) + '\n' + value.slice(insertPos)
}

export function deleteBlock(value: string, blocks: Block[], index: number): string {
	if (blocks.length <= 1) return ''

	if (index >= blocks.length - 1) {
		return value.slice(0, blocks[index - 1].endPos)
	}

	return value.slice(0, blocks[index].startPos) + value.slice(blocks[index + 1].startPos)
}

export function duplicateBlock(value: string, blocks: Block[], index: number): string {
	const block = blocks[index]
	const blockText = value.substring(block.startPos, block.endPos)

	if (index >= blocks.length - 1) {
		return value + '\n' + blockText
	}

	const insertPos = blocks[index + 1].startPos
	return value.slice(0, insertPos) + blockText + '\n' + value.slice(insertPos)
}