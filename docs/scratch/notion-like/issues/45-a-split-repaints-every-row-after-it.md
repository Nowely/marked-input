# A structural row edit re-renders every sibling after it

Type: bug
Status: needs-triage
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
