import {bench, describe} from 'vitest'

/**
 * IS THE LAYOUT ITSELF THE COST, OR ONLY THE FACT THAT WE FORCE IT?
 *
 * `caretCost.bench.ts` showed a selection write after a DOM mutation costs ~80 ms at 2000 spans
 * and ~0.001 ms on clean layout, and concluded the write forces a synchronous layout. That leaves
 * the decisive question open, and the entire "let the browser insert the character" direction
 * hangs on it:
 *
 *   The layout HAS to happen. The DOM changed, so it must be laid out before the next paint.
 *   If forcing it early merely moves work the frame was going to do anyway, then handing the
 *   insertion to the browser changes nothing — the frame still costs ~80 ms and typing still
 *   stutters. The direction only pays if forcing it makes the browser lay out MORE than once.
 *
 * So compare, on the same mutated DOM:
 *
 *   - `selection.collapse`  — what markput does today
 *   - `void host.offsetHeight` — a bare forced reflow, no selection involved at all
 *   - mutate only — the layout is left for the frame and is NOT in the measured span
 *
 * If the reflow rung matches the selection rung, the bill is the LAYOUT, not the selection, and
 * nobody can avoid it by changing who writes the caret. If the reflow is cheap and only the
 * selection rung is expensive, the selection write is doing something extra and is worth attacking.
 *
 * The mutate-only rung is the control that says how much of the cost is the mutation itself
 * (it should be ~free — a mutation only marks things dirty).
 *
 * ── WHAT IT ANSWERED, and it closes the question rather than narrowing it ────────────────
 *
 * At 2000 spans, two runs on an idle machine: mutate + `selection.collapse` 73.0 / 101.6 ms;
 * mutate + bare forced reflow 76.8 / 104.9 ms; mutate only 0.0003 ms. The bare reflow costs what
 * the selection write costs — in BOTH runs, which is the point — so THE BILL IS
 * THE LAYOUT, not the selection. `Selection.collapse` is not doing anything special — it forces
 * the layout that any layout read would force, and the frame has to pay it either way.
 *
 * That kills "let the browser insert the character and move the caret" on its own: the browser
 * lays out too. The work does not disappear by changing who triggers it.
 *
 * Then the chunking rungs found what the cost actually IS. Same 2000 spans, same mutation, same
 * selection write, varying only how the spans are grouped:
 *
 *   one flat inline context   73.0 / 101.6 ms  (±19-32% rme, ~10 samples — inherently noisy,
 *                                              each iteration is ~80 ms so the run gets few)
 *   1 span per block            0.237 / 0.291 ms (±0.8-6%)
 *   20 spans per block          0.047 / 0.052 ms (±2%)
 *
 * Three orders of magnitude, far outside the noise. The whole cost is that inline layout puts the
 * entire document in ONE inline formatting context, and editing one character reflows it
 * wholesale. Nothing about markput is involved — this is a browser property of a flat inline run.
 *
 * markput's BLOCK layout already has the fix by construction, one block per Row, which is why
 * `commitCost.bench.ts` reads block-1000-rows at ~0.8 ms against inline-1000-marks at 16-40 ms
 * for the same token count.
 *
 * Run these on an IDLE machine. Under background load the absolutes inflate and the big rungs'
 * rme goes past 100%; the three-orders-of-magnitude gap survives either way, but the figures do
 * not. See the measurement note in `commitCost.bench.ts`.
 *
 * DIAGNOSTIC, NOT A PRESCRIPTION. Do not read this as "chunk inline layout into blocks": a block
 * box breaks the line, and an inline field has to flow as one paragraph. The finding is that the
 * remaining latency belongs to a document shape — a single 42 KB inline paragraph — that no
 * realistic inline field has. At 200 spans the flat arm is 0.62 ms, which is fine.
 */

let sink = 0

type World = {surface: Text; host: HTMLElement}

/**
 * `chunk` = 0 puts every span in ONE inline formatting context, which is markput's inline layout.
 * Any other value wraps each `chunk` spans in a block `div`, which is what block layout already
 * produces (one block per Row). Changing one character reflows an inline formatting context
 * WHOLESALE, so the chunk size is the hypothesis under test.
 */
function buildWorld(spans: number, chunk = 0): World {
	document.body.replaceChildren()
	const host = document.createElement('div')
	host.contentEditable = 'true'
	document.body.append(host)
	let surface: Text | undefined
	let block: HTMLElement | undefined
	for (let i = 0; i < spans; i++) {
		if (chunk > 0 && i % chunk === 0) {
			block = document.createElement('div')
			host.append(block)
		}
		const span = document.createElement('span')
		span.append(document.createTextNode(`word${i} and more text here `))
		;(block ?? host).append(span)
		if (i === spans >> 1) surface = span.firstChild instanceof Text ? span.firstChild : undefined
	}
	if (!surface) throw new Error('bench fixture is degenerate')
	host.focus()
	return {surface, host}
}

type After = 'collapse' | 'reflow' | 'nothing'

function writer(spans: number, after: After, chunk = 0): () => void {
	const world = buildWorld(spans, chunk)
	const selection = window.getSelection()
	if (!selection) throw new Error('no selection')
	let there = false
	return () => {
		// The same mutation on every rung: rewrite one character of the caret's own surface,
		// which is what a keystroke does.
		world.surface.replaceData(0, 1, there ? 'a' : 'b')
		if (after === 'collapse') selection.collapse(world.surface, there ? 3 : 4)
		else if (after === 'reflow') sink += world.host.offsetHeight
		there = !there
		sink += 1
	}
}

const options = {time: 700, warmupTime: 150} as const

/** Build on FIRST CALL — worlds detach each other, see caretCost.bench.ts's note. */
function lazy(build: () => () => void): () => void {
	let run: (() => void) | undefined
	return () => {
		run ??= build()
		run()
	}
}

for (const spans of [200, 2000]) {
	describe(`${spans} spans`, () => {
		bench(
			'mutate + selection.collapse',
			lazy(() => writer(spans, 'collapse')),
			options
		)
		bench(
			'mutate + forced reflow',
			lazy(() => writer(spans, 'reflow')),
			options
		)
		bench(
			'mutate only, layout left to the frame',
			lazy(() => writer(spans, 'nothing')),
			options
		)
		bench(
			'collapse, 1 span per block',
			lazy(() => writer(spans, 'collapse', 1)),
			options
		)
		bench(
			'collapse, 20 spans per block',
			lazy(() => writer(spans, 'collapse', 20)),
			options
		)
	})
}

export {sink}