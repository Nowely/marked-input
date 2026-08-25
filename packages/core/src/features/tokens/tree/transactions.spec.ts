import {describe, expect, it} from 'vitest'

import {effect, signal} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import {createTextToken} from '../parser/utils/createTextToken'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt, parseValue} from './adopt'
import {createTransactions} from './transactions'
import type {TokenTree} from './tree'
import {createTokenTree} from './tree'
import type {CommitSink, MarkNode, TextNode, TransactionResult, TreeNode, Window} from './types'

const parser = new Parser(['@[__value__](__meta__)'])

/**
 * These tests exercise the DISPATCHER, so they need any sink that actually commits — the
 * uncontrolled policy, inline: adopt the handoff and accept. The real one lives on the
 * boundary, which this module must not depend on.
 */
function adoptingSink(
	tree: TokenTree,
	parser: () => Parser | undefined,
	onResult?: (result: TransactionResult) => void
): CommitSink {
	return {
		commit(next, window) {
			// HOIST the adoption out of the optional call. `onResult` is optional and one case
			// below builds `adoptingSink(tree, () => undefined)` with none, so
			// `onResult?.(adopt(…))` skips evaluating its argument entirely and the sink never
			// commits.
			const result = adopt(tree, window, parseValue(parser(), next))
			onResult?.(result)
			return true
		},
	}
}

/**
 * Tree + verbs over an adopting sink; `results` is one entry per adoption and `commits`
 * the handoff that produced it — a wrong hull window survives a right value, so a test
 * that commits still has to see both.
 */
function setup(source: string, options: {readOnly?: boolean} = {}) {
	const tree = createTokenTree(parser.parse(source))
	const results: TransactionResult[] = []
	const commits: {next: string; window: Window}[] = []
	let hook: ((result: TransactionResult) => void) | undefined
	const adopting = adoptingSink(
		tree,
		() => parser,
		result => {
			results.push(result)
			hook?.(result)
		}
	)
	const sink: CommitSink = {
		commit(next, window) {
			commits.push({next, window})
			return adopting.commit(next, window)
		},
	}
	const tx = createTransactions({tree, readOnly: () => options.readOnly ?? false, sink})
	const onResult = (fn: (result: TransactionResult) => void): void => {
		hook = fn
	}
	return {tree, tx, results, commits, onResult}
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

	it('applyRange commits a splice that changes nothing', () => {
		const {tree, tx, results, commits} = setup('hello')
		expect(tx.applyRange({start: 2, end: 2, insertedLength: 0}, '')).toBe(true)
		// Pinned, not endorsed: see the no-op note in `dispatch`.
		expect(commits).toEqual([{next: 'hello', window: {start: 2, end: 2, insertedLength: 0}}])
		expect(results).toHaveLength(1)
		expect(tree.value()).toBe('hello')
	})

	it('applyRange reports the sink verdict and leaves committing to the sink', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const {commits, sink} = recordingSink(false)
		const tx = createTransactions({tree, readOnly: () => false, sink})
		expect(tx.applyRange({start: 0, end: 5, insertedLength: 0}, 'x')).toBe(false)
		expect(commits).toHaveLength(1)
		expect(tree.value()).toBe('hello')
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
		expect(tx.applyAfter(tail, 'x')).toBe(false)
		expect(tx.applyStructural(tree.roots()[1], '')).toBe(false)
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

	it('rejects a dead node', () => {
		// A root text node at index 0 can never die under whole-value replacement — the
		// parser always emits a leading text token and middle pairing retains it. Kill a
		// TAIL node instead:
		const {tree, tx} = setup('he@[x](m)llo')
		const node = tree.roots()[2] // text 'llo'
		if (node.kind !== 'text') throw new Error('expected text')
		tx.applyRange({start: 0, end: 12, insertedLength: 0}, 'x') // parses to ONE text token → mark + tail removed
		expect(tx.applyAfter(node, 'x')).toBe(false)
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
		expect(tx.applyAfter(tail, 'Z')).toBe(false)
		expect(tx.applyStructural(mark, 'Z')).toBe(false)
		expect(tree.value()).toBe('plain text here')
	})

	it('throws on re-entrant dispatch', () => {
		const {tx, onResult} = setup('hello')
		onResult(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x'))
		expect(() => tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'y')).toThrow('re-entrant')
	})
})

/**
 * The gate is where the stored selection is brought up to DOM truth, and the reason it is here
 * rather than on a caller is that EVERY verb passes through it: an inline replace and a row split
 * have to record the same caret. See `createTransactions`' `syncSelection`.
 */
describe('transactions: the selection sync', () => {
	function syncing(options: {readOnly?: boolean} = {}) {
		const tree = createTokenTree(parser.parse('hello'))
		const order: string[] = []
		const sink: CommitSink = {
			commit() {
				order.push('commit')
				return true
			},
		}
		const tx = createTransactions({
			tree,
			readOnly: () => options.readOnly ?? false,
			sink,
			syncSelection: () => order.push('sync'),
		})
		return {tx, tree, order}
	}

	it('runs once per verb, before the commit reads the selection', () => {
		const {tx, order} = syncing()
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x')
		expect(order).toEqual(['sync', 'commit'])
	})

	it('covers the node-addressed verbs too, not just a raw range', () => {
		const {tx, tree, order} = syncing()
		tx.applyAfter(tree.roots()[0], 'x')
		tx.applyStructural(tree.roots()[0], 'y')
		expect(order).toEqual(['sync', 'commit', 'sync', 'commit'])
	})

	it('does not run when the verb is refused, so a declined edit moves no caret', () => {
		const {tx, order} = syncing({readOnly: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x')
		expect(order).toEqual([])
	})

	it('does not run on an out-of-bounds range either', () => {
		const {tx, order} = syncing()
		tx.applyRange({start: 3, end: 99, insertedLength: 0}, 'x')
		expect(order).toEqual([])
	})
})

describe('transactions: adopting sink', () => {
	it('the transaction result equals a fresh parse (equivalence through the verb layer)', () => {
		const {tree, tx} = setup('he@[x](m)llo')
		tx.applyRange({start: 2, end: 9, insertedLength: 0}, '')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('hello')))
	})

	it('commits the whole value as one text token when no parser is configured', () => {
		const tree = createTokenTree([createTextToken('a@[x](m)b')])
		const sink = adoptingSink(tree, () => undefined)
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
			tx.applyAfter(tail, '') // no-op splice: reads everything, writes nothing
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

	it('a signal the sink reads while committing subscribes nobody', () => {
		const tree = createTokenTree(parser.parse('hello'))
		const probe = signal({initial: 'a'})
		const sink: CommitSink = {
			commit() {
				probe()
				return true
			},
		}
		const tx = createTransactions({tree, readOnly: () => false, sink})
		let runs = 0
		const stop = effect(() => {
			runs++
			tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'x')
		})
		expect(runs).toBe(1)

		probe('b')
		expect(runs).toBe(1)

		stop()
	})
})