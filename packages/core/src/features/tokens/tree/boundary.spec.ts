import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import {createTextToken} from '../parser/utils/createTextToken'
import type {Boundary} from './boundary'
import {createBoundary} from './boundary'
import {snapshot, stripIds} from './snapshot'
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

describe('boundary: controlled', () => {
	it('emits without committing — the tree keeps the old value', () => {
		const {tree, tx, emitted} = setup('hello', {controlled: true})
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(emitted).toEqual(['hXYlo'])
		expect(tree.value()).toBe('hello') // NOT committed
	})

	it('adopts the echo with the exact recorded window', () => {
		// REPEATED CONTENT IS LOAD-BEARING. With a unique fixture the gap-derived
		// window is byte-identical to the recorded one, so this test cannot tell
		// them apart (verified: it passes even when `arrive` always gap-derives).
		// Here they disagree: deleting the FIRST of two identical marks has exact
		// window {0,7,0} — keeping the SECOND mark — while gapWindow returns
		// {7,14,0} and keeps the FIRST.
		const {tree, boundary, tx} = setup('@[x](m)@[x](m)', {controlled: true})
		const secondMarkId = tree.roots()[3].id
		tx.applyRange({start: 0, end: 7, insertedLength: 0}, '')
		boundary.arrive('@[x](m)')
		expect(tree.value()).toBe('@[x](m)')
		expect(tree.roots()[1].id).toBe(secondMarkId) // the survivor is the one the exact window implies
	})

	it('reports the arrived value through value()', () => {
		const {boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(boundary.value()).toBe('hello')
		boundary.arrive('Ahello')
		expect(boundary.value()).toBe('Ahello')
	})

	it('a transforming parent still adopts, via a gap-derived window', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 5, end: 5, insertedLength: 0}, 'x')
		boundary.arrive('HELLOX') // parent uppercased — nothing matches lastEmitted
		expect(tree.value()).toBe('HELLOX')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('HELLOX')))
	})

	it('a rejecting parent leaves the tree untouched', () => {
		const {tree, tx, emitted} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(emitted).toEqual(['Ahello'])
		expect(tree.value()).toBe('hello') // no arrival → nothing happens
	})
})

describe('boundary: interleaving', () => {
	it('edit → edit → echo: the second edit recomputes from the committed projection', () => {
		const {tree, boundary, tx, emitted} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		expect(emitted).toEqual(['Ahello', 'Bhello']) // both spliced from 'hello'
		boundary.arrive('Bhello')
		expect(tree.value()).toBe('Bhello')
	})

	it('a stale echo does not clobber: it adopts through the gap window', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		boundary.arrive('Ahello') // stale: lastEmitted holds 'Bhello'
		expect(tree.value()).toBe('Ahello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Ahello')))
	})

	it('a second arrival after the record was consumed still adopts correctly', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'B')
		boundary.arrive('Ahello') // tree is now 'Ahello'; lastEmitted was cleared here
		boundary.arrive('Bhello') // no record left → gap-derived, still correct
		expect(tree.value()).toBe('Bhello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Bhello')))
	})

	it('an echo that matches the value but not the base gap-adopts (mode flip mid-flight)', () => {
		// The `base` check is only REACHABLE when the value matches while the tree
		// has moved. In pure controlled mode every arrival clears the record, so
		// the only real path is a controlled→uncontrolled flip: the edit commits
		// locally (moving the tree) and the parent's echo lands afterwards.
		let controlled = true
		const tree = createTokenTree(parser.parse('hello'))
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => controlled,
			onChange: () => {},
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A') // controlled: emits, records base 'hello'
		controlled = false
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'C') // uncontrolled → commits: tree is 'Chello'
		boundary.arrive('Ahello') // value matches the record, base does not
		expect(tree.value()).toBe('Ahello')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('Ahello')))
	})

	it('a parent that echoes synchronously inside onChange is handled on the same path', () => {
		// NOTE: this does NOT hit the dispatcher's re-entrancy throw — `assertIdle`
		// guards the verbs, and `arrive` calls adoption directly. It pins that the
		// synchronous round-trip completes, nothing more.
		const tree = createTokenTree(parser.parse('hello'))
		const boundary: Boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => true,
			onChange: value => boundary.arrive(value),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')).toBe(true)
		expect(tree.value()).toBe('Ahello')
	})
})

describe('boundary: resets', () => {
	it('reparse() re-derives every token from the unchanged projection', () => {
		// Adoption is equality-driven: with the value unchanged both walks are inert
		// and the middle rebuilds from the new parse, so gapWindow(v, v) suffices
		// (decision D-c). `createTextToken` is the repo idiom for a parser-less tree.
		const tree = createTokenTree([createTextToken('a@[x](m)b')])
		let active: Parser | undefined
		const boundary = createBoundary({
			tree,
			parser: () => active,
			controlled: () => false,
			onChange: () => {},
		})
		expect(tree.roots()).toHaveLength(1) // parsed as plain text
		active = parser
		boundary.reparse()
		expect(tree.roots().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('a@[x](m)b')))
	})

	it('an arrival identical to the current projection is a no-op', () => {
		const {tree, boundary} = setup('a@[x](m)b')
		const ids = tree.roots().map(n => n.id)
		boundary.arrive('a@[x](m)b')
		expect(tree.roots().map(n => n.id)).toEqual(ids)
	})
})