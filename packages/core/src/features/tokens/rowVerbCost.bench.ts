import {bench, describe} from 'vitest'

import {Store} from '../../store/Store'
import {preorderRows} from './tree/rows'
import type {RowNode, TreeNode} from './tree/types'

/**
 * WHAT A ROW GESTURE COSTS AT DOCUMENT SCALE — the ladder `commitCost.bench.ts` never had.
 *
 * Read that file first: it prices the COMMIT (splice, parse, adopt, pipeline, caret) and its
 * warnings apply here unchanged — these are tight-loop figures with no frame between iterations,
 * and they want an idle machine. This one prices what sits ON TOP of a commit when the document
 * has rows: the pre-order walk every row keybinding opens with, the three verbs the keymap drives,
 * and the invariant pass that runs after every commit.
 *
 * ── THE RUNGS ───────────────────────────────────────────────────────────────────────────
 *
 *   W1 preorderRows       the bare walk over every row of the document
 *   W2 rowOf @mid         the walk plus an anchor resolution — what Enter, Tab and Backspace
 *                         each run BEFORE they do anything
 *   W3 boundarySpan       Backspace's row half at a row boundary: which separator to remove
 *   W4 rowSelectionText   the span resolution every `beforeinput` runs, at a plain caret
 *   K1 plain keystroke    one character in and out of the middle row — the commit, unchanged
 *                         structure, and the baseline the three verbs are read against
 *   V1 Enter              `RowNode.splitAt` — a full commit
 *   V2 Tab                `indentRows` — a full commit
 *   V3 Backspace merge    `edit.replace` over `boundarySpan` — a full commit
 *   S1 settle pass        the microtask after a commit: `#settleRows` + `#settleTail` +
 *                         `#settleCaret`, three more walks, awaited
 *   P1 refuse             `RowController.refuse` — the signal write behind the refusal tint
 *
 * W1–W3 are pure reads and are the ones that answer "is `rowOf` a problem"; V1–V3 include a whole
 * commit, so they are read against K1 at the same row count rather than in isolation. S1 is the
 * only rung that measures the invariant, and it can only be measured with a microtask boundary in
 * it, so its floor is a scheduler turn — read S1 − V1, not S1.
 *
 * ── WHAT IT MEASURED, 2026-08-27, idle machine, Chromium ────────────────────────────────
 *
 * See `docs/scratch/notion-like/issues/33-nothing-is-measured-at-document-scale.md` for the table,
 * the browser-driven half and the verdict. The short form: every read rung is linear in the row
 * count and none of them is 2% of the commit it precedes — `rowOf` costs 0.067 ms at 4000 rows —
 * and the three verbs cost what a PLAIN keystroke costs at the same size, so the row layer adds
 * nothing measurable to the commit it rides on.
 *
 * W4 IS THE ONE RUNG THAT HAS ALREADY CAUGHT SOMETHING. The visibility clip was written to fall
 * through to a raw span, which put a `preorderRows` walk on the plain keystroke path where there
 * had been none: 0.372 ms here, twice per `beforeinput`, on a 6 ms keystroke. A caret names no
 * content and needs no clip, and saying so took it back to 0.121 ms.
 *
 * The `nested 4000 rows` group takes ~90-120 s on its own, because every rebuild parses and mounts
 * a 4000-row document; the flat groups take ~13 s each.
 *
 * ── THE DOCUMENTS ───────────────────────────────────────────────────────────────────────
 *
 * FLAT and NESTED at each size, because `preorderRows` recurses and the flat shape never enters
 * the recursion. The nested shape is a depth-4 ladder repeated, which is the deepest the showcase
 * reaches; `hasCells` is not exercised here because a carved row's pieces are not lines and the
 * walk skips them by construction.
 *
 * K1 OSCILLATES — a character in, then out — so its document never grows. No row verb has an
 * inverse that is not a second commit, so V1–V3 and S1 rebuild their store every `REBUILD`
 * iterations instead. Nothing subtracts that rebuild, so those four are UPPER BOUNDS; at
 * `REBUILD = 200` the share is small, and K1 beside V1 at every size is the check that says how
 * small.
 */

/** Keeps a measured call's result observable so nothing is optimized out. */
let sink = 0

const SEPARATOR = '\n'

const INDENT = '\t'

function flatDoc(rows: number): string {
	const lines: string[] = []
	for (let i = 0; i < rows; i++) lines.push(`row ${i} with some plain text in it`)
	return lines.join(SEPARATOR)
}

/** A depth-4 ladder, repeated — the deepest nesting the showcase reaches. */
function nestedDoc(rows: number): string {
	const lines: string[] = []
	for (let i = 0; i < rows; i++) lines.push(INDENT.repeat(i % 4) + `row ${i} with some plain text in it`)
	return lines.join(SEPARATOR)
}

type Doc = {name: string; value: string; rows: number}

const docs: Doc[] = [
	{name: 'flat 100 rows', value: flatDoc(100), rows: 100},
	{name: 'flat 1000 rows', value: flatDoc(1000), rows: 1000},
	{name: 'flat 4000 rows', value: flatDoc(4000), rows: 4000},
	{name: 'nested 4000 rows', value: nestedDoc(4000), rows: 4000},
]

/**
 * A store at the document, with the tree materialized. MOUNTED, because half of what these rungs
 * measure asks the DOM: `indentRows` refuses a destination nothing paints, and the settle pass
 * reads `rowPaint` for every row it walks. An unmounted store answers `'absent'` everywhere and
 * takes the early return out of all three settle arms, which would measure the guard instead of
 * the walk.
 */
function storeFor(doc: Doc): Store {
	document.body.replaceChildren()
	const container = document.createElement('div')
	document.body.append(container)
	const store = new Store()
	store.props.set({defaultValue: doc.value, options: [], Mark: () => null, separator: SEPARATOR})
	store.host.container(container)
	for (const root of store.tokens.nodes()) consignRow(store, container, root)
	return store
}

/**
 * The shape `bind` walks for a row — `div > span` — consigned as an adapter's refs would, and
 * recursively for the child rows, since a nested document's rows are not roots.
 *
 * The child rows go inside their parent's element, which is what makes `rowPaint` answer
 * `'painted'` for them: `checkVisibility()` is false for an element outside the document.
 */
function consignRow(store: Store, parent: HTMLElement, node: TreeNode): void {
	if (node.kind !== 'row') return
	const element = document.createElement('div')
	const text = document.createElement('span')
	element.append(text)
	parent.append(element)
	store.tokens.consign(node.id)(element)
	const surface = node.children().at(0)
	if (surface?.kind === 'text') store.tokens.consign(surface.id)(text)
	for (const child of node.rows()) consignRow(store, element, child)
}

/** The row nearest the document's middle — the worst case for every walk that scans in order. */
function midRow(store: Store): RowNode {
	const rows = preorderRows(store.tokens.nodes())
	return rows[Math.floor(rows.length / 2)].row
}

/** An offset inside the middle row's own body, where a caret would sit. */
function midOffset(store: Store): number {
	const row = midRow(store)
	const slot = row.slotRange()
	return Math.floor((slot.start + slot.end) / 2)
}

type Gesture = () => void

function walkRung(store: Store): Gesture {
	return () => {
		sink += preorderRows(store.tokens.nodes()).length
	}
}

function rowOfRung(store: Store): Gesture {
	const offset = midOffset(store)
	return () => {
		sink += store.tokens.rowOf(store.tokens.anchorAt(offset)) === undefined ? 0 : 1
	}
}

/**
 * W4: the span resolution EVERY `beforeinput` runs, at a plain caret — `rowSelectionText`, which
 * asks whether the pair's edges sit on structural bytes and whether it crosses a row nobody can
 * see. It is on the keystroke path twice per event (the row-selection arm, then the shared tail),
 * so a document walk here is charged to every character typed.
 */
function spanRung(store: Store): Gesture {
	const offset = midOffset(store)
	return () => {
		const at = store.tokens.anchorAt(offset)
		sink += store.tokens.rowSelectionText({anchor: at, head: at}) === undefined ? 0 : 1
	}
}

/**
 * K1: the PLAIN keystroke — one character in and out of the middle row, through the same
 * `EditController.replace` a typed character reaches. The baseline every verb below is read
 * against: it changes no structure, so what it prices is the commit itself at this row count.
 *
 * `commitCost.bench.ts`'s L6 is the same rung at 100 and 1000 rows and no further; this one exists
 * because 4000 was the size nobody had a number for.
 */
function keystrokeRung(store: Store): Gesture {
	const offset = midOffset(store)
	store.tokens.focusFirst()
	store.tokens.selection.select(store.tokens.anchorAt(offset))
	let inserted = false
	return () => {
		const from = store.tokens.anchorAt(offset)
		const to = store.tokens.anchorAt(inserted ? offset + 1 : offset)
		store.edit.replace(from, to, inserted ? '' : 'x')
		inserted = !inserted
		sink += store.tokens.nodes().length
	}
}

function boundaryRung(store: Store): Gesture {
	const row = midRow(store)
	const anchor = store.tokens.anchorAt(row.slotRange().start)
	return () => {
		sink += store.tokens.boundarySpan(anchor, -1) === undefined ? 0 : 1
	}
}

/**
 * Enter and Tab both GROW or MOVE the document, so neither has a free inverse: a split can only
 * be undone by a merge, which is a second commit and would be measured as part of the first. They
 * rebuild instead, every `REBUILD` iterations, and the rebuild is charged to the rung — so V1 and
 * V2 are UPPER BOUNDS. `REBUILD` is large enough that the amortized share is small and small
 * enough that the document never doubles.
 */
const REBUILD = 200

function rebuilding(doc: Doc, gesture: (store: Store) => void): Gesture {
	let store = storeFor(doc)
	let left = REBUILD
	return () => {
		if (left-- <= 0) {
			store = storeFor(doc)
			left = REBUILD
		}
		gesture(store)
		sink += store.tokens.nodes().length
	}
}

/**
 * S1: the invariant pass. It runs in a microtask queued by the commit clock, so the rung has to
 * await one — which puts a scheduler turn in every sample and makes this the one rung whose FLOOR
 * is not zero. Read it against the same-shaped rung on a document with ONE row, which is the
 * scheduler turn alone.
 */
function settleRung(doc: Doc): () => Promise<void> {
	let store = storeFor(doc)
	let left = REBUILD
	return async () => {
		if (left-- <= 0) {
			store = storeFor(doc)
			left = REBUILD
		}
		const row = midRow(store)
		store.tokens.selection.select(store.tokens.anchorAt(row.slotRange().start))
		row.splitAt(store.tokens.anchorAt(row.slotRange().start))
		await Promise.resolve()
		sink += store.tokens.nodes().length
	}
}

const options = {time: 1000, warmupTime: 200} as const

/**
 * Builds the world on the first call and reuses it — a mounted 4000-row world costs far more to
 * build than the gesture it measures, and vitest's warmup pass absorbs that first call.
 */
function lazy(build: () => Gesture): () => void {
	let gesture: Gesture | undefined
	return () => {
		gesture ??= build()
		gesture()
	}
}

for (const doc of docs) {
	// oxlint-disable-next-line vitest/valid-title -- one ladder per document, named from the table above
	describe(doc.name, () => {
		bench(
			'W1 preorderRows',
			lazy(() => walkRung(storeFor(doc))),
			options
		)
		bench(
			'W2 rowOf @mid',
			lazy(() => rowOfRung(storeFor(doc))),
			options
		)
		bench(
			'W3 boundarySpan',
			lazy(() => boundaryRung(storeFor(doc))),
			options
		)
		bench(
			'W4 rowSelectionText @caret',
			lazy(() => spanRung(storeFor(doc))),
			options
		)
		bench(
			'K1 plain keystroke',
			lazy(() => keystrokeRung(storeFor(doc))),
			options
		)
		bench(
			'V1 Enter (splitAt)',
			lazy(() =>
				rebuilding(doc, store => {
					const row = midRow(store)
					row.splitAt(store.tokens.anchorAt(midOffset(store)))
				})
			),
			options
		)
		bench(
			'V2 Tab (indentRows)',
			lazy(() =>
				rebuilding(doc, store => {
					const row = midRow(store)
					store.tokens.indentRows([row], 1)
				})
			),
			options
		)
		bench(
			'V3 Backspace merge',
			lazy(() =>
				rebuilding(doc, store => {
					const row = midRow(store)
					const span = store.tokens.boundarySpan(store.tokens.anchorAt(row.slotRange().start), -1)
					if (span) store.edit.replace(span.anchor, span.head, '')
				})
			),
			options
		)
		bench('S1 settle pass', settleRung(doc), options)
		bench(
			'P1 refuse',
			lazy(() => {
				const store = storeFor(doc)
				const row = midRow(store)
				return () => {
					store.rows.refuse(row.id)
					sink += 1
				}
			}),
			options
		)
	})
}