import {describe, expect, it} from 'vitest'

import {effect} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import {createTextToken} from '../parser/utils/createTextToken'
import {snapshot, stripIds} from './snapshot'
import {createTransactions, createUncontrolledSink} from './transactions'
import {createTokenTree} from './tree'
import type {CommitSink, MarkNode, TextNode, TransactionResult, TreeNode, Window} from './types'

const parser = new Parser(['@[__value__](__meta__)'])

/** Tree + verbs over the uncontrolled sink; `results` is one entry per adoption. */
function setup(source: string, options: {readOnly?: boolean} = {}) {
	const tree = createTokenTree(parser.parse(source))
	const results: TransactionResult[] = []
	let hook: ((result: TransactionResult) => void) | undefined
	const sink = createUncontrolledSink({
		tree,
		parser: () => parser,
		onResult: result => {
			results.push(result)
			hook?.(result)
		},
	})
	const tx = createTransactions({tree, readOnly: () => options.readOnly ?? false, sink})
	const onResult = (fn: (result: TransactionResult) => void): void => {
		hook = fn
	}
	return {tree, tx, results, onResult}
}

/** A sink that records the handoff instead of committing it. */
function recordingSink(verdict = true) {
	const commits: {next: string; window: Window}[] = []
	const sink: CommitSink = {
		commit(next, window) {
			commits.push({next, window})
			return verdict
		},
	}
	return {commits, sink}
}

const asText = (node: TreeNode): TextNode => {
	if (node.kind !== 'text') throw new Error('expected text')
	return node
}

const asMark = (node: TreeNode): MarkNode => {
	if (node.kind !== 'mark') throw new Error('expected mark')
	return node
}

describe('transactions: verbs', () => {
	it('applyRange splices and commits through the sink', () => {
		const {tree, tx} = setup('hello')
		expect(tx.applyRange({start: 1, end: 3, insertedLength: 0}, 'XY')).toBe(true)
		expect(tree.value()).toBe('hXYlo')
	})

	it('applyRange derives the inserted length from the text, not from the caller', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const {commits, sink} = recordingSink()
		const tx = createTransactions({tree, readOnly: () => false, sink})
		// The window argument carries a wrong insertedLength: the splice text is the truth.
		expect(tx.applyRange({start: 0, end: 5, insertedLength: 99}, 'xy')).toBe(true)
		expect(commits).toEqual([{next: 'xy', window: {start: 0, end: 5, insertedLength: 2}}])
	})

	it('applyRange reports the sink verdict and leaves committing to the sink', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const {commits, sink} = recordingSink(false)
		const tx = createTransactions({tree, readOnly: () => false, sink})
		expect(tx.applyRange({start: 0, end: 5, insertedLength: 0}, 'x')).toBe(false)
		expect(commits).toHaveLength(1)
		expect(tree.value()).toBe('hello')
	})

	it('applyText resolves node-local coordinates', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const tail = tree.roots()[2]
		if (tail.kind !== 'text') throw new Error('expected text')
		expect(tx.applyText(tail, {start: 1, end: 1}, 'Z')).toBe(true)
		expect(tree.value()).toBe('he@[x](m)lZlo')
	})

	it('applyStructural replaces a mark through its stored range and keeps its identity', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const mark = asMark(tree.roots()[1])
		expect(tx.applyStructural(mark, '@[y](n)')).toBe(true)
		expect(tree.value()).toBe('he@[y](n)llo')
		// Same descriptor at the same index: adoption keeps the node, so the verb behind
		// `mark.update()` costs no identity.
		expect(tree.roots()[1]).toBe(mark)
		expect([mark.value(), mark.meta()]).toEqual(['y', 'n'])
	})

	it('applyStructural removes a mark and the removed node stops accepting edits', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const mark = asMark(tree.roots()[1])
		expect(tx.applyStructural(mark, '')).toBe(true)
		expect(tree.value()).toBe('hello')
		expect(tx.applyStructural(mark, 'again')).toBe(false)
		expect(tree.value()).toBe('hello')
	})
})

describe('transactions: rejection', () => {
	it('rejects every verb before any mutation when readOnly', () => {
		const {tree, tx} = setup('he@[x](m)llo', {readOnly: true})
		const tail = asText(tree.roots()[2])
		expect(tx.applyRange({start: 0, end: 5, insertedLength: 0}, 'x')).toBe(false)
		expect(tx.applyText(tail, {start: 0, end: 1}, 'x')).toBe(false)
		expect(tx.applyStructural(tree.roots()[1], '')).toBe(false)
		// readOnly is gated at tx ENTRY: the body never runs.
		expect(
			tx.tx(() => {
				throw new Error('tx body ran under readOnly')
			})
		).toBe(false)
		expect(tree.value()).toBe('he@[x](m)llo')
	})

	it('rejects an out-of-bounds range', () => {
		const {tree, tx} = setup('hello')
		expect(tx.applyRange({start: 3, end: 99, insertedLength: 0}, 'x')).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('rejects an inverted or negative range', () => {
		const {tree, tx} = setup('hello')
		expect(tx.applyRange({start: 3, end: 1, insertedLength: 0}, 'x')).toBe(false)
		expect(tx.applyRange({start: -1, end: 2, insertedLength: 0}, 'x')).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('rejects a local range outside the node in applyText', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const tail = asText(tree.roots()[2]) // 'llo'
		expect(tx.applyText(tail, {start: 0, end: 4}, 'x')).toBe(false)
		expect(tx.applyText(tail, {start: -1, end: 1}, 'x')).toBe(false)
		expect(tx.applyText(tail, {start: 2, end: 1}, 'x')).toBe(false)
		expect(tree.value()).toBe('he@[x](m)llo')
	})

	it('rejects a dead node in applyText', () => {
		// A root text node at index 0 can never die under whole-value replacement — the
		// parser always emits a leading text token and middle pairing retains it. Kill a
		// TAIL node instead:
		const {tree, tx} = setup('he@[x](m)llo')
		const node = tree.roots()[2] // text 'llo'
		if (node.kind !== 'text') throw new Error('expected text')
		tx.applyRange({start: 0, end: 12, insertedLength: 0}, 'x') // parses to ONE text token → mark + tail removed
		expect(tx.applyText(node, {start: 0, end: 0}, 'x')).toBe(false)
	})

	it('rejects a dead node whose stale range still fits the current value', () => {
		// The range check cannot stand in for the liveness walk: after this replacement the
		// dead tail [9,12] and the dead mark [2,9] both still sit inside the value, so
		// without the walk each verb would splice at a stale offset instead of refusing.
		const {tree, tx} = setup('he@[x](m)llo')
		const tail = asText(tree.roots()[2])
		const mark = asMark(tree.roots()[1])
		expect(tx.applyRange({start: 0, end: 12, insertedLength: 0}, 'plain text here')).toBe(true)
		expect(tree.roots().map(n => n.kind)).toEqual(['text'])
		expect(tx.applyText(tail, {start: 0, end: 1}, 'Z')).toBe(false)
		expect(tx.applyStructural(mark, 'Z')).toBe(false)
		expect(tree.value()).toBe('plain text here')
	})

	it('throws on re-entrant dispatch', () => {
		const {tx, onResult} = setup('hello')
		onResult(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x'))
		expect(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'y')).toThrow('re-entrant')
	})

	it('throws before running the body of a re-entrant tx', () => {
		const {tx, onResult} = setup('hello')
		onResult(() => tx.tx(() => undefined))
		expect(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'y')).toThrow('re-entrant')
	})
})

describe('transactions: tx composition', () => {
	it('tx() batches two disjoint ops into one commit and one adoption', () => {
		const {tree, tx, results} = setup('he@[x](m)llo')
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
			tx.applyRange({start: 9, end: 12, insertedLength: 0}, 'B') // "llo" → "B", original coords
		})
		expect(ok).toBe(true)
		expect(tree.value()).toBe('Ahe@[x](m)B')
		expect(results).toHaveLength(1)
	})

	it('tx() composes ops given out of order into one hull window', () => {
		const tree = createTokenTree(parser.parse('abcdefghij'))
		const {commits, sink} = recordingSink()
		const tx = createTransactions({tree, readOnly: () => false, sink})
		const ok = tx.tx(() => {
			tx.applyRange({start: 7, end: 8, insertedLength: 0}, '')
			tx.applyRange({start: 2, end: 4, insertedLength: 0}, 'XYZ')
		})
		expect(ok).toBe(true)
		// Hull [2,8) of the OLD value maps to [2,8) of 'abXYZefgij' — six characters.
		expect(commits).toEqual([{next: 'abXYZefgij', window: {start: 2, end: 8, insertedLength: 6}}])
	})

	it('tx() applies two inserts at the same offset in submission order', () => {
		const {tree, tx} = setup('hello')
		expect(
			tx.tx(() => {
				tx.applyRange({start: 2, end: 2, insertedLength: 0}, 'A')
				tx.applyRange({start: 2, end: 2, insertedLength: 0}, 'B')
			})
		).toBe(true)
		expect(tree.value()).toBe('heABllo')
	})

	it('tx() rejects overlapping ops atomically', () => {
		const {tree, tx} = setup('hello')
		let second: boolean | undefined
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 3, insertedLength: 0}, 'x')
			second = tx.applyRange({start: 2, end: 4, insertedLength: 0}, 'y')
		})
		expect(second).toBe(false) // the refused verb answers honestly, mid-tx
		expect(ok).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('tx() rejects the whole transaction when one op is out of bounds', () => {
		const {tree, tx, results} = setup('hello')
		let second: boolean | undefined
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z')
			second = tx.applyRange({start: 3, end: 99, insertedLength: 0}, 'x')
		})
		expect(second).toBe(false)
		expect(ok).toBe(false)
		expect(results).toEqual([])
		expect(tree.value()).toBe('hello')
	})

	it('tx() refuses a nested tx and rejects the outer transaction with it', () => {
		const {tree, tx} = setup('hello')
		let inner: boolean | undefined
		const ok = tx.tx(() => {
			tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z')
			inner = tx.tx(() => undefined)
		})
		expect(inner).toBe(false)
		expect(ok).toBe(false)
		expect(tree.value()).toBe('hello')
	})

	it('tx() with no ops succeeds without a commit', () => {
		const {tx, results} = setup('hello')
		expect(tx.tx(() => undefined)).toBe(true)
		expect(results).toEqual([])
	})

	it('tx() discards the buffer when the body throws and stays usable', () => {
		const {tree, tx, results} = setup('hello')
		expect(() =>
			tx.tx(() => {
				tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z')
				throw new Error('boom')
			})
		).toThrow('boom')
		expect(results).toEqual([])
		expect(tree.value()).toBe('hello')
		expect(tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z')).toBe(true)
		expect(tree.value()).toBe('Zello')
	})

	it('tx() keeps ids outside the hull stable (multi-op identity)', () => {
		const {tree, tx} = setup('aa@[x](m)bb@[y](n)cc')
		const before = tree.roots().map(n => n.id)
		tx.tx(() => {
			tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z') // inside 'aa'
			tx.applyRange({start: 10, end: 11, insertedLength: 0}, 'W') // inside 'bb'
		})
		// hull = {0,11}; the second mark and tail 'cc' lie outside → same ids
		const after = tree.roots().map(n => n.id)
		expect(after[3]).toBe(before[3]) // @[y](n)
		expect(after[4]).toBe(before[4]) // 'cc'
	})
})

describe('transactions: uncontrolled sink', () => {
	it('the transaction result equals a fresh parse (equivalence through the verb layer)', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		tx.applyRange({start: 2, end: 9, insertedLength: 0}, '')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('hello')))
	})

	it('commits the whole value as one text token when no parser is configured', () => {
		const tree = createTokenTree([createTextToken('a@[x](m)b')])
		const sink = createUncontrolledSink({tree, parser: () => undefined})
		const tx = createTransactions({tree, readOnly: () => false, sink})
		expect(tx.applyRange({start: 0, end: 1, insertedLength: 0}, 'Z')).toBe(true)
		expect(tree.roots().map(n => n.kind)).toEqual(['text'])
		expect(tree.value()).toBe('Z@[x](m)b')
	})
})

describe('transactions: untracked reads', () => {
	it('a verb called inside an effect subscribes that effect to nothing', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		const tail = asText(tree.roots()[2])
		let runs = 0
		const stop = effect(() => {
			runs++
			tx.applyText(tail, {start: 0, end: 0}, '') // no-op splice: reads everything, writes nothing
		})
		expect(runs).toBe(1)

		// The projection read and the liveness walk's own reads.
		asText(tree.roots()[0]).text('QQQ')
		expect(runs).toBe(1)

		// A same-content children write moves no projection, so the computed value cannot
		// wake the effect — only a direct subscription from the liveness walk could.
		const mark = asMark(tree.roots()[1])
		mark.children([...mark.children()])
		expect(runs).toBe(1)

		stop()
	})
})