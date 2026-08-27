import {faker} from '@faker-js/faker'
import {describe, expect, it} from 'vitest'

import type {CoreOption} from '../../../shared/types'
import {Store} from '../../../store/Store'
import {offsetOfAnchor} from './anchors'
import type {NodeAnchor, RowNode, TreeNode} from './types'

/**
 * THE GATE FOR `splitPlan`, and the reason it is a property rather than a table: the plan has four
 * independent coordinates — where the span opens, where it closes, how many lines arrive, and what
 * the rows around the cut are — and the shapes that broke it twice are the ones nobody writes down.
 * A span that leaves the row it began in was refused outright until now, and the refusal wrote the
 * clip through the ordinary splice: `'- alpha⏎⇥- beta'` with a span from `al|pha` to `be|ta` and a
 * two-line clip emitted `'- alone⏎twota'`, whose second line carries neither the lead nor the
 * opener of any row in the document.
 *
 * Four oracles, and no two of them imply each other.
 *
 * 1. THE LINES, built independently as a LIST rather than as bytes. Every rule the plan is
 *    documented to follow is restated here over rows — the head keeps what precedes the span, the
 *    last covered row's tail follows the last piece, the rows between are consumed, and a subtree
 *    follows whichever half can hold it — and the bytes are the join of that list. A byte-level
 *    oracle would be the plan's own arithmetic written twice.
 * 2. THE PARSE, over the rows the write does not name. A crossing span replaces the last covered
 *    row's line with one written at the HEAD's lead, so the row that used to follow a deeper line
 *    now follows a shallower one — and the clamp re-parents it with not a byte of its own moving.
 *    Every row past the span must keep its depth and its bytes, or there is no plan to write and
 *    the verb must refuse. That is what keeps the corpus free to carry surplus leads, the class
 *    where a row's depth is held by the row above it rather than by its own bytes.
 *
 *    IT IS ASKED OF THE CROSSING ARM ALONE. A split at a row's own START empties the head, and an
 *    empty row takes no children, so the subtree follows the tail — which is also empty when the
 *    clip is Enter's pair of blanks, and a child carrying a SURPLUS lead then lands one level
 *    shallower. That is the ENCODING and not the plan: no bytes express an empty row with
 *    children. Pre-existing, unchanged by this widening, and left standing rather than asserted
 *    away.
 * 3. THE CARET, which no value assertion sees. It belongs `lastPiece.length` characters into the
 *    row the plan opened last, and it is asserted in BOTH value modes: controlled mode moves no
 *    derived caret, so a plan that leaves the caret to the window arithmetic answers differently
 *    there — `'abcd⏎⇥child⏎tail'` split at 2 put it four characters past the cut.
 * 4. THE POSITIONS. `value()` joins the nodes and reads no position at all, so a splice that left
 *    the coordinates wrong emits a perfect string and every anchor after it addresses the wrong
 *    bytes.
 *
 * A REFUSAL IS TOTAL: the value and the row objects are untouched. And the run asserts its own
 * acceptance count, because a plan that refused everything would satisfy every oracle above.
 */

const SEPARATOR = '\n'
const INDENT = '\t'
const HEADING: CoreOption = {markup: '# __slot__', row: {Component: 'h1'}}
const BULLET: CoreOption = {markup: '- __slot__', row: {Component: 'li', continues: true, indents: true}}
const OPTIONS = [HEADING, BULLET]

/** The structural bytes each kind writes before its body — the corpus's kinds all end with theirs. */
const OPENER: Record<string, string> = {'# __slot__': '# ', '- __slot__': '- '}

/** Repetition on purpose, one EMPTY body, and two bodies that carry a KIND of their own. */
const BODIES = ['alpha', 'beta', 'alpha', '# head', '- item', ''] as const

const BASE_SEED = 27_082_026
const DOCUMENTS = 6
/** How often a draft is written with MORE indent than its position asks for. */
const SURPLUS = 0.25

type Draft = {body: string; lead: number; rows: Draft[]}

function buildDrafts(count: number, depth: number, deepest = 2): Draft[] {
	return Array.from({length: count}, () => {
		const body = faker.helpers.arrayElement(BODIES)
		const children = depth === deepest ? 0 : faker.number.int({min: 0, max: 2})
		const lead = faker.datatype.boolean(SURPLUS) ? depth + 1 : depth
		return {body, lead, rows: buildDrafts(children, depth + 1)}
	})
}

const render = (drafts: readonly Draft[]): string[] =>
	drafts.flatMap(draft => [INDENT.repeat(draft.lead) + draft.body, ...render(draft.rows)])

const DOCS = Array.from({length: DOCUMENTS}, (_, index) => {
	faker.seed(BASE_SEED + index)
	return render(buildDrafts(faker.number.int({min: 2, max: 3}), 0)).join(SEPARATOR)
})

/** The clips a foreign paste arrives as: two lines, three lines, and Enter's own pair of blanks. */
const CLIPS: readonly string[][] = [
	['one', 'two'],
	['', ''],
	['x', 'y', 'z'],
	['', 'tail'],
]

function store(value: string): Store {
	const created = new Store()
	created.props.set({
		defaultValue: value,
		separator: SEPARATOR,
		indent: INDENT,
		Mark: () => null,
		options: OPTIONS,
	})
	created.host.container(document.createElement('div'))
	return created
}

/**
 * The controlled loop an adapter runs: the parent owns the value and echoes every change back. It
 * is what makes the caret question real — a verb names no DERIVED caret here, because the tree has
 * not moved when it returns.
 */
function controlledStore(value: string): Store {
	const created = new Store()
	const set = (next: string) =>
		created.props.set({
			value: next,
			onChange: (echo: string) => set(echo),
			separator: SEPARATOR,
			indent: INDENT,
			Mark: () => null,
			options: OPTIONS,
		})
	set(value)
	created.host.container(document.createElement('div'))
	return created
}

const rootRows = (created: Store): RowNode[] =>
	created.tokens.nodes().filter((node): node is RowNode => node.kind === 'row')

const preorder = (rows: readonly RowNode[]): RowNode[] => rows.flatMap(row => [row, ...preorder(row.rows())])

const everyNode = (nodes: readonly TreeNode[]): TreeNode[] =>
	nodes.flatMap(node => [node, ...(node.kind === 'text' ? [] : everyNode(node.children()))])

/** A row as the oracle reads it: its lead, the kind's own opener, its body, and where it landed. */
type Line = {lead: string; opener: string; body: string; depth: number; children?: number}

function linesOf(created: Store): Line[] {
	const rows = preorder(rootRows(created))
	const depthOf = (row: RowNode): number => {
		let depth = 0
		let current: RowNode | undefined = rows.find(candidate => candidate.rows().includes(row))
		while (current) {
			depth++
			const child: RowNode = current
			current = rows.find(candidate => candidate.rows().includes(child))
		}
		return depth
	}
	return rows.map(row => ({
		lead: row.lead(),
		opener: OPENER[row.descriptor()?.markup ?? ''] ?? '',
		body: row.slot(),
		depth: depthOf(row),
		children: row.rows().length,
	}))
}

const render1 = (line: Line): string => line.lead + line.opener + line.body

/** A case, addressed by PRE-ORDER INDEX and body offset so it survives a replay on a fresh store. */
type Case = {
	value: string
	from: number
	at: number
	to: number
	until: number
	clip: readonly string[]
	label: string
}

function casesOf(value: string): Case[] {
	const lines = linesOf(store(value))
	const offsets = (body: string): number[] =>
		body.length > 1 ? [0, Math.floor(body.length / 2), body.length] : [0, body.length]
	const cases: Case[] = []
	for (const [from, head] of lines.entries()) {
		for (let to = from; to < lines.length; to++) {
			for (const at of offsets(head.body)) {
				for (const until of offsets(lines[to].body)) {
					if (to === from && until < at) continue
					for (const clip of CLIPS) {
						cases.push({
							value,
							from,
							at,
							to,
							until,
							clip,
							label: `${JSON.stringify(value)} — [${from}:${at} → ${to}:${until}] ← ${JSON.stringify(clip)}`,
						})
					}
				}
			}
		}
	}
	return cases
}

const CASES = DOCS.flatMap(casesOf)

/**
 * ORACLE 1: the lines the write is meant to leave, as a list, with the depth each is meant to land
 * at. Restated from the documented rules rather than from the plan's arithmetic.
 *
 * `undefined` for a shape the rules do not describe — a span closing in a row that has children of
 * its own, whose place under a tail written at the head's lead is a re-indent and not a splice.
 */
function intended(lines: readonly Line[], entry: Case): Intended | undefined {
	const head = lines[entry.from]
	const last = lines[entry.to]
	const crossing = entry.to !== entry.from
	if (crossing && (last.children ?? 0) > 0) return undefined
	// A subtree only ever stays where a span inside ONE body leaves it: a crossing span consumes
	// every row between its ends, and all of the head's descendants are among them.
	const subtree = crossing ? [] : lines.slice(entry.from + 1, entry.from + 1 + descendants(lines, entry.from))
	const after = lines.slice(crossing ? entry.to + 1 : entry.from + 1 + subtree.length)
	const before = lines.slice(0, entry.from)

	const headBody = head.body.slice(0, entry.at)
	const tailBody = last.body.slice(entry.until)
	const pieces = entry.clip
	// AT A ROW'S OWN START THE TWO HALVES SWAP ROLES: nothing is written at the cut and the head
	// takes none of the body, so the row that is OPENED is the empty head and the one that was
	// already there is the tail. The row that keeps the content keeps the kind.
	const opensAbove = !crossing && headBody === '' && pieces.every(piece => piece === '')
	const continues = head.opener === OPENER['- __slot__'] ? head.opener : ''
	const headOpener = opensAbove ? continues : head.opener
	const tailOpener = crossing ? last.opener : opensAbove ? head.opener : continues
	const written = [
		{lead: head.lead, opener: headOpener, body: headBody + pieces[0], depth: head.depth},
		...pieces.slice(1, -1).map(piece => ({lead: head.lead, opener: continues, body: piece, depth: head.depth})),
		{
			lead: head.lead,
			opener: tailOpener,
			body: pieces[pieces.length - 1] + tailBody,
			depth: head.depth,
		},
	]
	// AN EMPTY HEAD KEEPS NO CHILDREN, so the subtree follows the TAIL instead — written under an
	// empty row the descendants clamp to depth 0 and the tail lands below its own former children.
	const keepsChildren = written[0].lead + written[0].opener + written[0].body !== ''
	const body = keepsChildren
		? [written[0], ...subtree, ...written.slice(1)]
		: [written[0], ...written.slice(1), ...subtree]
	const all = [...before, ...body, ...after]
	// WHERE THE CARET BELONGS: into the row this list opened LAST, past the lead, past the kind's
	// own opener and past what the clip wrote there.
	const closing = written[written.length - 1]
	const at = all.indexOf(closing)
	const before2 = all.slice(0, at).reduce((total, line) => total + render1(line).length + SEPARATOR.length, 0)
	return {
		lines: all.map(render1),
		caret: before2 + closing.lead.length + closing.opener.length + pieces[pieces.length - 1].length,
	}
}

type Intended = {lines: string[]; caret: number}

/** How many pre-order lines the row at `at` has under it. */
function descendants(lines: readonly Line[], at: number): number {
	let count = 0
	for (let index = at + 1; index < lines.length; index++) {
		if (lines[index].depth <= lines[at].depth) break
		count++
	}
	return count
}

/**
 * ORACLE 2: every row PAST the span kept its own bytes and its own depth — asked of the parse
 * rather than restated, since the rows it is about are the ones no plan names.
 */
function keepsWhatFollows(before: readonly Line[], entry: Case, created: Store): boolean {
	const after = linesOf(created)
	const kept = before.slice(entry.to + 1)
	const tail = after.slice(after.length - kept.length)
	return kept.every((line, at) => render1(line) === render1(tail[at]) && line.depth === tail[at].depth)
}

/** ORACLE 4: the lines tile the value in pre-order and a row's span covers its whole subtree. */
function tiles(created: Store): boolean {
	const rows = preorder(rootRows(created))
	const lines = linesOf(created).map(render1)
	let at = 0
	for (const [index, row] of rows.entries()) {
		if (row.lineRange().start !== at) return false
		at += lines[index].length + (index === rows.length - 1 ? 0 : SEPARATOR.length)
		if (row.lineRange().end !== at) return false
		if (row.position.end !== preorder([row]).at(-1)?.lineRange().end) return false
	}
	return true
}

/** The span the case names, as anchors in a live document. */
function spanOf(created: Store, entry: Case) {
	const rows = preorder(rootRows(created))
	const anchor = created.tokens.anchorAt(rows[entry.from].slotRange().start + entry.at)
	const head = created.tokens.anchorAt(rows[entry.to].slotRange().start + entry.until)
	return {node: rows[entry.from], span: {anchor, head}}
}

describe('writeRows: a clip opens rows, or is refused whole', () => {
	it('writes the lines the rules describe and names the caret, for every expressible span', () => {
		let accepted = 0
		let crossed = 0
		// COLLECTED and asserted once: every case is run, so one failure names itself rather than
		// stopping the enumeration at whichever shape happened to come first.
		const broke: string[] = []
		const claim = (held: boolean, label: string, oracle: string): void => {
			if (!held) broke.push(`${oracle}: ${label}`)
		}
		for (const entry of CASES) {
			const created = store(entry.value)
			const lines = linesOf(created)
			const {node, span} = spanOf(created, entry)
			const objects = new Map(everyNode(rootRows(created)).map(one => [one.id, one]))

			const wrote = node.writeRows(span, entry.clip)
			const plan = intended(lines, entry)
			const value = created.tokens.value()
			if (!wrote) {
				// A REFUSAL IS TOTAL, whatever its reason.
				claim(value === entry.value, entry.label, 'refused and wrote')
				claim(
					everyNode(rootRows(created)).every(one => objects.get(one.id) === one),
					entry.label,
					'refused and re-minted'
				)
				continue
			}
			accepted++
			if (entry.to !== entry.from) crossed++
			claim(plan !== undefined, entry.label, 'wrote a shape the rules refuse')
			if (!plan) continue
			claim(value === plan.lines.join(SEPARATOR), `${entry.label} → ${JSON.stringify(value)}`, 'value')
			claim(tiles(created), entry.label, 'positions')
			claim(entry.to === entry.from || keepsWhatFollows(lines, entry, created), entry.label, 'depth after')
			const at = offsetsOf(created)
			claim(at?.start === plan.caret && at.end === plan.caret, `${entry.label} → ${at?.start}`, 'caret')
		}

		expect(broke.slice(0, 8)).toEqual([])
		// The run's own floor, so a plan that refused everything could not satisfy the oracles above
		// by writing nothing. 13136 cases, 7701 of them written, 6269 of those crossing a row
		// boundary — the arm this widened, which answered `undefined` for every one of them before.
		expect(accepted).toBeGreaterThan(7000)
		expect(crossed).toBeGreaterThan(6000)
	})

	/**
	 * THE SAME CARET IN CONTROLLED MODE, which is the half a window could not answer: a verb names
	 * no derived caret there, so a plan that leaves it to right affinity puts it at the end of the
	 * window instead of at the start of the tail.
	 */
	it('names the same caret when the value is controlled', () => {
		let checked = 0
		const broke: string[] = []
		for (const entry of CASES) {
			const lines = linesOf(store(entry.value))
			const plan = intended(lines, entry)
			// A WRITE THAT CHANGES NOTHING NEVER ECHOES: the parent is handed the value it already
			// holds, so its prop does not move and nothing arrives to land the caret on. Pre-existing,
			// and about the controlled loop rather than about this plan.
			if (!plan || plan.lines.join(SEPARATOR) === entry.value) continue
			const controlled = controlledStore(entry.value)
			const {node, span} = spanOf(controlled, entry)
			if (!node.writeRows(span, entry.clip)) continue
			checked++
			const at = offsetsOf(controlled)
			if (at?.start !== plan.caret || at.end !== plan.caret) broke.push(`${entry.label} → ${at?.start}`)
		}
		expect(broke.slice(0, 8)).toEqual([])
		expect(checked).toBeGreaterThan(7000)
	})
})

/**
 * The three documents the records measured, by name, because a property says a class is answered
 * and not which case provoked it.
 */
describe('writeRows: the shapes the records measured', () => {
	it("opens a cross-row paste as ROWS, where the raw splice wrote bytes in nobody's language", () => {
		const created = store('- alpha\n\t- beta')
		const rows = preorder(rootRows(created))
		const span = {
			anchor: created.tokens.anchorAt(rows[0].slotRange().start + 2),
			head: created.tokens.anchorAt(rows[1].slotRange().start + 2),
		}

		expect(rows[0].writeRows(span, ['one', 'two'])).toBe(true)

		// It used to emit `'- alone⏎twota'` — a second line with neither the lead nor the opener of
		// any row in the document.
		expect(created.tokens.value()).toBe('- alone\n- twota')
	})

	/**
	 * A MID-BODY SPLIT ON A ROW THAT KEEPS A SUBTREE, controlled: the edit is two disjoint pieces —
	 * bytes leave at the cut and arrive past the subtree — so the smallest window covering both is
	 * the whole bound, where right affinity put the caret at the END of the tail. Measured at 12,
	 * four characters past where Enter was pressed, with the tail starting at 10.
	 */
	it('names the caret at the tail START when the head keeps its children', () => {
		const controlled = controlledStore('abcd\n\tchild\ntail')
		const rows = preorder(rootRows(controlled))
		const at = controlled.tokens.anchorAt(rows[0].slotRange().start + 2)

		expect(rows[0].writeRows({anchor: at, head: at}, ['', ''])).toBe(true)

		expect(controlled.tokens.value()).toBe('ab\n\tchild\ncd\ntail')
		expect(offsetsOf(controlled)).toEqual({start: 10, end: 10})
	})

	/**
	 * AND A KIND THAT WRAPS ITS BODY, which is what makes the caret a question about the MARKUP and
	 * not about a length: a fence writes bytes on both sides of what it is handed, so the offset the
	 * plan names has to come from the kind rather than from the line's own start.
	 */
	it('names the caret inside a wrapping kind, past its opening bytes', () => {
		const created = new Store()
		created.props.set({
			defaultValue: '```ts\nqr\n```',
			separator: SEPARATOR,
			indent: INDENT,
			Mark: () => null,
			options: [{markup: '```__meta__\n__value__\n```', row: {Component: 'pre', continues: true}}],
		})
		created.host.container(document.createElement('div'))
		const row = rootRows(created)[0]
		const at = created.tokens.anchorAt(row.slotRange().start + 1)

		expect(row.writeRows({anchor: at, head: at}, ['', 'X'])).toBe(true)

		// The KIND continues and the meta does not, which is why the second fence carries no `ts`.
		expect(created.tokens.value()).toBe('```ts\nq\n```\n```\nXr\n```')
		// Past the second fence's own opening bytes, and past the `'X'` the clip wrote there.
		expect(offsetsOf(created)).toEqual({start: 17, end: 17})
	})

	/**
	 * AND THE BODY THAT AGREES WITH THE KIND'S OWN CLOSING BYTES, which is why the offset is asked of
	 * the markup with a probe rather than recovered by comparing two of its outputs: a fence body
	 * beginning with a newline shares one more character with the empty form than the body occupies,
	 * so a shared prefix names a position one past the caret.
	 */
	it('names the caret past bytes the body happens to agree with', () => {
		const created = new Store()
		created.props.set({
			defaultValue: '```ts\nq\nr\n```',
			separator: SEPARATOR,
			indent: INDENT,
			Mark: () => null,
			options: [{markup: '```__meta__\n__value__\n```', row: {Component: 'pre', continues: true}}],
		})
		created.host.container(document.createElement('div'))
		const row = rootRows(created)[0]
		const at = created.tokens.anchorAt(row.slotRange().start + 1)

		expect(row.writeRows({anchor: at, head: at}, ['', ''])).toBe(true)

		expect(created.tokens.value()).toBe('```ts\nq\n```\n```\n\nr\n```')
		expect(offsetsOf(created)).toEqual({start: 16, end: 16})
	})
})

/** The stored selection as offsets — the projection the caret oracle compares against. */
function offsetsOf(created: Store): {start: number; end: number} | undefined {
	const anchors = created.tokens.selection.anchors()
	if (!anchors) return undefined
	const roots = created.tokens.nodes()
	const ends = [anchors.anchor, anchors.head].map(anchor => offsetOfAnchor(roots, anchor as NodeAnchor))
	return {start: Math.min(...ends), end: Math.max(...ends)}
}