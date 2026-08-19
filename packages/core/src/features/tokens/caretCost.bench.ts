import {bench, describe} from 'vitest'

/**
 * WHAT A CARET WRITE COSTS, and what that cost is charged against.
 *
 * `commitCost.bench.ts` established that a keystroke on a large document is ~97% caret, that
 * exactly one selection write happens per keystroke, and that the same write is cheap on clean
 * layout and expensive after the DOM was touched. That named the mechanism — writing the
 * selection forces a synchronous layout — but not what the bill scales with. Each rung here
 * writes the SAME collapsed caret, varying only the host size, whether the host is editable, and
 * WHICH node was dirtied first. Nothing from `features/` is involved: this is a browser
 * measurement, deliberately isolated so a regression here cannot be mistaken for one of ours.
 *
 * ── WHAT IT ANSWERED ────────────────────────────────────────────────────────────────────
 *
 * At 2000 spans, two runs on an idle machine: clean layout 0.0013 / 0.0012 ms; dirtied OWN span
 * 83 / 97 ms; dirtied FAR span 83 / 66 ms; plain (non-editable) host 79 / 65 ms. The three dirty
 * rungs are one number under ±25-36% rme — that noise is inherent, not contention: each iteration
 * costs ~80 ms so the run collects only ~10 samples. Run on an IDLE machine even so; see the
 * measurement note in `commitCost.bench.ts`.
 *
 * 1. LOCALITY BUYS NOTHING. Dirtying the caret's own surface — what a keystroke actually does —
 *    costs the same as dirtying one at the far end. There is no cheap local path to find.
 * 2. `contenteditable` IS NOT THE FACTOR. A plain host pays the same. So EditContext does not
 *    remove this cost by being non-editable; it removes it only insofar as the BROWSER moves
 *    the caret itself and JS never writes the selection on the typing path at all.
 * 3. CLEAN LAYOUT IS FREE AT EVERY SIZE — 0.001 ms whether the host holds 10 spans or 2000.
 *
 * So the remedy is not a cheaper write, a smaller scope, or a different host: it is not writing
 * the selection while layout is dirty. Placing BEFORE the mutation cannot work either, and that
 * is closed by the DOM's own range-adjustment rules rather than by measurement — after inserting
 * at the caret, the wanted position is INSIDE the inserted text, and no pre-edit boundary maps
 * there (a point at the insertion offset does not move; a point after it overshoots by the whole
 * insertion). What is left is letting the browser move the caret as part of handling the input.
 *
 * CAVEAT on the small sizes: 10 spans reads ~1.4 ms and 200 spans ~0.49 ms, which is not
 * monotonic and so cannot be a per-node cost. Something page-level dominates below ~1000 nodes.
 * Trust the clean-vs-dirty ratio and the 2000-span figure; do not quote the small absolutes.
 */

let sink = 0

type World = {surface: Text; dirty: HTMLElement; host: HTMLElement}

/** `spans` sibling spans under one host, each with its own Text node — the shape bind walks. */
function buildWorld(spans: number, editable: boolean): World {
	document.body.replaceChildren()
	const host = document.createElement('div')
	if (editable) host.contentEditable = 'true'
	document.body.append(host)
	let surface: Text | undefined
	let dirty: HTMLElement | undefined
	for (let i = 0; i < spans; i++) {
		const span = document.createElement('span')
		span.append(document.createTextNode(`word${i} and more text here `))
		host.append(span)
		// The caret always lives in the middle span. The LAST span is what the 'far' rungs dirty,
		// so that variant is not confounded by editing the very node the caret sits in; the 'own'
		// rung dirties the middle one instead.
		if (i === spans >> 1) surface = span.firstChild instanceof Text ? span.firstChild : undefined
		if (i === spans - 1) dirty = span
	}
	if (!surface || !dirty) throw new Error('bench fixture is degenerate')
	return {surface, dirty, host}
}

type Dirty = 'none' | 'far' | 'own'

function caretWriter(spans: number, editable: boolean, dirty: Dirty): () => void {
	const world = buildWorld(spans, editable)
	const selection = window.getSelection()
	if (!selection) throw new Error('no selection')
	if (editable) world.host.focus()
	// 'own' is the REALISTIC one: a keystroke rewrites the surface the caret is in, not a distant
	// one. 'far' is the pessimistic control — if the two agree, locality buys nothing and the bill
	// is for the whole host either way.
	const target = dirty === 'own' ? world.surface : world.dirty.firstChild
	let there = false
	return () => {
		if (dirty !== 'none' && target instanceof Text) target.replaceData(0, 1, there ? 'a' : 'b')
		selection.collapse(world.surface, there ? 3 : 4)
		there = !there
		sink += 1
	}
}

const options = {time: 700, warmupTime: 150} as const

/**
 * Build on FIRST CALL, never at registration — and this is not a style choice, it invalidated an
 * earlier run of this file. Every world starts with `document.body.replaceChildren()`, so worlds
 * built eagerly all detach each other and only the last-registered rung measures an attached DOM;
 * the rest silently measure a selection write into a fragment, which is uniformly ~0.0001 ms at
 * every size. Vitest's warmup pass absorbs the build.
 */
function lazy(build: () => () => void): () => void {
	let run: (() => void) | undefined
	return () => {
		run ??= build()
		run()
	}
}

for (const spans of [10, 200, 2000]) {
	describe(`${spans} spans`, () => {
		bench(
			'editable, clean layout',
			lazy(() => caretWriter(spans, true, 'none')),
			options
		)
		bench(
			'editable, dirtied OWN span',
			lazy(() => caretWriter(spans, true, 'own')),
			options
		)
		bench(
			'editable, dirtied FAR span',
			lazy(() => caretWriter(spans, true, 'far')),
			options
		)
		bench(
			'plain host, dirtied FAR span',
			lazy(() => caretWriter(spans, false, 'far')),
			options
		)
	})
}

export {sink}