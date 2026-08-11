import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import {Parser} from '../parser/Parser'
import type {Token} from '../parser/types'
import {toString} from '../parser/utils/toString'
import {snapshot, stripIds} from './__testing__/snapshot'
import {adopt} from './adopt'
import {gapWindow} from './gapWindow'
import {createTokenTree} from './tree'
import type {Id, NodeAnchor, TreeNode, Window} from './types'

/**
 * The property gates for `adopt` (spec §7.1). Every generated case is a document
 * plus ONE edit; each property below states what must hold of the adoption of
 * `parse(next)` into a tree built from `parse(source)`.
 *
 * `**__value__**` is a VALUE markup on purpose. A second SLOT markup makes the
 * parser emit inverted child ranges on inputs like `#[#[]**]**`, and no tree-layer
 * property can hold for a source the parser already loses (see `buildCases`).
 */
const markups = ['@[__value__](__meta__)', '#[__slot__]', '**__value__**'] as const
const parser = new Parser([...markups])

const BASE_SEED = 9_082_026
/** Spec §7.1 asks for high iteration; the five properties together cost ~45 ms at 500. */
const ITERATIONS = 500

interface Case {
	seed: number
	source: string
	start: number
	end: number
	text: string
	next: string
}

const label = (c: Case): string =>
	`seed=${c.seed} src=${JSON.stringify(c.source)} edit={${c.start},${c.end},${JSON.stringify(c.text)}} next=${JSON.stringify(c.next)}`

const windowOf = (c: Case): Window => ({start: c.start, end: c.end, insertedLength: c.text.length})

function randomPart(): string {
	// One roll, not chained boolean else-ifs: oxlint no-dupe-else-if fires on the
	// duplicated condition text otherwise (denyWarnings: true).
	const roll = faker.number.int({min: 0, max: 3})
	if (roll === 0) return faker.string.alpha({length: {min: 0, max: 8}})
	if (roll === 1) return `@[${faker.string.alpha(3)}](${faker.string.alpha(2)})`
	if (roll === 2) return `#[${faker.string.alpha({length: {min: 0, max: 5}})}]`
	return `**${faker.string.alpha(4)}**`
}

/**
 * Segments are drawn WITH REPETITION from a small pool, so identical content
 * recurs. That is the adversarial class the two window bounds exist for: content
 * repeating with the deleted span's own period keeps matching past the edit, so
 * an unbounded walk consumes tokens whose bytes lie inside it and lands the
 * removal on the wrong repeat. A pool of distinct random segments never produces
 * the case, and the identity property below then catches neither dropped bound.
 */
function randomDocument(): {value: string; segments: {start: number; end: number}[]} {
	const pool = Array.from({length: faker.number.int({min: 1, max: 3})}, randomPart)
	const parts: string[] = []
	for (let i = 0; i < faker.number.int({min: 1, max: 6}); i++) parts.push(faker.helpers.arrayElement(pool))
	const segments: {start: number; end: number}[] = []
	let at = 0
	for (const part of parts) {
		segments.push({start: at, end: at + part.length})
		at += part.length
	}
	return {value: parts.join(''), segments}
}

/** Inserted text: plain words, bare markup punctuation (breaks/completes markups), whole marks. */
function randomInsert(): string {
	const roll = faker.number.int({min: 0, max: 5})
	if (roll === 0) return ''
	if (roll === 1) return faker.string.alpha({length: {min: 1, max: 4}})
	if (roll === 2) return faker.helpers.arrayElement(['*', '**', '[', ']', '(', ')', '#[', '@[', '](', ')]'])
	if (roll === 3) return `@[${faker.string.alpha(2)}](${faker.string.alpha(2)})`
	if (roll === 4) return `#[${faker.string.alpha({length: {min: 0, max: 3}})}]`
	return `**${faker.string.alpha(2)}**`
}

/**
 * Deterministic corpus, one case per accepted seed.
 *
 * Both the source and the edited value are gated on `toString(parse(s)) === s`:
 * the parser does NOT round-trip on every input (pre-existing defect, out of scope
 * here), and a tree-layer property cannot hold for a string the parse already
 * loses. Measured 0 rejections over these 500 seeds — the gate guards the next
 * widening of the markup set or the insert alphabet, it is not load-bearing today.
 *
 * One edit in three replaces a WHOLE generated segment. Combined with the repeating
 * pool above that is the AC-3.1 shape (delete exactly one of N identical marks), and
 * it is what makes the identity property notice a dropped prefix bound.
 */
function buildCases(count: number): Case[] {
	const cases: Case[] = []
	for (let seed = BASE_SEED; cases.length < count; seed++) {
		faker.seed(seed)
		const {value: source, segments} = randomDocument()
		if (toString(parser.parse(source)) !== source) continue
		const segment = faker.number.int({min: 0, max: 2}) === 0 ? faker.helpers.arrayElement(segments) : undefined
		const start = segment ? segment.start : faker.number.int({min: 0, max: source.length})
		const end = segment ? segment.end : faker.number.int({min: start, max: source.length})
		const text = segment && faker.datatype.boolean() ? '' : randomInsert()
		const next = source.slice(0, start) + text + source.slice(end)
		if (toString(parser.parse(next)) !== next) continue
		cases.push({seed, source, start, end, text, next})
	}
	return cases
}

const CASES = buildCases(ITERATIONS)

/**
 * Non-vacuity guard: a property that never meets the situation it describes is
 * decoration. Each property counts the occurrences its clauses depend on and runs
 * them past this floor, so a generator that drifts away from the interesting shapes
 * fails loudly instead of going quiet.
 */
const expectCoverage = (seen: Record<string, number>, floor: number): void => {
	expect(Object.entries(seen).filter(([, count]) => count < floor)).toEqual([])
}

/**
 * Truncated failure report that still carries scale: comparing the first ten alone
 * makes a one-case regression and a four-hundred-case one print identically.
 */
const expectNoFailures = (failures: readonly string[]): void => {
	expect({count: failures.length, first: failures.slice(0, 10)}).toEqual({count: 0, first: []})
}

const idsOf = (nodes: readonly TreeNode[], into: Id[] = []): Id[] => {
	for (const node of nodes) {
		into.push(node.id)
		if (node.kind === 'mark') idsOf(node.children(), into)
	}
	return into
}

/** Per id, everything a signal write on that node could change: text, or value+meta. */
const record = (nodes: readonly TreeNode[], into = new Map<Id, string>()): Map<Id, string> => {
	for (const node of nodes) {
		into.set(node.id, node.kind === 'text' ? node.text() : JSON.stringify([node.value(), node.meta()]))
		if (node.kind === 'mark') record(node.children(), into)
	}
	return into
}

/**
 * Independent mirror of `snapshotNodeEquals` over two PARSED streams — the tree is
 * not involved, so the reference walks below are derived from the parser alone.
 *
 * The duplication IS the point — do not "de-duplicate" it onto `snapshotNodeEquals`:
 * reusing adoption's own predicate would mirror any defect in it on both sides of
 * the walk-positions property, and that property is what catches a prefix-bound
 * off-by-one. Keep the two in sync by hand: a field compared in `adoptUtils.ts` and
 * not here (or the reverse) skews the reference runs in one direction.
 */
function tokensEqualShifted(a: Token, b: Token, delta: number): boolean {
	if (a.type !== b.type || a.content !== b.content) return false
	if (a.position.start + delta !== b.position.start || a.position.end + delta !== b.position.end) return false
	if (a.type !== 'mark' || b.type !== 'mark') return true
	if (a.descriptor !== b.descriptor || a.value !== b.value || a.meta !== b.meta) return false
	if (a.slot && b.slot && (a.slot.start + delta !== b.slot.start || a.slot.end + delta !== b.slot.end)) return false
	if (a.children.length !== b.children.length) return false
	return a.children.every((child, index) => tokensEqualShifted(child, b.children[index], delta))
}

/**
 * The two window-bounded runs of spec §4.2, re-derived from the fresh parses of
 * `source` and `next`. These are the nodes adoption is REQUIRED to keep: the middle
 * region between them is best-effort continuity (§4.2 step 3) and is deliberately
 * not claimed here.
 *
 * A deliberate re-implementation of `adopt`'s two walks, not a shortcut to them:
 * calling into `adopt.ts` would make the property restate the implementation. Keep
 * it in sync with steps 1 and 2 there — if the shipped walks change their bounds,
 * this must change with them or the property starts gating a contract nobody holds.
 */
function referenceRuns(source: readonly Token[], next: readonly Token[], window: Window, delta: number) {
	let prefix = 0
	while (
		prefix < source.length &&
		prefix < next.length &&
		source[prefix].position.end <= window.start &&
		tokensEqualShifted(source[prefix], next[prefix], 0)
	) {
		prefix++
	}
	let sourceTail = source.length - 1
	let nextTail = next.length - 1
	const suffix: number[] = []
	while (
		sourceTail >= prefix &&
		nextTail >= prefix &&
		source[sourceTail].position.start >= window.end &&
		tokensEqualShifted(source[sourceTail], next[nextTail], delta)
	) {
		suffix.unshift(sourceTail)
		sourceTail--
		nextTail--
	}
	return {prefix, suffix, suffixOutIndex: nextTail + 1}
}

describe('adopt property: output equivalence', () => {
	it('reproduces a fresh parse of the edited value for every generated edit', () => {
		// This property has no conditional clause, so its floor is on the corpus instead:
		// a generator drifting to no-op edits satisfies "output equals a fresh parse" with
		// adoption doing nothing at all.
		const seen = {editedValues: 0, structuralAdoptions: 0}
		for (const c of CASES) {
			const tree = createTokenTree(parser.parse(c.source))
			const result = adopt(tree, windowOf(c), parser.parse(c.next))
			if (c.next !== c.source) seen.editedValues++
			if (result.structural) seen.structuralAdoptions++
			expect(stripIds(snapshot(tree.roots())), label(c)).toEqual(stripIds(parser.parse(c.next)))
			expect(tree.value(), label(c)).toBe(c.next)
		}
		// Measured 481 edited values and 355 structural adoptions out of 500 cases.
		expectCoverage(seen, 100)
	})
})

describe('adopt property: feed accounting', () => {
	/**
	 * Every id in the resulting tree is accounted for by the feeds, every id that left
	 * is reported, and every observable change to a surviving node reaches the feed
	 * that owns it. Immune to the unbounded-slot-pairing deviation (§4.2): that
	 * deviation picks the WRONG node to drop, it never drops one silently.
	 */
	it('accounts for every id and every change through the feeds', () => {
		const failures: string[] = []
		const seen = {contentChanges: 0, removals: 0, additions: 0}
		for (const c of CASES) {
			const tree = createTokenTree(parser.parse(c.source))
			const before = record(tree.roots())
			const result = adopt(tree, windowOf(c), parser.parse(c.next))
			const afterList = idsOf(tree.roots())
			const after = record(tree.roots())
			// `added` carries subtree ROOTS (D9), so an added mark's children are new too.
			const added = new Set(idsOf(result.added.map(change => change.node)))
			const removed = new Set(result.removed)
			const updated = new Set(result.updated.map(node => node.id))
			seen.removals += removed.size
			seen.additions += added.size

			if (afterList.length !== after.size) failures.push(`${label(c)} — duplicate id in the result`)
			for (const id of removed) {
				if (after.has(id)) failures.push(`${label(c)} — removed id ${id} is still in the tree`)
				if (!before.has(id)) failures.push(`${label(c)} — removed id ${id} was never in the tree`)
			}
			for (const id of afterList) {
				if (!before.has(id) && !added.has(id)) failures.push(`${label(c)} — id ${id} arrived unannounced`)
			}
			for (const id of before.keys()) {
				if (!after.has(id) && !removed.has(id)) failures.push(`${label(c)} — id ${id} vanished unreported`)
			}
			for (const change of result.added) {
				if (before.has(change.node.id)) failures.push(`${label(c)} — added id ${change.node.id} is not new`)
			}
			for (const id of updated) {
				if (!before.has(id) || !after.has(id)) failures.push(`${label(c)} — feed id ${id} did not survive`)
			}

			for (const [id, content] of after) {
				const was = before.get(id)
				if (was === undefined) continue
				// `updated` owns the signal writes: a retained node whose text (or value/meta)
				// changed must be listed, and a node that changed nothing must not be.
				if ((content !== was) !== updated.has(id)) {
					failures.push(`${label(c)} — id ${id}: updated=${updated.has(id)} for a content change`)
				}
				if (content !== was) seen.contentChanges++
			}
		}
		expectNoFailures(failures)
		// Measured 441 content changes, 712 removals, 317 additions.
		expectCoverage(seen, 100)
	})
})

describe('adopt property: identity outside the window', () => {
	/**
	 * Identity OUTSIDE the window (spec §7.1), stated constructively.
	 *
	 * The selector is the pair of window-bounded runs themselves, recomputed here from the
	 * parses: prefix nodes must not move at all, suffix nodes must move by exactly delta,
	 * and neither may be reported removed. Nothing in the RESULT can play that role — the
	 * middle region writes fresh parser positions no run claims, and no feed reports moves.
	 *
	 * ONE-SIDED, and that leaves one mutation ungated by this whole file. The claim is
	 * that adoption retains AT LEAST the reference runs; §7.1 deliberately grants
	 * nothing about window-overlapping nodes, so OVER-retention — a walk running past
	 * its bound and keeping a node the window touched — is invisible to every property
	 * here. Deleting the suffix bound (`prev[prevTail].position.start >= window.end`)
	 * keeps all five green at 6000 iterations. Its only gate is the fixture 'deleting
	 * across the first two of three identical marks kills the second (suffix bound)' in
	 * adopt.spec.ts: that fixture is NOT redundant with this suite.
	 */
	it('keeps ids and walk positions for the nodes the prefix and suffix walks retain', () => {
		const failures: string[] = []
		const seen = {prefixNodes: 0, suffixNodes: 0}
		for (const c of CASES) {
			const sourceTokens = parser.parse(c.source)
			const nextTokens = parser.parse(c.next)
			const window = windowOf(c)
			const delta = c.text.length - (c.end - c.start)
			const runs = referenceRuns(sourceTokens, nextTokens, window, delta)
			const tree = createTokenTree(sourceTokens)
			const before = tree.roots().map(node => ({id: node.id, start: node.position.start, end: node.position.end}))
			const result = adopt(tree, window, nextTokens)
			const after = tree.roots()
			const removed = new Set(result.removed)
			seen.prefixNodes += runs.prefix
			seen.suffixNodes += runs.suffix.length

			for (let index = 0; index < runs.prefix; index++) {
				const was = before[index]
				// `.at` keeps the lookup typed as possibly-undefined: adoption may return
				// FEWER roots than it was given, and a missing node is the failure to report.
				const node = after.at(index)
				if (node?.id !== was.id) {
					failures.push(`${label(c)} — prefix root ${index}: id ${String(node?.id)} ≠ ${was.id}`)
					continue
				}
				if (node.position.start !== was.start || node.position.end !== was.end) {
					failures.push(`${label(c)} — prefix root ${index}: moved to ${node.position.start}`)
				}
				if (removed.has(was.id)) failures.push(`${label(c)} — prefix root ${index} reported removed`)
			}

			runs.suffix.forEach((sourceIndex, offset) => {
				const was = before[sourceIndex]
				const node = after.at(runs.suffixOutIndex + offset)
				if (node?.id !== was.id) {
					failures.push(`${label(c)} — suffix root ${sourceIndex}: id ${String(node?.id)} ≠ ${was.id}`)
					return
				}
				if (node.position.start !== was.start + delta || node.position.end !== was.end + delta) {
					failures.push(
						`${label(c)} — suffix root ${sourceIndex}: at ${node.position.start}, want ${was.start + delta}`
					)
				}
				if (removed.has(was.id)) failures.push(`${label(c)} — suffix root ${sourceIndex} reported removed`)
			})
		}
		expectNoFailures(failures)
		// Measured 1039 prefix nodes and 537 suffix nodes; both runs are empty for an edit
		// that touches the whole document, so a generator drifting that way retires this.
		expectCoverage(seen, 100)
	})
})

describe('adopt property: map', () => {
	/**
	 * Totality plus the shift contract (spec D7). Monotonicity is asserted over the
	 * ANCHORABLE answers only, and that restriction is forced by spec §2.3, not by
	 * convenience: an offset inside a mark's markup punctuation ('#[' of '#[Nkl]') has
	 * no anchor, so `anchorAt` answers with the mark's trailing boundary. Reading that
	 * boundary as a global offset jumps forward and then back when the next offset
	 * lands in the slot. Every anchorable answer is pinned to an exact position
	 * instead, which is strictly stronger than monotonicity over that subsequence.
	 */
	it('answers a resolvable, in-range anchor for every pre-edit offset', () => {
		const failures: string[] = []
		const seen = {anchorable: 0, markInterior: 0}
		for (const c of CASES) {
			const tree = createTokenTree(parser.parse(c.source))
			const window = windowOf(c)
			const delta = c.text.length - (c.end - c.start)
			const result = adopt(tree, window, parser.parse(c.next))
			const roots = tree.roots()
			const live = new Set(idsOf(roots))
			const documentEnd = roots.length > 0 ? roots[roots.length - 1].position.end : 0
			/**
			 * {node, offset} → node.position.start + offset; {before}/{after} → the node's
			 * start/end. Deliberately NOT `offsetOfAnchor`: a property gated by the production
			 * function it tests is circular. Do not deduplicate.
			 */
			const resolve = (anchor: NodeAnchor): {position: number; anchorable: boolean; node?: TreeNode} => {
				if (anchor === 'start') return {position: 0, anchorable: true}
				if (anchor === 'end') return {position: documentEnd, anchorable: true}
				if ('node' in anchor) {
					return {position: anchor.node.position.start + anchor.offset, anchorable: true, node: anchor.node}
				}
				if ('before' in anchor) {
					return {position: anchor.before.position.start, anchorable: false, node: anchor.before}
				}
				return {position: anchor.after.position.end, anchorable: false, node: anchor.after}
			}

			let previous = -1
			for (let offset = 0; offset <= c.source.length; offset++) {
				const {position, anchorable, node} = resolve(result.map(offset))
				if (node && !live.has(node.id)) failures.push(`${label(c)} — offset ${offset}: anchor node is dead`)
				if (position < 0 || position > c.next.length) {
					failures.push(`${label(c)} — offset ${offset}: ${position} outside [0, ${c.next.length}]`)
				}
				seen[anchorable ? 'anchorable' : 'markInterior']++
				if (!anchorable) continue
				if (position < previous) {
					failures.push(`${label(c)} — offset ${offset}: ${position} < previous ${previous}`)
				}
				previous = position
				// Outside the window the mapping is a pure shift; at or inside it the offset
				// collapses to the end of the inserted text (RIGHT affinity, plan decision D-a).
				const want = offset < c.start ? offset : offset >= c.end ? offset + delta : c.start + c.text.length
				if (position !== want) {
					failures.push(`${label(c)} — offset ${offset}: ${position}, want ${want}`)
				}
			}
		}
		expectNoFailures(failures)
		// Measured 6269 anchorable answers against 4036 markup-interior ones: the exact-
		// position clause only bites on the former, the excluded set is the latter.
		expectCoverage(seen, 500)
	})
})

describe('adopt property: gap-vs-exact agreement', () => {
	/**
	 * Spec §7.1: snapshot equality for ALL edits, id-level agreement only under the
	 * constructive predicate (both windows replace and insert byte-identical spans).
	 * The two trees have independent id allocators, so the comparable datum is the
	 * DECISION pattern — which position kept a pre-existing id and which got a fresh
	 * one — captured against each tree's own pre-adoption id set. The pattern walks the
	 * WHOLE tree in document order, not just the roots: the slot recursion makes its
	 * own retention decisions, and a divergence confined to in-slot children would
	 * otherwise leave both root patterns identical.
	 */
	it('adopting through gapWindow matches adopting through the exact op window', () => {
		const failures: string[] = []
		let compared = 0
		for (const c of CASES) {
			const exact = createTokenTree(parser.parse(c.source))
			const exactBefore = new Set(idsOf(exact.roots()))
			adopt(exact, windowOf(c), parser.parse(c.next))

			const gap = createTokenTree(parser.parse(c.source))
			const gapBefore = new Set(idsOf(gap.roots()))
			const derived = gapWindow(c.source, c.next)
			adopt(gap, derived, parser.parse(c.next))

			expect(stripIds(snapshot(gap.roots())), label(c)).toEqual(stripIds(snapshot(exact.roots())))

			const sameSpans =
				c.source.slice(c.start, c.end) === c.source.slice(derived.start, derived.end) &&
				c.text === c.next.slice(derived.start, derived.start + derived.insertedLength)
			if (!sameSpans) continue
			compared++
			const pattern = (roots: readonly TreeNode[], born: Set<Id>): string =>
				idsOf(roots)
					.map(id => (born.has(id) ? 'kept' : 'fresh'))
					.join(',')
			const gapPattern = pattern(gap.roots(), gapBefore)
			const exactPattern = pattern(exact.roots(), exactBefore)
			if (gapPattern !== exactPattern) {
				failures.push(`${label(c)} — gap ${gapPattern} ≠ exact ${exactPattern}`)
			}
		}
		expectNoFailures(failures)
		// The predicate holds for 451 of 500 cases; a regression that silences it would
		// otherwise make the id-level clause above quietly vacuous.
		expect(compared).toBeGreaterThan(ITERATIONS / 2)
	})
})