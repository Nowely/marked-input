import {bench, describe} from 'vitest'

import {batch} from '../../shared/signals'
import {Store} from '../../store/Store'
import {domModelOf} from './__testing__/mountFixtures'
import {Parser} from './parser/Parser'
import type {Markup, RowToken, Token} from './parser/types'
import {adopt, parseRowsValue, parseValue} from './tree/adopt'
import {createTokenTree} from './tree/tree'
import type {TextNode, TreeNode, Window} from './tree/types'

/**
 * PER-KEYSTROKE COST of the commit path, attributed by SUBTRACTION.
 *
 * ⚠ ABSOLUTES HERE ARE TIGHT-LOOP FIGURES. This harness hammers edits with no frame between
 * iterations; a person types at most one character per frame, and the browser lays out
 * incrementally in between. Measured against frame-paced typing, everything below reads 2-4x
 * high — the RATIOS held up, the absolutes did not. Before quoting any number from this file as
 * "what a keystroke costs", read `docs/scratch/native-caret-motion/measurements.md`, which has
 * the frame-interval measurement and the size threshold (smooth to ~500 spans, degrading from
 * ~1000).
 *
 * Each size registers the same ladder, every rung adding one stage:
 *
 *   L1 splice            string splice only
 *   L2 +parse            L1 + parseValue (full document re-parse)
 *   L3 +adopt            L2 + adopt (incl. the suffix walk's shiftPositions)
 *   L4 core commit       replaceBetween: transactions + boundary + L3 + pipeline.apply
 *                        + tree.value() joins + selection repair
 *   L5 full keystroke    EditController.replace on a MOUNTED store: L4 + the DOM write
 *   L5b stored selection a selection EXISTS but no post-edit caret is issued
 *   L6 focused           L5 with the editor actually focused — a person typing
 *   C1 caret only        one caret write, no edit, on CLEAN layout
 *   C2 caret on dirty    one caret write after touching the DOM
 *   M1 mount             one registry write per element — an adapter's refs, replayed
 *
 * Subtraction is valid because every rung repeats the lower rungs' work verbatim on the
 * same string sequence: the parse is a pure function of the spliced value, so L2 - L1 is
 * the parse, L3 - L2 the adoption, and so on. M1 is outside that ladder: it prices MOUNT,
 * not a keystroke, and it is read as a curvature (does 2N cost 2× or 4×?) rather than as
 * an absolute.
 *
 * ── A WARNING ABOUT EVERY MOUNTED FIGURE BELOW ──────────────────────────────────────────
 *
 * They were taken before consignment became the element source. `mountDom` built the DOM but
 * never consigned it, so from that change until M1 was added every mounted rung bound an EMPTY
 * registry — the walk found no element for any node and unbound the lot. `mountDom` now consigns
 * what it builds; the L5/L5b/L6 numbers quoted below have NOT been re-taken since and are lower
 * bounds at best.
 *
 * ── M1, AND THE REGRESSION IT EXISTS TO CATCH ───────────────────────────────────────────
 *
 * When a registration invalidated a signal the bind effect watched, one ref cost a whole-tree
 * walk. Measured through both adapters before the fix: mounting N marks ran 2N+2 binds
 * (22/102/402/802/1602 for N = 10/50/200/400/800, React and Vue identical), and the core-level
 * cold mount read 2.6 / 7.2 / 41.5 / 166.3 / 678 ms at 101 / 201 / 501 / 1001 / 2001 nodes —
 * ms/N^2 flat at ~1.66e-4, i.e. 4x per doubling. A ref binds one id now:
 *
 *   inline 10 marks     (21 nodes)      0.35 ms
 *   inline 100 marks    (201 nodes)     1.12 ms
 *   inline 1000 marks   (2001 nodes)    4.05 ms
 *   block 100 rows      (300 refs)      1.73 ms
 *   block 1000 rows     (3000 refs)     6.42 ms
 *
 * READ IT AS CURVATURE. 10x the document costs ~3.6x here, not 100x; the absolute numbers move
 * with the machine and the per-ref cost is small enough that fixed overhead dominates the small
 * sizes. If a doubling ever costs 4x again, a registration has started doing work proportional
 * to the whole document.
 *
 * ── WHAT THIS MEASURED, at inline 1000 marks (42 KB, 2001 tokens) ───────────────────────
 *
 * The parse is NOT the problem, and the caret is not the problem in the way it first looks:
 *
 *   L5 mounted, no caret     ~1.0 ms
 *   L5b stored selection    ~25-31 ms      <- merely HAVING a selection costs the keystroke
 *   L5 full keystroke       ~25-40 ms
 *   C1 caret write only      ~0.005 ms     <- a caret write on clean layout is free
 *   C2 caret write, dirty    ~1.6 ms       <- 296x, from nothing but touching the DOM first
 *
 * So the cost is not FREQUENCY — exactly one `removeAllRanges` + `addRange` pair runs per
 * keystroke, counted — and not the placement arithmetic. It is that writing the selection
 * forces a synchronous layout, and that layout is charged for the whole editing host. C1
 * against C2 isolates it: same call, same document, the only difference is whether the DOM
 * was touched first.
 *
 * Two consequences worth writing down before anyone optimises the wrong thing. A guard that
 * skips the write when the DOM already shows the target CANNOT help the typing path — typing
 * genuinely moves the caret by one, so the DOM and the model legitimately differ every time
 * (built, measured, reverted). And L1-L4 are all under 1 ms here, so no amount of work on the
 * parse, on adoption, or on the commit pipeline reaches this: at 1000 marks they are together
 * ~3% of the keystroke.
 *
 * The rme on the mounted 1000-mark rungs is +-15-22% on ~30 samples, so treat those as an
 * order of magnitude, not a figure. The small documents are stable to +-2%.
 *
 * ── TWO CORRECTIONS TO THE PARAGRAPH ABOVE, both measured later ─────────────────────────
 *
 * 1. "The caret is ~97%" holds ONLY for the flat inline document, and the caret is not the cause.
 *    `layoutCost.bench.ts` isolated it: a bare forced reflow costs the same as the selection
 *    write, so the bill is the LAYOUT, and the layout is expensive because inline layout puts the
 *    whole document in ONE inline formatting context that a one-character edit reflows wholesale.
 *    Grouping the same spans into blocks takes it from 93 ms to 0.049 ms. Read that file before
 *    concluding anything about the caret from this one.
 *
 *    On BLOCK 1000 rows — 36 KB, 2000 tokens, the realistic large document, and stable to +-1% —
 *    the caret costs +0.11 ms on a 0.86 ms keystroke. Block layout already has one block per Row,
 *    so it never pays the inline-context bill.
 *
 * 2. An earlier version of the FOCUSED rungs was confounded and its numbers were wrong (block
 *    1000 rows read 5.56 ms where it now reads 0.82 ms). `focusFirst()` places at the FIRST root
 *    and so overwrites the seeded selection, leaving the caret at the document start while the
 *    edit happened in the middle — and placing a caret far from the edit is itself expensive.
 *    {@link settleCaretAt} fixes the order and both L6 and L7 share it. The unfocused rungs (L5,
 *    L5b) never used it and are unaffected.
 *
 * ── L7, THE RUNG THAT BECAME THE BEHAVIOUR ──────────────────────────────────────────────
 *
 * Most of the commit system WAS optimisation: a render epoch and the text/structural routing
 * existed so a plain keystroke never repainted and never re-bound, and the `pendingStructural`
 * latch and the delta ledger existed to manage the announcements that routing created. L7 priced
 * deleting all of it — every commit binds, so `bind` walks the whole tree every time.
 *
 * The rung is GONE from the ladder because its answer is now L6: with the routing deleted, the
 * two rungs were the same code. The figures it took are kept, because they are the evidence the
 * deletion rests on:
 *
 *   inline 100 marks    L6 0.26-0.29 ms -> L7 0.35-0.40 ms   (~1.35x)
 *   block 100 rows      L6 0.34-0.37 ms -> L7 0.30-0.61 ms   (unstable, see below)
 *   block 1000 rows     L6 0.70-0.73 ms -> L7 1.81-1.86 ms   (~2.5x, +-0.6% rme)
 *
 * So always binding roughly doubles the commit, and the worst case measured is ~1.85 ms on a 2000
 * token document — about 12% of a frame. Cheap enough that the routing does not pay for its
 * concepts.
 *
 * Ranges, not single figures, because these are three separate runs on an idle machine. Block 100
 * rows is the one rung that did not settle (0.295 / 0.613 / 0.597 across the three), so treat it
 * as unresolved rather than as a number.
 *
 * ── MEASUREMENT CONDITIONS, because it changed the answer once ──────────────────────────
 *
 * Run these with NOTHING else on the machine. An earlier set of these figures was taken while
 * three background agents were running browser suites, and it inflated every absolute by roughly
 * 5-30% (block 1000 L7 read 1.925 ms against 1.81-1.86 ms clean) while pushing rme from ~1% to
 * 20-105%. Ratios between rungs survived, absolutes did not. If a rung reports rme above ~10% at
 * a size where its neighbours report ~1%, suspect the machine before the code.
 *
 * CAVEAT: this is the CORE half only. `mountDom` builds the DOM by hand and consigns it, so no
 * React or Vue reconciliation happens. That is the right half to measure for always-BIND, which
 * is what shipped — the adapters do not re-render for a text edit, because `nodes` keeps its
 * reference. It would be the wrong half for always-RENDER, which was never built.
 *
 * The workload OSCILLATES — insert 'x' at `pos`, then delete it — so the document never
 * grows across a benchmark's thousands of iterations and every sample is the same edit at
 * the same offset. `pos` is the middle of the text node nearest the document midpoint,
 * which is the worst case for adoption's suffix walk: every node after the edit is
 * retained and re-positioned.
 */

/** Keeps a measured call's result observable so nothing is optimized out. */
let sink = 0

const INLINE_MARKUP: Markup = '@[__value__](__meta__)'

function inlineDoc(marks: number): string {
	let out = 'Start text'
	for (let i = 0; i < marks; i++) out += ` word${i} and more text @[user${i}](User ${i})`
	return out + ' end of text'
}

function blockDoc(rows: number): string {
	let out = ''
	for (let i = 0; i < rows; i++) out += `row ${i} with some plain text in it\n\n`
	return out
}

function tokensFor(parser: Parser | undefined, value: string, isBlock: boolean): (Token | RowToken)[] {
	// Block mode is rows (issue 08): the structural separator forms them, no markup needed
	return isBlock ? parseRowsValue(parser, value, {separator: '\n\n'}) : parseValue(parser, value)
}

function textNodesOf(nodes: readonly TreeNode[], out: TextNode[] = []): TextNode[] {
	for (const node of nodes) {
		if (node.kind === 'text') out.push(node)
		else textNodesOf(node.children(), out)
	}
	return out
}

/**
 * Three caret offsets, each strictly INSIDE a text node so the splice is a text edit:
 *
 * - `head` — the first text node. Adoption's prefix walk retains nothing and the suffix
 *   walk retains AND shifts every following node: the whole document is `shiftPositions`.
 * - `mid` — the text node nearest the document midpoint. Half prefix, half shifted suffix.
 * - `tail` — the last text node. The prefix walk retains everything and writes nothing.
 *
 * `head` − `tail` is therefore the write cost of the suffix walk over the whole document,
 * with the parse and the equality checks held constant.
 */
function caretOffsets(roots: readonly TreeNode[], value: string): {head: number; mid: number; tail: number} {
	const texts = textNodesOf(roots).filter(node => node.position.end - node.position.start >= 4)
	if (texts.length === 0) throw new Error('bench fixture has no text node wide enough to type into')
	const centre = Math.floor(value.length / 2)
	let nearest = texts[0]
	for (const node of texts) {
		const middle = (node.position.start + node.position.end) / 2
		if (Math.abs(middle - centre) < Math.abs((nearest.position.start + nearest.position.end) / 2 - centre)) {
			nearest = node
		}
	}
	return {
		head: texts[0].position.start + 1,
		mid: Math.floor((nearest.position.start + nearest.position.end) / 2),
		tail: texts[texts.length - 1].position.end - 1,
	}
}

type Doc = {
	name: string
	value: string
	markup: Markup | undefined
	isBlock: boolean
	parser: Parser | undefined
	/** Simulated caret offsets; `pos` (the ladder's) is `mid`. */
	pos: number
	head: number
	tail: number
	roots: number
	tokens: number
}

function describeDoc(name: string, value: string, markup: Markup | undefined, isBlock: boolean): Doc {
	const parser = markup === undefined ? undefined : new Parser([markup])
	const tokens = tokensFor(parser, value, isBlock)
	const tree = createTokenTree(tokens)
	const roots = tree.roots()
	let total = 0
	const count = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			total++
			if (node.kind !== 'text') count(node.children())
		}
	}
	count(roots)
	const carets = caretOffsets(roots, value)
	return {
		name,
		value,
		markup,
		isBlock,
		parser,
		pos: carets.mid,
		head: carets.head,
		tail: carets.tail,
		roots: roots.length,
		tokens: total,
	}
}

const docs: Doc[] = [
	describeDoc('inline 10 marks', inlineDoc(10), INLINE_MARKUP, false),
	describeDoc('inline 100 marks', inlineDoc(100), INLINE_MARKUP, false),
	describeDoc('inline 1000 marks', inlineDoc(1000), INLINE_MARKUP, false),
	describeDoc('block 100 rows', blockDoc(100), undefined, true),
	describeDoc('block 1000 rows', blockDoc(1000), undefined, true),
]

console.log(
	'\nbench documents:\n' +
		docs
			.map(
				doc =>
					`  ${doc.name.padEnd(20)} chars=${String(doc.value.length).padStart(6)} roots=${String(doc.roots).padStart(5)} tokens=${String(doc.tokens).padStart(5)} carets head/mid/tail=${doc.head}/${doc.pos}/${doc.tail}`
			)
			.join('\n') +
		`\n  environment: ${typeof document === 'undefined' ? 'node' : 'browser'}, import.meta.env.DEV=${String(import.meta.env.DEV)}\n`
)

// ── the ladder ───────────────────────────────────────────────────────────────

type Keystroke = () => void

function insertWindow(pos: number): Window {
	return {start: pos, end: pos, insertedLength: 1}
}

function deleteWindow(pos: number): Window {
	return {start: pos, end: pos + 1, insertedLength: 0}
}

function spliceKeystroke(doc: Doc): Keystroke {
	let current = doc.value
	let inserted = false
	return () => {
		current = inserted
			? current.slice(0, doc.pos) + current.slice(doc.pos + 1)
			: current.slice(0, doc.pos) + 'x' + current.slice(doc.pos)
		inserted = !inserted
		sink += current.length
	}
}

function parseKeystroke(doc: Doc): Keystroke {
	let current = doc.value
	let inserted = false
	return () => {
		current = inserted
			? current.slice(0, doc.pos) + current.slice(doc.pos + 1)
			: current.slice(0, doc.pos) + 'x' + current.slice(doc.pos)
		inserted = !inserted
		sink += tokensFor(doc.parser, current, doc.isBlock).length
	}
}

function adoptKeystroke(doc: Doc, pos: number = doc.pos): Keystroke {
	const tree = createTokenTree(tokensFor(doc.parser, doc.value, doc.isBlock))
	let current = doc.value
	let inserted = false
	return () => {
		const window = inserted ? deleteWindow(pos) : insertWindow(pos)
		current = inserted
			? current.slice(0, pos) + current.slice(pos + 1)
			: current.slice(0, pos) + 'x' + current.slice(pos)
		inserted = !inserted
		adopt(tree, window, tokensFor(doc.parser, current, doc.isBlock))
		sink += tree.roots().length
	}
}

function storeFor(doc: Doc): Store {
	const store = new Store()
	store.props.set({
		defaultValue: doc.value,
		options: doc.markup === undefined ? [] : [{markup: doc.markup}],
		Mark: () => null,
		...(doc.isBlock ? {layout: 'block' as const} : {}),
	})
	return store
}

/**
 * The keystroke on a Store. `caret` false skips the stored selection entirely — the write
 * goes straight to `tokens.replaceBetween`, so `selection.repair` and (when mounted)
 * `SelectionDriver`'s post-commit caret re-place both have nothing to do. The difference
 * against the `caret` true variant is what the selection costs.
 */
function storeKeystroke(store: Store, doc: Doc, caret: boolean): Keystroke {
	if (caret) store.tokens.selection.select(store.tokens.anchorAt(doc.pos))
	let inserted = false
	return () => {
		const from = store.tokens.anchorAt(doc.pos)
		const to = store.tokens.anchorAt(inserted ? doc.pos + 1 : doc.pos)
		const text = inserted ? '' : 'x'
		// `batch` on both arms: `EditController.replace` has one, and without it the no-caret
		// arm would flush the surface effects twice per keystroke and measure that instead.
		if (caret) store.edit.replace(from, to, text)
		else batch(() => store.tokens.replaceBetween(from, to, text))
		inserted = !inserted
		sink += store.tokens.nodes().length
	}
}

/**
 * L5b: a stored selection is PRESENT (so adoption captures it and `selection.repair` runs), but
 * the write goes through `replaceBetween` rather than `EditController.replace`, so no post-edit
 * `selection.select` is issued.
 *
 * The bisection L5 and L5-no-caret could not do: those two differ in TWO ways at once — whether a
 * selection exists at all, and which verb writes. L5b − L5-no-caret is what merely HAVING a
 * selection costs an adoption; L5 − L5b is what the post-edit caret costs on top.
 */
function storedSelectionKeystroke(doc: Doc): Keystroke {
	const store = storeFor(doc)
	mountDom(store, doc)
	store.tokens.selection.select(store.tokens.anchorAt(doc.pos))
	let inserted = false
	return () => {
		const from = store.tokens.anchorAt(doc.pos)
		const to = store.tokens.anchorAt(inserted ? doc.pos + 1 : doc.pos)
		const text = inserted ? '' : 'x'
		batch(() => store.tokens.replaceBetween(from, to, text))
		inserted = !inserted
		sink += store.tokens.nodes().length
	}
}

/**
 * C1: the CARET WRITE ALONE — no edit, no commit, no adoption. Alternates a collapsed caret
 * between two offsets in the same text node on a mounted, focused document.
 *
 * This rung exists because subtraction stopped being enough. L5 − L5-no-caret says the caret
 * costs almost the whole mounted keystroke and grows superlinearly, but it cannot say whether
 * that is markput placing the caret too often or Chromium charging for one placement inside a
 * large editing host. Counting says it is not frequency — exactly one `removeAllRanges` +
 * `addRange` pair runs per keystroke, measured. So this isolates the single write.
 *
 * If C1 tracks the L5 − L5-no-caret gap, the cost is the browser's and no scheduling change in
 * this repo can reach it; the lever would have to be writing the selection less often than once
 * per keystroke, which the typing path cannot do while it cancels the browser's own editing.
 */
function caretOnlyKeystroke(doc: Doc, dirtyLayout = false): Keystroke {
	const store = storeFor(doc)
	mountDom(store, doc)
	store.tokens.focusFirst()
	const container = document.body.lastElementChild
	if (!(container instanceof HTMLElement)) throw new Error('expected the mounted container')
	// The placement command is `DomModel`'s own since the API-surface cut; the rung measures
	// the same single selection write it always did.
	const dom = domModelOf(store.tokens, container)
	let there = false
	return () => {
		// C2 only: touch the DOM first, so the caret write lands on a DIRTY layout the way it
		// does inside a real commit (the per-Surface effects have just written text). C1 leaves
		// layout clean, which is the whole difference under test.
		if (dirtyLayout && container.lastElementChild instanceof HTMLElement) {
			container.lastElementChild.textContent = there ? 'a' : 'b'
		}
		dom.placeCaret(store.tokens.anchorAt(there ? doc.pos : doc.pos + 1))
		there = !there
		sink += 1
	}
}

/** L4: the write verb on an UNMOUNTED store — everything but the DOM. */
function coreCommitKeystroke(doc: Doc, caret = true): Keystroke {
	const store = storeFor(doc)
	// Materializes the tree (`#ensureSeeded`) without changing the value.
	store.tokens.replaceBetween('end', 'end', '')
	return storeKeystroke(store, doc, caret)
}

/**
 * The adapter's DOM, hand-rendered once: one span per root inline, one
 * `div > span > span` per row in block layout (the shape `bind` walks — see
 * `__testing__/mountFixtures.ts`), and then CONSIGNED, because consignment is the element
 * source since the DOM walk was deleted.
 *
 * Building the DOM without consigning it, which this did until now, leaves every mounted rung
 * measuring a bind over an empty registry: no node has an element, so the walk binds nothing and
 * unbinds everything. Every mounted figure recorded in the docblock above predates that change
 * and should be re-taken before it is quoted again.
 *
 * Returns one thunk per registration, in the order an adapter's refs would fire, so the mount
 * rung can replay the ref storm without paying for the parse and the DOM build on every sample.
 */
function mountDom(store: Store, doc: Doc): readonly (() => void)[] {
	// Every mounted rung gets the page to itself: worlds are built lazily and used by one
	// bench each, and leaving the previous fixture attached made a later rung pay style and
	// layout for a document it never edits (measured: block-100's no-caret rung read SLOWER
	// than its caret rung purely from the fixture left over by the rung before it).
	document.body.replaceChildren()
	const container = document.createElement('div')
	document.body.append(container)
	store.host.container(container)
	const consignments: (() => void)[] = []
	for (const root of store.tokens.nodes()) {
		if (doc.isBlock) {
			// A ROW and a TOKEN ELEMENT are different elements of the same token, registered
			// separately — the same pairing `mountBlock` documents in `__testing__/mountFixtures.ts`.
			const row = document.createElement('div')
			const text = document.createElement('span')
			row.append(text)
			container.append(row)
			const surface = root.kind === 'row' ? root.children()[0] : undefined
			consignments.push(() => store.tokens.consign(root.id)(row))
			if (surface) consignments.push(() => store.tokens.consign(surface.id)(text))
		} else {
			const span = document.createElement('span')
			container.append(span)
			consignments.push(() => store.tokens.consign(root.id)(span))
		}
	}
	for (const consign of consignments) consign()
	return consignments
}

/**
 * M1: MOUNT — one registry write per element, which is exactly what an adapter's refs do.
 *
 * The rung the ladder was missing, and its absence is why a Θ(N) → Θ(N²) mount reached a working
 * tree unnoticed. It replays the registrations against an already-built world, so what it measures
 * is the storm itself and not the parse or the DOM build.
 *
 * Read it as a CURVATURE rung, not an absolute one: doubling the document must roughly double the
 * time. A ratio near 4× per doubling means each registration is doing work proportional to the
 * whole document.
 */
function mountRung(doc: Doc): Keystroke {
	const store = storeFor(doc)
	const consignments = mountDom(store, doc)
	return () => {
		for (const consign of consignments) consign()
	}
}

/** L5: the same write on a MOUNTED store — the per-surface DOM write included. */
function fullKeystroke(doc: Doc, caret = true): Keystroke {
	const store = storeFor(doc)
	mountDom(store, doc)
	return storeKeystroke(store, doc, caret)
}

/**
 * L6: L5 with the editor actually FOCUSED — the only rung that describes a person typing.
 *
 * L5 above leaves focus on `document.body`, so its caret rung measures a re-place into an
 * editor nobody is in. That is a real path (an `api` write while the user is elsewhere) but it
 * is not the keystroke path, and it is the one case `SelectionDriver`'s skip-if-already-showing
 * guard deliberately declines to take — it must not swallow the write that pulls focus IN.
 * Measuring only L5 therefore reports that guard as worthless.
 *
 * The oscillating workload keeps this rung honest rather than rigging it: the DOM caret ends up
 * at the model's anchor after the first iteration whichever way the guard goes, so both the
 * guarded and unguarded builds are measured on exactly the same DOM state.
 */
function focusedKeystroke(doc: Doc): Keystroke {
	const store = storeFor(doc)
	mountDom(store, doc)
	const keystroke = storeKeystroke(store, doc, true)
	settleCaretAt(store, doc)
	return keystroke
}

/**
 * Focus the editor and leave BOTH the stored selection and the DOM caret at `doc.pos`.
 *
 * The order is load-bearing and getting it wrong invalidated an earlier version of these rungs:
 * `focusFirst()` places at the FIRST root, which overwrites whatever the stored selection was, so
 * calling it after seeding the selection silently moves the caret to the document start while the
 * edit still happens in the middle. Focus first, then seed.
 */
function settleCaretAt(store: Store, doc: Doc): void {
	store.tokens.focusFirst()
	store.tokens.selection.select(store.tokens.anchorAt(doc.pos))
	const container = store.host.container()
	if (container) domModelOf(store.tokens, container).placeCaret(store.tokens.anchorAt(doc.pos))
}

const options = {time: 1000, warmupTime: 200} as const

/**
 * Builds the world on the first call and reuses it — a mounted world costs more to build
 * than the keystroke it measures, and vitest's warmup pass absorbs that first call.
 */
function lazy(build: () => Keystroke): () => void {
	let keystroke: Keystroke | undefined
	return () => {
		keystroke ??= build()
		keystroke()
	}
}

for (const doc of docs) {
	// oxlint-disable-next-line vitest/valid-title -- one ladder per document, named from the table above
	describe(doc.name, () => {
		bench(
			'L1 splice',
			lazy(() => spliceKeystroke(doc)),
			options
		)
		bench(
			'L2 +parse',
			lazy(() => parseKeystroke(doc)),
			options
		)
		bench(
			'L3 +adopt',
			lazy(() => adoptKeystroke(doc)),
			options
		)
		bench(
			'L3 +adopt @head',
			lazy(() => adoptKeystroke(doc, doc.head)),
			options
		)
		bench(
			'L3 +adopt @tail',
			lazy(() => adoptKeystroke(doc, doc.tail)),
			options
		)
		bench(
			'L4 core commit',
			lazy(() => coreCommitKeystroke(doc)),
			options
		)
		bench(
			'L4 core, no caret',
			lazy(() => coreCommitKeystroke(doc, false)),
			options
		)
		// The mounted rungs need a DOM; the ladder still measures L1–L4 without one.
		if (typeof document === 'undefined') return
		bench(
			'M1 mount (one ref per element)',
			lazy(() => mountRung(doc)),
			options
		)
		bench(
			'L5 full keystroke',
			lazy(() => fullKeystroke(doc)),
			options
		)
		bench(
			'L5 mounted, no caret',
			lazy(() => fullKeystroke(doc, false)),
			options
		)
		bench(
			'L6 focused keystroke',
			lazy(() => focusedKeystroke(doc)),
			options
		)
		bench(
			'L5b stored selection, no post-edit caret',
			lazy(() => storedSelectionKeystroke(doc)),
			options
		)
		bench(
			'C1 caret write only',
			lazy(() => caretOnlyKeystroke(doc)),
			options
		)
		bench(
			'C2 caret write on dirty layout',
			lazy(() => caretOnlyKeystroke(doc, true)),
			options
		)
	})
}