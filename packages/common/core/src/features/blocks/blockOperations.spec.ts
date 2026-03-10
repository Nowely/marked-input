import {describe, expect, it} from 'vitest'

import {addBlock, deleteBlock, duplicateBlock, getMergeJoinPos, mergeBlocks} from './blockOperations'
import type {Block} from './splitTokensIntoBlocks'

function makeBlock(id: string, startPos: number, endPos: number): Block {
	return {id, tokens: [], startPos, endPos}
}

const THREE_BLOCKS: Block[] = [makeBlock('0', 0, 1), makeBlock('3', 3, 4), makeBlock('6', 6, 7)]

describe('addBlock', () => {
	it('appends block separator when blocks is empty', () => {
		expect(addBlock('A', [], 0)).toBe('A\n\n')
	})

	it('appends block separator when afterIndex is last block', () => {
		expect(addBlock('A\n\nB\n\nC', THREE_BLOCKS, 2)).toBe('A\n\nB\n\nC\n\n')
	})

	it('inserts block separator after middle block', () => {
		expect(addBlock('A\n\nB\n\nC', THREE_BLOCKS, 0)).toBe('A\n\n\n\nB\n\nC')
	})

	it('inserts block separator after first block in two-block value', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1), makeBlock('3', 3, 4)]
		expect(addBlock('A\n\nB', blocks, 0)).toBe('A\n\n\n\nB')
	})
})

describe('deleteBlock', () => {
	it('returns empty string when only one block', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1)]
		expect(deleteBlock('A', blocks, 0)).toBe('')
	})

	it('deletes first block', () => {
		expect(deleteBlock('A\n\nB\n\nC', THREE_BLOCKS, 0)).toBe('B\n\nC')
	})

	it('deletes middle block', () => {
		expect(deleteBlock('A\n\nB\n\nC', THREE_BLOCKS, 1)).toBe('A\n\nC')
	})

	it('deletes last block', () => {
		expect(deleteBlock('A\n\nB\n\nC', THREE_BLOCKS, 2)).toBe('A\n\nB')
	})

	it('deletes from a two-block value', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1), makeBlock('3', 3, 4)]
		expect(deleteBlock('A\n\nB', blocks, 0)).toBe('B')
		expect(deleteBlock('A\n\nB', blocks, 1)).toBe('A')
	})
})

describe('mergeBlocks', () => {
	it('removes the separator between two blocks (standard case)', () => {
		// value: "A\n\nB\n\nC", blocks: [0,1], [3,4], [6,7]
		expect(mergeBlocks('A\n\nB\n\nC', THREE_BLOCKS, 1)).toBe('AB\n\nC')
	})

	it('merges last block into previous', () => {
		expect(mergeBlocks('A\n\nB\n\nC', THREE_BLOCKS, 2)).toBe('A\n\nBC')
	})

	it('returns value unchanged when index is 0', () => {
		expect(mergeBlocks('A\n\nB\n\nC', THREE_BLOCKS, 0)).toBe('A\n\nB\n\nC')
	})

	describe('embedded separator (mark-ending-with-\\n\\n)', () => {
		// When a mark token consumes the \n\n as part of its content, splitTokensIntoBlocks
		// sets endPos of that block to AFTER the \n\n, making endPos === next block's startPos.
		// Example: "# Heading\n\nBody" where the heading mark includes the trailing \n\n.
		//   block0: startPos=0, endPos=11  ("# Heading\n\n" length = 11)
		//   block1: startPos=11, endPos=15 ("Body")

		const HEADING_BLOCKS: Block[] = [makeBlock('0', 0, 11), makeBlock('11', 11, 15)]

		it('removes the embedded separator from the end of the previous block', () => {
			// "# Heading\n\nBody" → "# HeadingBody"
			expect(mergeBlocks('# Heading\n\nBody', HEADING_BLOCKS, 1)).toBe('# HeadingBody')
		})

		it('does not return the original value unchanged', () => {
			const result = mergeBlocks('# Heading\n\nBody', HEADING_BLOCKS, 1)
			expect(result).not.toBe('# Heading\n\nBody')
		})
	})
})

describe('getMergeJoinPos', () => {
	it('returns endPos of previous block in the standard case', () => {
		// THREE_BLOCKS: [0,1], [3,4], [6,7] — endPos=1, next startPos=3 (different)
		expect(getMergeJoinPos(THREE_BLOCKS, 1)).toBe(1)
		expect(getMergeJoinPos(THREE_BLOCKS, 2)).toBe(4)
	})

	it('returns endPos minus separator length when separator is embedded in previous mark', () => {
		// block0 endPos=11, block1 startPos=11 → separator is embedded, join is at 11-2=9
		const HEADING_BLOCKS: Block[] = [makeBlock('0', 0, 11), makeBlock('11', 11, 15)]
		expect(getMergeJoinPos(HEADING_BLOCKS, 1)).toBe(9)
	})

	it('returns 0 for index=0', () => {
		expect(getMergeJoinPos(THREE_BLOCKS, 0)).toBe(0)
	})
})

describe('duplicateBlock', () => {
	it('duplicates last block by appending', () => {
		expect(duplicateBlock('A\n\nB\n\nC', THREE_BLOCKS, 2)).toBe('A\n\nB\n\nC\n\nC')
	})

	it('duplicates first block into middle', () => {
		expect(duplicateBlock('A\n\nB\n\nC', THREE_BLOCKS, 0)).toBe('A\n\nA\n\nB\n\nC')
	})

	it('duplicates middle block', () => {
		expect(duplicateBlock('A\n\nB\n\nC', THREE_BLOCKS, 1)).toBe('A\n\nB\n\nB\n\nC')
	})

	it('duplicates single block', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1)]
		expect(duplicateBlock('A', blocks, 0)).toBe('A\n\nA')
	})
})