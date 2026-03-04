import type {Block} from './splitTokensIntoBlocks'

/**
 * Reorders blocks in the raw string value by moving a source block
 * to a target position.
 *
 * @param value - The full raw string value
 * @param blocks - Current block list from splitTokensIntoBlocks
 * @param sourceIndex - Index of the block being dragged
 * @param targetIndex - Index where the block should be inserted (before this block)
 * @returns The new string value with the block moved
 */
export function reorderBlocks(value: string, blocks: Block[], sourceIndex: number, targetIndex: number): string {
	if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return value
	if (blocks.length < 2) return value
	if (sourceIndex < 0 || sourceIndex >= blocks.length) return value
	if (targetIndex < 0 || targetIndex > blocks.length) return value

	const orderedBlocks = blocks.map((block, i) => ({
		index: i,
		text: extractBlockText(value, block, blocks, i),
	}))

	const newOrder = reorder(orderedBlocks, sourceIndex, targetIndex)

	return newOrder.map(b => b.text).join('\n')
}

interface OrderedBlock {
	index: number
	text: string
}

/**
 * Extracts the text for a block from the raw value, including any trailing
 * newline that separates it from the next block.
 */
function extractBlockText(value: string, block: Block, blocks: Block[], index: number): string {
	const start = block.startPos
	let end: number

	if (index < blocks.length - 1) {
		const nextBlock = blocks[index + 1]
		end = nextBlock.startPos
		const text = value.substring(start, end)
		return text.endsWith('\n') ? text.slice(0, -1) : text
	}

	end = value.length
	return value.substring(start, end)
}

function reorder(items: OrderedBlock[], sourceIndex: number, targetIndex: number): OrderedBlock[] {
	const result = [...items]
	const [moved] = result.splice(sourceIndex, 1)

	const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
	result.splice(insertAt, 0, moved)

	return result
}
