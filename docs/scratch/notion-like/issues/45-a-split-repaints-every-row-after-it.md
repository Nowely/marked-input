# A structural row edit re-renders every sibling after it

Type: bug
Status: resolved — the cause is confirmed and half the cost is gone; the residual is React's own and is named
Blocked by: —

> Filed out of [33](33-nothing-is-measured-at-document-scale.md), whose measurement found it. 33
> asked whether the ROW VERBS cost anything at document scale; they do not, and this is the thing
> that does. It is the first cost in this effort that a user could feel.

## Problem

Enter at the top of a 4000-row document costs **286 ms** — about seventeen dropped frames — where
core's own `splitAt` on the same document costs **6 ms**. The other 280 are the adapter.

MEASURED 2026-08-27, React, Chromium, the Notion showcase mounted controlled at 4000 plain rows,
each gesture awaited to the next frame with the frame cadence subtracted, median of 10:

| where the caret is | rows AFTER it in its list | Enter |
| --- | --- | --- |
| row 1 | 3999 | 286.2 ms |
| row 2000 | 2000 | 160.8 ms |
| row 3998 | 2 | 32.8 ms |

The cost is linear in the number of SIBLINGS AFTER the edit, at ~0.064 ms each, over a fixed ~30 ms.
Two controls say the same thing from the other side:

- **ArrowDown and typing are free.** 0.0 ms at every size for the caret; typing costs 9.5 ms at
  4000 rows and 0.0 at 1000, which is core's own commit plus the ONE row React repaints — a text
  edit keeps `nodes()`' reference, so the adapter re-renders one Surface.
- **The same Enter inside a NESTED row is flat.** Re-measured after a Tab had moved the caret's row
  into a parent's child list, Enter read 18.1 / 17.4 / 20.4 ms at the three positions — no slope at
  all, because the row it splits has no siblings after it. Tab itself shows the same shape
  (28.3 / 19.2 / 7.2), and Tab moves a row OUT of the root list, which shifts every following
  root row by one.

## The leading cause, and it is a HYPOTHESIS

`Row` is `memo`'d on `{node, depth, index}` (`packages/react/markput/src/components/Row.tsx:38`) and
`Rows` maps a sibling list with `index` as the position among siblings. Inserting or removing one
row shifts `index` for every row after it in that list, so the memo misses on every one of them
even though its `node` and its own content are unchanged. That is exactly the shape the measurement
has: linear in the rows AFTER the edit, flat when none follow.

It is a hypothesis and not a measurement, because the numbers cannot separate it from React's own
keyed reconciliation of 4000 children. The experiment that settles it is one line: drop `index`
from `Row`'s props and re-measure the table above. If the slope goes and the fixed ~30 ms stays,
`index` is the whole of it.

## What makes it a decision rather than a fix

`RowProps.index` is PUBLISHED and was deliberately kept in
[36](36-published-surface-leftovers.md) — *"`index` kept — as a sibling position, not the ordinal
first published"* — so a consumer's row component may be reading it. The options are a published
surface change or a way to deliver it that does not sit in the memo's dependency list, and picking
between them is the maintainer's.

The Vue half is unmeasured: the harness was React-only. It shares neither `memo` nor `Rows`, so its
number could differ by a lot in either direction, and it wants taking with [26](26-vue-showcase-p12.md).

## What it is not

Not the parse and not the commit. `packages/core/src/features/tokens/rowVerbCost.bench.ts` prices
the core half of the identical gesture at 6.03 ms on 4000 rows, and every read the row layer makes
— `rowOf` at 0.067 ms, the settle pass's three walks at 0.37 ms — is inside the noise of that. The
incremental-parser work already costed and deferred
(`docs/scratch/incremental-parser/spec.md`) attacks the 6 ms and would not touch the 280.

## Answered 2026-08-29 (T-F), and its own discriminator was wrong

**THE HYPOTHESIS IS CONFIRMED, THE DISCRIMINATOR IT PROPOSED IS NOT.** Line 46 says *"drop `index`
from `Row`'s props and re-measure … if the slope goes and the fixed ~30 ms stays, `index` is the
whole of it."* It is not the whole of it. Frozen, the slope FALLS BY ABOUT 65% and stays:
248.3 → 117.5 ms at the top of 4000, with row repaints going 4001 → 1. An independent measurement,
run blind — the seat was given the phenomenon and explicitly not the suspected cause, and was told
not to read this directory until it had its own answer — reproduced the shape and the repaint
counts on another machine and through another driver, at 194.1 / 119.4 / 15.5 ms, and put the slope
at 0.045 → 0.016.

**THE FIXED FLOOR IS NOT FIXED.** The table above reads 32.8 ms at row 3998 of 4000 and calls it a
constant. Measured at two sizes, the bottom-of-document cost is 15.5 ms at 1000 rows and 46.8 at
4000 — linear in the WHOLE document at about 0.010 ms per row, on top of a real constant near 5 ms.
So there are two terms, not one and a floor.

**A SECOND CAUSE RODE THE SAME PATH, and this ticket named nothing of it:** `setRowRef` was minted
fresh on every render, so React detached and re-attached the ref of every repainted row — four
rebind pulses per row, counted. Held stable it roughly halved the slope on its own, before `index`
was touched. It cost no published surface and landed with the fix.

**WHAT WAS RULED OUT, each by its own measurement rather than by argument.** With the position
frozen and one component rendering, the residual slope is not: the settle pass (`#settleRows` +
`#settleTail` + `#settleCaret` + `reclaimFocus` = 1.1 ms at 4000), DOM mutation (one node inserted,
two attributes — identical top and bottom), forced reflow (0.7 ms for the same insertion, and 15
geometry reads totalling 0.6 ms), recomputed subscriptions (12 recomputations, position-
independent), React's render phase (6.8 ms by `<Profiler>`), the controlled round trip (an
UNCONTROLLED mount shows the same slope: 79.7 vs 40.2), or core's re-adoption of the echoed value
(9.4 ms, position-independent). A pure-React control — 4000 memoised keyed children, one inserted
at the head — costs 4 ms. What is left is React's reconciliation of a keyed list whose head moved,
and it needs windowing rather than a fix.

**Line 28-30 is stale.** *"Typing costs 9.5 ms … which is core's own commit plus the ONE row React
repaints"* — core writes a text surface through its own per-surface effect; React repaints neither
a Row nor a Token for an ordinary text change.

Landed as ADR-0013: `RowRender` carries `depth` alone, both adapters' `RowProps` drop `index`
(a breaking change, taken at the maintainer's word), and `scale.react.spec.tsx` pins the REPAINT
COUNT rather than a millisecond budget — seen red at 401 when the position is handed down again.
