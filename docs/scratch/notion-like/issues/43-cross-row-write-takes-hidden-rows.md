# A cross-row write takes the rows a collapsed toggle hides

Type: bug
Status: needs-triage
Blocked by: —

## Problem

Ticket [13](13-collapsed-body-lost-on-a-row-cover.md) established the rule — *a write may not take
content nobody can see* — and it is enforced in two places: `TokenModel.replaceRows` (which puts
every hidden subtree back and takes the rest) and `rowSelectionText` (which shrinks a span to the
first hidden subtree, via `#visibleEnd`). Both read `TokenModel.#hiddenWithin`.

`splitPlan`'s crossing arm is a THIRD write path over multiple rows and consults neither.
`writeRowsFromInput` (`rowKeys.ts`) hands the verb the RAW event anchors, and the plan consumes
every pre-order line between the two ends.

**Measured** (review, 2026-08-27, on the showcase's own collapsed-toggle harness): `'▸ head⏎⇥body⏎after'`
with the toggle collapsed, a plain sweep from `he|ad` to `af|ter`, then the browser's paste sequence
carrying `'one⏎two'`:

```
value → "▸ heone⏎twoter"     // the hidden "⇥body" is gone, nothing on screen having shown it
```

Re-run with `siblings.ts` and `TokenModel.ts` at `da03807d~1`: **identical bytes**. So this is
**pre-existing** — the raw splice did the same thing — and the widening neither caused nor fixed it.

## Why it is worth doing now rather than later

The widening deliberately moved this gesture off "the ordinary splice, which wrote bytes in nobody's
language" and onto a plan that speaks the row language. The exclusion belongs in a plan, not in a
splice: doing it before would have been a patch, doing it now is one clause in a function that
already walks the lines.

## The shape a fix would take

`tree/` cannot ask the question — whether a row paints a box is a DOM fact — so the gate belongs at
the seam, in `TokenModel.writeRows`, beside the two doors that already read `#hiddenWithin`.
**Refusing** the plan rather than truncating it is the shape to try first: 13's own history is that
truncating a span was wrong twice.

## Its sibling

[40](40-copy-projects-what-the-write-excludes.md) is the same asymmetry read from the other side —
a COPY projects what the write excludes. Whoever takes one should read the other.

## What the property cannot say about it

`writeRows.property.spec.ts` has no hidden-row oracle and cannot grow one as it stands: its stores
never paint, so `rowPaint` is never `'boxless'`.
