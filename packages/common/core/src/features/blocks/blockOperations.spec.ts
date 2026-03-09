import {describe, expect, it} from 'vitest'

import {addBlock, deleteBlock, duplicateBlock} from './blockOperations'
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