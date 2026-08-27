# Nothing is measured at document scale: row-verb runtime and caret ergonomics

Type: research
Status: resolved — measured 2026-08-27; the row layer is free, a STRUCTURAL edit is not
Blocked by: —

## Problem

Two items on `outcome.md`'s open list say the same thing about different subjects: the editor has
never been driven or timed on a document large enough to hurt.

**Runtime** — `outcome.md`'s item 30:

> **Row-verb runtime is uncharacterised.** `rowOf` is a full pre-order walk now run on every Enter,
> Tab and Backspace, with no benchmark. The one figure that exists is the drop tick: **~1.5 ms per
> `dragover` at 4000 rows, 9% of a frame**, kept because the alternative is a depth rule restated
> outside the mover.

`insights.md:170-173` records that same figure as the one place a cost is stated at all, and notes
what it buys: the drop's depth is chosen by the pointer's X in MEASURED indent units, so *"its cost
is stated where nothing else states one."*

**Ergonomics** — `outcome.md`'s item 27 and `map.md:743-745`: *"Caret ergonomics at document scale
— atomic tables and code blocks, Tab leaving the field (ADR-0002's accepted cost) — are unmeasured
over a document this size. Native undo is no longer on that list: the editor owns it (ADR-0012)."*

## Why it matters here

AGENTS.md's own engineering default is that *"performance claims need a benchmark or a documented
hot path"*, and the row verbs are on the keystroke path with neither. Twelve driving sessions all
ran on an 87-line showcase; the one number anybody has for 4000 rows came out of the drag.

## Shape of the work

A bench beside `commitCost.bench.ts` for `rowOf` / Enter / Tab / Backspace at 100, 1000 and 4000
rows, and one driving session on a document of that size. It is research: the output is numbers and
a verdict on whether anything needs an owner, not a fix.

## MEASURED, 2026-08-27

Two halves, because they answer different questions and they disagree by two orders of magnitude.

### Half one — core, `packages/core/src/features/tokens/rowVerbCost.bench.ts`

Run with `pnpm bench`. Chromium, idle machine, mean ms per gesture, two runs agreeing to ~5%.
Documents are plain rows with a `'\n'` separator; `nested` is a repeated depth-4 ladder. Every
store is MOUNTED and consigned, because half of these rungs ask the DOM and an unmounted store
takes the early return out of all three settle arms.

| rung | flat 100 | flat 1000 | flat 4000 | nested 4000 |
| --- | --- | --- | --- | --- |
| W1 `preorderRows` — the whole walk | 0.0035 | 0.062 | 0.206 | 0.275 |
| W2 `rowOf` @mid — what every row key runs first | 0.0011 | 0.018 | **0.067** | 0.103 |
| W3 `boundarySpan` — Backspace's row half | 0.012 | 0.162 | 0.511 | 0.723 |
| K1 plain keystroke — the commit, structure unchanged | 0.19 | 1.21 | **6.15** | 6.59 |
| V1 Enter (`splitAt`) | 0.20 | 1.42 | 6.03 | 6.93 |
| V2 Tab (`indentRows`) | 0.009 | 0.139 | 0.496 | 0.684 |
| V3 Backspace merge | 0.102 | 1.53 | 7.32 | 7.53 |
| S1 settle pass (`#settleRows`+`#settleTail`+`#settleCaret`) | 0.25 | 1.45 | 6.40 | 6.72 |
| P1 `RowController.refuse` | 0.0001 | 0.0001 | 0.0001 | 0.0001 |

Read across, three answers:

- **`rowOf` is not a cost.** The ticket's premise — *"a full pre-order walk now run on every Enter,
  Tab and Backspace, with no benchmark"* — is measured and does not survive it: 0.067 ms at 4000
  rows, **1.1% of the keystroke it precedes** and 0.4% of a 16.7 ms frame. It is cheaper than the
  full walk because it stops at the row it finds. Nesting costs it ~50%, still nothing.
- **Every row verb costs what a PLAIN keystroke costs.** V1 ≈ K1 at every size, V3 within 20%, V2
  an order of magnitude cheaper (a trimmed window, no re-lead). So the row layer adds nothing
  measurable to a commit; what a verb costs is the commit, which `commitCost.bench.ts` already
  prices and which is linear in the document.
- **The tail invariant's walk is ~3 walks, and it shows.** S1 − V1 is 0.05 / 0.03 / 0.37 ms — the
  same order as 3 × W1, i.e. the settle pass IS its three `preorderRows` walks and nothing else.
  The affordance group flagged it as an undeclared cost; declared, it is **~6% of the commit it
  follows** at 4000 rows. `#recoverCaret` is a fourth walk of the same shape, run only when the
  caret's row stops being enterable, so its cost is W1 and it needs no rung of its own.
- **The refusal channel is free** — one signal write, size-independent. The PAINT is the adapter's
  and is outside this bench's half; the browser half below shows no keystroke cost for it either.

### Half two — the real adapter, driven in Chromium

The Notion showcase mounted controlled at 100 / 1000 / 4000 generated rows, React, with each
gesture awaited to the next frame and the same wait around a keydown NOTHING handles subtracted as
the floor (8.3 ms — the frame cadence). Median of 20. The harness was temporary and is not
committed; it is 60 lines of `Notion.react.spec.tsx`'s own helpers plus:

```ts
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const runs = async (times: number, run: () => void): Promise<number> => {
	await frame()
	const start = performance.now()
	for (let i = 0; i < times; i++) {
		run()
		await frame()
	}
	return (performance.now() - start) / times
}
const floor = await runs(20, () => key('F13'))
```

| gesture | 100 rows | 1000 rows | 4000 rows |
| --- | --- | --- | --- |
| mount (first paint of the whole document) | 35 ms | 53 ms | 208 ms |
| type one character | 0.0 | 0.0 | **9.5** |
| ArrowDown | 0.0 | 0.0 | 0.0 |
| **Enter** | 1.1 | **32.7** | **159.6** |

Two runs, agreeing to ~2%. Read it against half one and the difference is the whole finding:

- **Caret motion is free at every size.** ArrowDown never leaves the frame, which answers the
  ergonomics half: nothing about moving around a 4000-row document costs anything.
- **Typing is free to 1000 rows** and costs about one dropped frame at 4000. That matches core's
  K1 (6.15 ms) plus the one row React repaints: a text edit keeps `nodes()`' reference, so the
  adapter re-renders one Surface.
- **A STRUCTURAL edit does not.** Enter costs 159 ms at 4000 rows where core's own `splitAt` costs
  6 — so **96% of it is the adapter re-rendering every row**, because a split changes the node list
  and `Container` maps it. At 1000 rows it is already 33 ms, two dropped frames, on the plainest
  key in the editor.

## Verdict

**One thing needs an owner, and it is not in this ticket's title.** The row verbs, `rowOf`, the
settle pass and the refusal channel are all measured and all free; the ticket's own premise about
`rowOf` is refuted. What is not free is a structural row edit at document scale, and the cost is
**adapter re-render, not core** — a 26× gap between the same gesture measured either side of the
seam. It is invisible below ~500 rows, noticeable at 1000 and a visible stall at 4000.

That is a keyed-list question, not a row question: `nodes()` changes identity on a split, both
adapters map it, and neither memoizes a Row against an unchanged node. It is also the FIRST cost in
this effort that a user could feel, so it is worth a ticket of its own rather than a line here —
and it wants deciding against the incremental-parser work already costed and deferred
(`docs/scratch/incremental-parser/spec.md`), which attacks the 6 ms core half and would not touch
the 153 ms adapter half.

The drag figure the record already had — ~1.5 ms per `dragover` at 4000 rows — is consistent with
this table: it is roughly 7 × W1, which is what a mover walking the document per tick costs.
