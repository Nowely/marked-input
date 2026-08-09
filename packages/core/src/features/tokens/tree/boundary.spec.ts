import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {createBoundary} from './boundary'
import {createTransactions} from './transactions'
import {createTokenTree} from './tree'

const parser = new Parser(['@[__value__](__meta__)'])

function setup(source: string, options: {controlled?: boolean} = {}) {
	const tree = createTokenTree(parser.parse(source))
	const emitted: string[] = []
	const boundary = createBoundary({
		tree,
		parser: () => parser,
		controlled: () => options.controlled === true,
		onChange: value => emitted.push(value),
	})
	const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
	return {tree, boundary, tx, emitted}
}

describe('boundary: uncontrolled', () => {
	it('commits the edit and emits the new projection', () => {
		const {tree, tx, emitted} = setup('hello')
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(tree.value()).toBe('hXYlo')
		expect(emitted).toEqual(['hXYlo'])
	})

	it('emits after the commit, so the tree is already consistent when onChange runs', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const seen: string[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => false,
			onChange: () => seen.push(tree.value()),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(seen).toEqual(['Ahello'])
	})

	it('value() reports the committed projection', () => {
		const {boundary, tx} = setup('hello')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(boundary.value()).toBe('Ahello')
	})
})