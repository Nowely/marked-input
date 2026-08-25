import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import type {RowNode, TreeNode} from './types'

/**
 * THE gate for the mover, and the reason it is a property rather than a table: a placement has
 * two independent coordinates, so a nested document has one case per (row, parent, index) triple
 * and the interesting ones are those nobody thinks to write down — a row moved under its own
 * former sibling, a subtree outdented past the document's end, a placement one index past the
 * last child, a parent inside what is being moved.
 *
 * Every generated document is enumerated EXHAUSTIVELY, legal placements and illegal ones alike.
 * Four oracles, and no two of them imply each other:
 *
 * 1. THE TREE, not the string. A value round-trip is structurally blind to nesting — `[A, B]` and
 *    `[A[B]]` join to the same bytes — so the shape oracle is an id tree built independently, by
 *    splicing the pre-move shape, and compared against the one the document now holds.
 * 2. THE OBJECTS — every node, not only the rows. Ids are minted at node birth and never reused,
 *    so a matching id tree already says no ROW was re-minted; the map lookup beside it says the
 *    same of the objects themselves and of the inline children inside them, which is where a
 *    re-parenting verb loses identity when it pairs in-slot children by index. A mover that emits
 *    the right bytes while rebuilding the nodes takes the caret, the DOM element and every
 *    consumer subscription keyed on `node.id` with it, and no string-level assertion sees that.
 * 3. THE BYTES, projected from the intended tree by a walk that never calls the mover's own
 *    emitter: each row's line is sliced out of the ORIGINAL value, and only a MOVED row's lead is
 *    recomputed.
 * 4. THE POSITIONS. `value()` joins the nodes and reads no position at all, so a splice that left
 *    the coordinates wrong emits a perfect string — and every anchor, every caret repair and
 *    every subsequent splice then addresses the wrong bytes. The lines must tile the value in
 *    pre-order and each row's span must cover its whole subtree.
 *
 * Row bodies are drawn WITH REPETITION from a small pool, so byte-identical rows — and whole
 * byte-identical documents — recur by construction. That is the adversarial class the identity
 * channel exists for: a permutation of identical rows leaves the string unchanged, so nothing in
 * the bytes distinguishes it from a refusal.
 */

const SEPARATOR = '\n'
const INDENT = '\t'
const heading: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}

/** Repetition on purpose, one TYPED body, and one EMPTY body — an empty row takes no children. */
const BODIES = ['alpha', 'beta', 'alpha', '# head', ''] as const

const BASE_SEED = 25_082_026
const DOCUMENTS = 24

/** A row as the generator means it, before any parse has seen it. */
type Draft = {body: string; rows: Draft[]}

function buildDrafts(count: number, depth: number): Draft[] {
	return Array.from({length: count}, () => {
		const body = faker.helpers.arrayElement(BODIES)
		// An empty row takes no children (`RowScanner`'s clamp), so the generator never gives it
		// any: the parse would promote them and the document would not be the one generated.
		const children = body === '' || depth === 2 ? 0 : faker.number.int({min: 0, max: 2})
		return {body, rows: buildDrafts(children, depth + 1)}
	})
}

function render(drafts: readonly Draft[], depth = 0): string[] {
	return drafts.flatMap(draft => [INDENT.repeat(depth) + draft.body, ...render(draft.rows, depth + 1)])
}

const DOCS = Array.from({length: DOCUMENTS}, (_, index) => {
	faker.seed(BASE_SEED + index)
	return render(buildDrafts(faker.number.int({min: 2, max: 4}), 0)).join(SEPARATOR)
})

function store(value: string): Store {
	const created = new Store()
	created.props.set({defaultValue: value, separator: SEPARATOR, Mark: () => null, options: [heading]})
	created.host.container(document.createElement('div'))
	return created
}

const rootRows = (created: Store): RowNode[] =>
	created.tokens.nodes().filter((node): node is RowNode => node.kind === 'row')

const preorder = (rows: readonly RowNode[]): RowNode[] => rows.flatMap(row => [row, ...preorder(row.rows())])

/** EVERY node, inline children included: a moved row's text child is identity too. */
const everyNode = (nodes: readonly TreeNode[]): TreeNode[] =>
	nodes.flatMap(node => [node, ...(node.kind === 'text' ? [] : everyNode(node.children()))])

/** The row tree as ids alone — the shape claim and the identity claim in one comparable value. */
type Shape = {id: number; rows: Shape[]}
const shapeOf = (rows: readonly RowNode[]): Shape[] => rows.map(row => ({id: row.id, rows: shapeOf(row.rows())}))

/** A placement, addressed by PRE-ORDER INDEX so it survives being replayed on a fresh document. */
type Case = {value: string; moved: number; parent: number | null; index: number; label: string}

function casesOf(value: string): Case[] {
	const rows = preorder(rootRows(store(value)))
	const cases: Case[] = []
	for (const [moved, row] of rows.entries()) {
		for (const parent of [null, ...rows.keys()]) {
			const siblings = (
				parent === null ? rows.filter(candidate => !hasParent(rows, candidate)) : rows[parent].rows()
			).filter(candidate => candidate !== row)
			for (let index = 0; index <= siblings.length; index++) {
				cases.push({
					value,
					moved,
					parent,
					index,
					label: `${JSON.stringify(value)} — row ${moved} → ${parent === null ? 'root' : `row ${parent}`} at ${index}`,
				})
			}
		}
	}
	return cases
}

const hasParent = (rows: readonly RowNode[], row: RowNode): boolean =>
	rows.some(candidate => candidate.rows().includes(row))

const CASES = DOCS.flatMap(casesOf)

/**
 * Is this placement expressible at all — asked of the ENCODING, not of the planner. Three rules,
 * each with a source outside the mover: a row cannot become its own descendant, because no
 * document expresses that; an empty row takes no children (`RowScanner`'s own clamp), so nothing
 * can be placed under one; and a row already sitting there is not a move.
 */
function legal(created: Store, moved: RowNode, parent: RowNode | null, index: number): boolean {
	if (parent !== null && preorder([moved]).includes(parent)) return false
	if (parent?.lead() === '' && parent.option() === undefined && parent.slot() === '') return false
	const siblings = parent === null ? rootRows(created) : parent.rows()
	return siblings.indexOf(moved) !== index
}

/** What a case looks like once it is bound to a live document. */
function resolve(entry: Case): {created: Store; moved: RowNode; parent: RowNode | null} {
	const created = store(entry.value)
	const rows = preorder(rootRows(created))
	return {created, moved: rows[entry.moved], parent: entry.parent === null ? null : rows[entry.parent]}
}

/** The intended tree: the pre-move shape with one subtree detached and re-attached. */
function relocate(shape: readonly Shape[], id: number, parent: number | null, index: number): Shape[] {
	let cut: Shape | undefined
	const detach = (rows: readonly Shape[]): Shape[] =>
		rows.flatMap(row => {
			if (row.id !== id) return [{id: row.id, rows: detach(row.rows)}]
			cut = row
			return []
		})
	const rest = detach(shape)
	if (!cut) throw new Error('the moved row is not in the shape')
	const moved = cut
	if (parent === null) return [...rest.slice(0, index), moved, ...rest.slice(index)]
	const attach = (rows: readonly Shape[]): Shape[] =>
		rows.map(row =>
			row.id === parent
				? {id: row.id, rows: [...row.rows.slice(0, index), moved, ...row.rows.slice(index)]}
				: {id: row.id, rows: attach(row.rows)}
		)
	return attach(rest)
}

/** The bytes the intended tree projects, with only the MOVED rows re-indented. */
function project(
	shape: readonly Shape[],
	lines: ReadonlyMap<number, {lead: string; body: string}>,
	moved: ReadonlySet<number>,
	depth = 0
): string[] {
	return shape.flatMap(row => {
		const line = lines.get(row.id)
		if (!line) throw new Error(`no captured line for row ${row.id}`)
		return [
			(moved.has(row.id) ? INDENT.repeat(depth) : line.lead) + line.body,
			...project(row.rows, lines, moved, depth + 1),
		]
	})
}

/** Oracle 4: the lines tile the value in pre-order, and a row's span covers its whole subtree. */
function expectPositionsTile(rows: readonly RowNode[], lines: readonly string[], label: string): void {
	const flat = preorder(rows)
	let at = 0
	for (const [index, row] of flat.entries()) {
		expect(row.lineRange().start, label).toBe(at)
		at += lines[index].length + (index === flat.length - 1 ? 0 : SEPARATOR.length)
		expect(row.lineRange().end, label).toBe(at)
		expect(row.position.end, label).toBe(preorder([row]).at(-1)?.lineRange().end)
	}
}

describe('move: a placement lands the subtree, or is refused', () => {
	it('re-parses to the intended tree, keeping every row object, for every legal placement', () => {
		let ran = 0
		for (const entry of CASES) {
			const {created, moved, parent} = resolve(entry)
			if (!legal(created, moved, parent, entry.index)) continue
			ran++

			const rows = preorder(rootRows(created))
			const before = shapeOf(rootRows(created))
			const objects = new Map(everyNode(rootRows(created)).map(node => [node.id, node]))
			const lines = new Map(
				rows.map((row, at) => {
					const {start, end} = row.lineRange()
					const line = entry.value.slice(start, end - (at === rows.length - 1 ? 0 : SEPARATOR.length))
					return [row.id, {lead: row.lead(), body: line.slice(row.lead().length)}]
				})
			)
			const subtree = new Set(preorder([moved]).map(row => row.id))
			const expected = relocate(before, moved.id, parent?.id ?? null, entry.index)
			const projected = project(expected, lines, subtree)

			expect(moved.moveTo({parent, index: entry.index}), entry.label).toBe(true)

			expect(created.tokens.value(), entry.label).toBe(projected.join(SEPARATOR))
			const after = rootRows(created)
			expect(shapeOf(after), entry.label).toEqual(expected)
			for (const node of everyNode(after)) expect(objects.get(node.id), entry.label).toBe(node)
			expectPositionsTile(after, projected, entry.label)
		}
		// The enumeration is the test: a filter that quietly stops matching would leave this
		// green over nothing at all.
		expect(ran).toBeGreaterThan(1000)
	})

	it('refuses every illegal placement without touching the document', () => {
		let ran = 0
		for (const entry of CASES) {
			const {created, moved, parent} = resolve(entry)
			if (legal(created, moved, parent, entry.index)) continue
			ran++

			const before = shapeOf(rootRows(created))

			expect(moved.moveTo({parent, index: entry.index}), entry.label).toBe(false)

			// A refusal that corrupts is worse than one that throws: the bytes AND the tree are
			// what it has to leave alone.
			expect(created.tokens.value(), entry.label).toBe(entry.value)
			expect(shapeOf(rootRows(created)), entry.label).toEqual(before)
		}
		expect(ran).toBeGreaterThan(100)
	})
})