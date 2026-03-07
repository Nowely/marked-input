import {describe, expect, it} from 'vitest'

import {addBlock, deleteBlock, duplicateBlock} from './blockOperations'
import type {Block} from './splitTokensIntoBlocks'

function makeBlock(id: string, startPos: number, endPos: number): Block {
	return {id, tokens: [], startPos, endPos}
}

// "A\nB\nC" → blocks at [0,1], [2,3], [4,5]
const THREE_BLOCKS: Block[] = [makeBlock('0', 0, 1), makeBlock('2', 2, 3), makeBlock('4', 4, 5)]

describe('addBlock', () => {
	it('appends newline when blocks is empty', () => {
		expect(addBlock('A', [], 0)).toBe('A\n')
	})

	it('appends newline when afterIndex is last block', () => {
		expect(addBlock('A\nB\nC', THREE_BLOCKS, 2)).toBe('A\nB\nC\n')
	})

	it('inserts newline after middle block', () => {
		// After block[0] ("A"), insert before block[1] start (pos 2)
		expect(addBlock('A\nB\nC', THREE_BLOCKS, 0)).toBe('A\n\nB\nC')
	})

	it('inserts newline after first block in two-block value', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1), makeBlock('2', 2, 3)]
		expect(addBlock('A\nB', blocks, 0)).toBe('A\n\nB')
	})
})

describe('deleteBlock', () => {
	it('returns empty string when only one block', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1)]
		expect(deleteBlock('A', blocks, 0)).toBe('')
	})

	it('deletes first block', () => {
		// Remove block[0] ("A\n"), remainder is "B\nC"
		expect(deleteBlock('A\nB\nC', THREE_BLOCKS, 0)).toBe('B\nC')
	})

	it('deletes middle block', () => {
		// Remove block[1] ("B\n"), result is "A\nC"
		expect(deleteBlock('A\nB\nC', THREE_BLOCKS, 1)).toBe('A\nC')
	})

	it('deletes last block', () => {
		// Remove block[2] ("C"), trim to block[1].endPos (3)
		expect(deleteBlock('A\nB\nC', THREE_BLOCKS, 2)).toBe('A\nB')
	})

	it('deletes from a two-block value', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1), makeBlock('2', 2, 3)]
		expect(deleteBlock('A\nB', blocks, 0)).toBe('B')
		expect(deleteBlock('A\nB', blocks, 1)).toBe('A')
	})
})

describe('duplicateBlock', () => {
	it('duplicates last block by appending', () => {
		expect(duplicateBlock('A\nB\nC', THREE_BLOCKS, 2)).toBe('A\nB\nC\nC')
	})

	it('duplicates first block into middle', () => {
		// Insert "A\n" before block[1] start (pos 2) → "A\nA\nB\nC"
		expect(duplicateBlock('A\nB\nC', THREE_BLOCKS, 0)).toBe('A\nA\nB\nC')
	})

	it('duplicates middle block', () => {
		// Insert "B\n" before block[2] start (pos 4) → "A\nB\nB\nC"
		expect(duplicateBlock('A\nB\nC', THREE_BLOCKS, 1)).toBe('A\nB\nB\nC')
	})

	it('duplicates single block', () => {
		const blocks: Block[] = [makeBlock('0', 0, 1)]
		expect(duplicateBlock('A', blocks, 0)).toBe('A\nA')
	})
})