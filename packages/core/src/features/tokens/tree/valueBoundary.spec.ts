import {describe, expect, it} from 'vitest'

import {effect} from '../../../shared/signals'
import {Parser} from '../parser/Parser'
import type {RowConfig} from '../parser/types'
import {createTextToken} from '../parser/utils/createTextToken'
import {snapshot, stripIds} from './__testing__/snapshot'
import {parseRowsValue} from './adopt'
import {offsetOfAnchor} from './anchors'
import {createTransactions} from './transactions'
import {createTokenTree} from './tree'
import type {Anchors, NodeAnchor, TextNode, TransactionResult, TreeNode} from './types'
import type {Boundary} from './valueBoundary'
import {createBoundary} from './valueBoundary'

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

const asText = (node: TreeNode): TextNode => {
	if (node.kind !== 'text') throw new Error('expected text')
	return node
}

const textAnchor = (anchor: NodeAnchor): {node: TextNode; offset: number} => {
	if (typeof anchor === 'string' || !('node' in anchor)) throw new Error('expected a text anchor')
	return anchor
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

	it('the tree projection IS the committed value', () => {
		const {tree, tx} = setup('hello')
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(tree.value()).toBe('Ahello')
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

	it('resolves the CARET through the recorded window, not the gap-derived one', () => {
		// The other half of what the record buys, and the visible one. The id assertion above
		// cannot see it: both windows converge on the same string, so a value-level or
		// structure-level check passes either way.
		//
		// Repeated content again, with the caret BETWEEN the two marks. Deleting the FIRST one
		// should leave the caret where it was — at 0, before the survivor. `gapWindow` cannot
		// tell that deletion from deleting the SECOND (same result string), reads the caret at 7
		// as sitting at the START of a span deleted at 7-14, and leaves it at 7 — which in a
		// 7-character document is the far side of the mark. The user would stop typing before a
		// mention and resume after it.
		const tree = createTokenTree(parser.parse('@[x](m)@[x](m)'))
		const anchor: NodeAnchor = {after: tree.roots()[1]}
		const results: TransactionResult[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => true,
			onChange: () => {},
			selection: () => ({anchor, head: anchor}),
			onResult: result => results.push(result),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		expect(offsetOfAnchor(tree.roots(), anchor)).toBe(7)

		tx.applyRange({start: 0, end: 7, insertedLength: 0}, '')
		boundary.arrive('@[x](m)')

		const landed = results[0].selectionAfter
		expect(landed && offsetOfAnchor(tree.roots(), landed.anchor)).toBe(0)
	})

	it('the tree moves on the arrival, not on the commit', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')
		expect(tree.value()).toBe('hello')
		boundary.arrive('Ahello')
		expect(tree.value()).toBe('Ahello')
	})

	it('a transforming parent still adopts, via a gap-derived window', () => {
		const {tree, boundary, tx} = setup('hello', {controlled: true})
		tx.applyRange({start: 5, end: 5, insertedLength: 0}, 'x')
		boundary.arrive('HELLOX') // parent uppercased — nothing matches lastEmitted
		expect(tree.value()).toBe('HELLOX')
		expect(stripIds(snapshot(tree.roots()))).toEqual(stripIds(parser.parse('HELLOX')))
	})

	it('a transform the parent restructured keeps the tail the gap window claims', () => {
		// This is what GATES the `value` check. Pure controlled mode, so the base still matches
		// and the value is the only thing that can reject the record. The parent PREPENDS a
		// mark, so the parse has two roots more than the tree and left-index pairing cannot
		// stand in for the suffix walk: the gap window's delta (7) lets that walk claim the
		// trailing text node, while the recorded window's stale delta (1) makes it inert and
		// pairs 'tail' with a fresh node two indices along.
		const {tree, boundary, tx} = setup('@[a](m)tail', {controlled: true})
		const tailId = tree.roots()[2].id
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'Z') // emits 'Z@[a](m)tail', records {0,0,1}
		boundary.arrive('@[q](r)@[a](m)tail') // the parent prepended a mark instead
		expect(tree.value()).toBe('@[q](r)@[a](m)tail')
		expect(tree.roots()[4].id).toBe(tailId)
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

	it('an echo whose base moved keeps the repeat the gap window implies, not the recorded one', () => {
		// This is what GATES the `base` check; the 'hello' mode-flip above cannot, because both
		// windows converge there. Repeated content plus a prefix insert makes them disagree:
		// the recorded window {7,14,0} points at the SECOND mark of the base, but the tree has
		// since grown a 'z' in front, so those coordinates now name a different span.
		let controlled = true
		const tree = createTokenTree(parser.parse('@[a](m)@[a](m)'))
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => controlled,
			onChange: () => {},
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		const secondMarkId = tree.roots()[3].id
		tx.applyRange({start: 7, end: 14, insertedLength: 0}, '') // emits '@[a](m)', records window {7,14,0}
		controlled = false
		tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'z') // commits: the tree is 'z@[a](m)@[a](m)'
		boundary.arrive('@[a](m)')
		expect(tree.value()).toBe('@[a](m)')
		expect(tree.roots()[1].id).toBe(secondMarkId)
	})

	it('a rejected emission does not re-arm the record for a later external reset', () => {
		// This is what GATES clearing `lastEmitted` on every arrival. The parent refuses the
		// edit and echoes the base back, so the tree returns to exactly the projection the
		// record was spliced from — a record left armed here would match on BOTH value and
		// base at the next arrival and adopt a much later reset through a long-dead window.
		const {tree, boundary, tx} = setup('@[a](m)@[a](m)', {controlled: true})
		const firstMarkId = tree.roots()[1].id
		tx.applyRange({start: 0, end: 7, insertedLength: 0}, '') // emits '@[a](m)', records window {0,7,0}
		boundary.arrive('@[a](m)@[a](m)') // rejected: back at the base, and the record is spent
		boundary.arrive('@[a](m)') // an external reset, gap-derived: {7,14,0} keeps the FIRST mark
		expect(tree.value()).toBe('@[a](m)')
		expect(tree.roots()[1].id).toBe(firstMarkId)
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

	it('reparse() resolves a captured caret into the node that holds it, not to the document end', () => {
		// Decision D-c's real consequence, and the only guard on the window `reparse` picks:
		// with `gapWindow(v, v)` every offset is at or before `window.start`, so the mapping
		// is an identity. A full window `{0, n, n}` would send every interior offset to
		// `window.start + insertedLength` — the document end — parking the caret there.
		const tree = createTokenTree([createTextToken('a@[x](m)b')])
		const results: TransactionResult[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => false,
			onChange: () => {},
			selection: () => {
				const caret: NodeAnchor = {node: asText(tree.roots()[0]), offset: 1}
				return {anchor: caret, head: caret}
			},
			onResult: result => results.push(result),
		})
		boundary.reparse()
		expect(tree.roots().map(n => n.kind)).toEqual(['text', 'mark', 'text'])
		const after = results[0].selectionAfter
		if (!after) throw new Error('expected a resolved selectionAfter')
		const anchor = textAnchor(after.anchor)
		expect(anchor.node).toBe(tree.roots()[0]) // 'a', not the trailing 'b'
		expect(anchor.offset).toBe(1)
	})

	it('an arrival identical to the current projection is a no-op', () => {
		const {tree, boundary} = setup('a@[x](m)b')
		const ids = tree.roots().map(n => n.id)
		boundary.arrive('a@[x](m)b')
		expect(tree.roots().map(n => n.id)).toEqual(ids)
	})
})

describe('boundary: no-op splices', () => {
	it('emits an unchanged value in both modes', () => {
		// Parity with the pre-S1.6a boundary, measured: the deleted facade's set transform ran
		// before the signal's equality short-circuit, so `replace({start: 2, end: 2}, '')`
		// already fired `onChange('hello')`. Suppression is a user-visible change and
		// would belong in the dispatcher — see the no-op note in `transactions.ts`.
		const uncontrolled = setup('hello')
		expect(uncontrolled.tx.applyRange({start: 2, end: 2, insertedLength: 0}, '')).toBe(true)
		expect(uncontrolled.emitted).toEqual(['hello'])
		expect(uncontrolled.tree.value()).toBe('hello')

		const controlled = setup('hello', {controlled: true})
		expect(controlled.tx.applyRange({start: 2, end: 2, insertedLength: 0}, '')).toBe(true)
		expect(controlled.emitted).toEqual(['hello'])
	})
})

describe('boundary: untracked arrivals', () => {
	it('arrive() and reparse() called inside an effect subscribe that effect to nothing', () => {
		// S1.6a drives both from a props watch. A tracked `tree.value()` read there would
		// subscribe the watcher to the projection the same call is about to mutate — a write
		// loop, not merely a stale read. `value()` is deliberately left tracked.
		const {tree, boundary} = setup('he@[x](m)llo')
		let arrivals = 0
		const stopArrive = effect(() => {
			arrivals++
			boundary.arrive('he@[x](m)llo') // identical to the projection: reads it, writes nothing
		})
		let reparses = 0
		const stopReparse = effect(() => {
			reparses++
			boundary.reparse()
		})
		expect([arrivals, reparses]).toEqual([1, 1])

		asText(tree.roots()[0]).text('QQQ')
		expect([arrivals, reparses]).toEqual([1, 1])

		stopArrive()
		stopReparse()
	})
})

describe('boundary: pre-adoption selection capture (spec D7)', () => {
	/**
	 * What these cases gate since the channel became ANCHORS: that the capture reaches
	 * `adopt` on ALL THREE entries — commit, arrival, reparse — and that it is the
	 * reader's answer that lands in the result. Measured: capturing only on the commit
	 * path reddens the arrival and reparse cases, and nothing else in the core suite
	 * notices.
	 *
	 * They assert through `selectionAfter`, the result's ONLY selection field: it is
	 * non-`undefined` exactly when a capture reached `adopt`, so it gates the three
	 * entries just as the echoed-back capture did — and it additionally pins that the
	 * captured anchor was resolved rather than merely carried.
	 *
	 * What they do NOT gate is the ordering. Anchors carry no coordinate, so a capture
	 * moved after `adopt` reads the SAME anchor — the double-shift is decided one layer
	 * down, where `adopt` turns anchors into offsets, and its gate lives with it in
	 * `adopt.spec.ts`'s "forms the offsets BEFORE adoption rewrites the positions they
	 * read". `{before: mark}` is kept over a text anchor for exactly that reason: it is
	 * the shape whose offset adoption moves ([2,9] → [3,10] under an insert at 0).
	 */
	function captureSetup(source: string, options: {controlled?: boolean; selection?: () => Anchors | undefined} = {}) {
		const tree = createTokenTree(parser.parse(source))
		const results: TransactionResult[] = []
		const boundary = createBoundary({
			tree,
			parser: () => parser,
			controlled: () => options.controlled === true,
			onChange: () => {},
			selection:
				options.selection ??
				(() => {
					const anchor: NodeAnchor = {before: tree.roots()[1]}
					return {anchor, head: anchor}
				}),
			onResult: result => results.push(result),
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		return {tree, boundary, tx, results}
	}

	it('captures at a COMMIT, naming a node whose position adoption then moves', () => {
		const {tree, tx, results} = captureSetup('ab@[x](m)cd')
		const mark = tree.roots()[1]
		expect(mark.position.start).toBe(2)

		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'Z')).toBe(true)

		expect(mark.position.start).toBe(3) // adoption moved it; the capture named it at 2
		const landed: Anchors = {
			anchor: {node: asText(tree.roots()[0]), offset: 3},
			head: {node: asText(tree.roots()[0]), offset: 3},
		}
		expect(results[0].selectionAfter).toEqual(landed)
	})

	it('captures at an ARRIVAL too — the only entry the controlled path repairs from', () => {
		const {tree, boundary, results} = captureSetup('ab@[x](m)cd', {controlled: true})
		const mark = tree.roots()[1]
		boundary.arrive('Zab@[x](m)cd')
		expect(mark.position.start).toBe(3)
		const landed: Anchors = {
			anchor: {node: asText(tree.roots()[0]), offset: 3},
			head: {node: asText(tree.roots()[0]), offset: 3},
		}
		expect(results[0].selectionAfter).toEqual(landed)
	})

	it('captures at a reparse', () => {
		const {tree, results, boundary} = captureSetup('ab@[x](m)cd')
		boundary.reparse()
		// No edit, so the capture's offset (the mark's start, 2) maps to itself — the text
		// node before the mark, at its end.
		const landed: Anchors = {
			anchor: {node: asText(tree.roots()[0]), offset: 2},
			head: {node: asText(tree.roots()[0]), offset: 2},
		}
		expect(results[0].selectionAfter).toEqual(landed)
	})

	it('is undefined when the injected reader answers undefined', () => {
		// NOT DISCRIMINATING: `selectionAfter` is `undefined` before the channel exists, so
		// this passes against unmodified code too. It is a null-case regression guard, not a
		// gate. Built on `captureSetup` (with the reader overridden) rather than the file's
		// shared `setup`, which registers no `onResult` at all.
		const {tx, results} = captureSetup('hello', {selection: () => undefined})
		expect(tx.applyRange({start: 0, end: 0, insertedLength: 0}, 'A')).toBe(true)
		expect(results[0].selectionAfter).toBeUndefined()
	})
})

describe('boundary: a separator adopts rows (issue 08)', () => {
	function blockSetup(source: string, rowConfig: () => RowConfig | undefined) {
		const tree = createTokenTree(parseRowsValue(undefined, source, {separator: '\n\n'}))
		const boundary = createBoundary({
			tree,
			parser: () => undefined,
			rowConfig,
			controlled: () => false,
			onChange: () => {},
		})
		const tx = createTransactions({tree, readOnly: () => false, sink: boundary.sink})
		return {tree, boundary, tx}
	}

	it('adopts rows only — the block top level is RowNodes, trailing empty row included', () => {
		const {tree, tx} = blockSetup('aaa\n\nbbb\n\n', () => ({separator: '\n\n'}))
		expect(tree.roots().map(n => n.kind)).toEqual(['row', 'row', 'row'])

		expect(tx.applyRange({start: 1, end: 1, insertedLength: 0}, 'X')).toBe(true)

		expect(tree.roots().map(n => n.kind)).toEqual(['row', 'row', 'row'])
		expect(tree.value()).toBe('aXaa\n\nbbb\n\n')
		expect(stripIds(snapshot(tree.roots()))).toEqual(
			parseRowsValue(undefined, 'aXaa\n\nbbb\n\n', {separator: '\n\n'})
		)
	})

	it('an empty row keeps ONE empty text child — its caret target', () => {
		const {tree} = blockSetup('\n\nbbb\n\n', () => ({separator: '\n\n'}))
		const row = tree.roots()[0]
		if (row.kind !== 'row') throw new Error('expected a row')
		expect(row.children().map(n => n.kind)).toEqual(['text'])
		expect(row.children()[0].position).toEqual({start: 0, end: 0})
	})

	it('dropping the separator reparses the same value to the flat shape', () => {
		const {tree, boundary} = blockSetup('aaa\n\nbbb\n\n', () => undefined)
		// The tree was BUILT as rows; the first rowless adoption restores the flat parse,
		// which is exactly what leaving block layout must do.
		boundary.reparse()
		expect(tree.roots().map(n => n.kind)).toEqual(['text'])
	})

	it('the projection is identical either way — the separator is literal text in both', () => {
		const block = blockSetup('aaa\n\nbbb\n\n', () => ({separator: '\n\n'}))
		const inline = blockSetup('aaa\n\nbbb\n\n', () => undefined)
		inline.boundary.reparse()
		expect(block.tree.value()).toBe(inline.tree.value())
	})
})