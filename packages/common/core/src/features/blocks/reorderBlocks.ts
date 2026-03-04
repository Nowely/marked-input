import type {Block} from './splitTokensIntoBlocks'

interface OrderedBlock {
	index: number
	text: string
	separatorAfter: string
}

export function reorderBlocks(value: string, blocks: Block[], sourceIndex: number, targetIndex: number): string {
	if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return value
	if (blocks.length < 2) return value
	if (sourceIndex < 0 || sourceIndex >= blocks.length) return value
	if (targetIndex < 0 || targetIndex > blocks.length) return value

	const orderedBlocks = extractBlocksWithSeparators(value, blocks)
	const newOrder = reorder(orderedBlocks, sourceIndex, targetIndex)

	return reassembleBlocks(newOrder)
}

function extractBlocksWithSeparators(value: string, blocks: Block[]): OrderedBlock[] {
	return blocks.map((block, i) => {
		const text = value.substring(block.startPos, block.endPos)
		let separatorAfter = ''

		if (i < blocks.length - 1) {
			const nextBlock = blocks[i + 1]
			separatorAfter = value.substring(block.endPos, nextBlock.startPos)
		}

		return {
			index: i,
			text,
			separatorAfter,
		}
	})
}

function reassembleBlocks(orderedBlocks: OrderedBlock[]): string {
	const result: string[] = []

	for (let i = 0; i < orderedBlocks.length; i++) {
		const block = orderedBlocks[i]
		const isLast = i === orderedBlocks.length - 1

		let text = block.text
		if (text.endsWith('\n')) {
			text = text.slice(0, -1)
		}

		result.push(text)

		if (!isLast) {
			result.push(block.separatorAfter || '\n')
		}
	}

	return result.join('')
}

function reorder(items: OrderedBlock[], sourceIndex: number, targetIndex: number): OrderedBlock[] {
	const result = [...items]
	const [moved] = result.splice(sourceIndex, 1)

	const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
	result.splice(insertAt, 0, moved)

	redistributeSeparators(result, items)

	return result
}

function redistributeSeparators(blocks: OrderedBlock[], originalBlocks: OrderedBlock[]): void {
	for (let i = 0; i < blocks.length - 1; i++) {
		const currentOriginalIndex = blocks[i].index
		const nextOriginalIndex = blocks[i + 1].index

		if (Math.abs(currentOriginalIndex - nextOriginalIndex) === 1) {
			const earlierIndex = Math.min(currentOriginalIndex, nextOriginalIndex)
			const originalSeparator = originalBlocks[earlierIndex].separatorAfter
			blocks[i].separatorAfter = originalSeparator.length > 0 ? originalSeparator : '\n'
		} else {
			blocks[i].separatorAfter = '\n'
		}
	}
}
