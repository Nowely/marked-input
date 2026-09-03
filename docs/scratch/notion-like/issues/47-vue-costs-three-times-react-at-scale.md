# The Vue adapter costs three times React for the same gesture at document scale

Type: bug
Status: needs-triage
Blocked by: —

> Filed out of [45](45-a-split-repaints-every-row-after-it.md), whose Vue half that ticket declared
> unmeasured: *"the harness was React-only. It shares neither `memo` nor `Rows`, so its number could
> differ by a lot in either direction."* It differs by a lot, in the worse direction.

## Problem

The same Enter, the same showcase, the same document, the same machine and the same harness — the
one that was React-only until now runs in both projects, because it is framework-free:

| where the caret is | rows | Vue | React (before ADR-0013) | React (after) |
| --- | --- | --- | --- | --- |
| top | 1000 | **110.9 ms** | 64.6 ms | 25.1 ms |
| bottom | 1000 | **96.8 ms** | 16.6 ms | 12.4 ms |
| top | 4000 | **820.1 ms** | 248.3 ms | 117.5 ms |
| bottom | 4000 | **475.2 ms** | 38.8 ms | 43.6 ms |

Two things in that table are worse than a constant factor.

**THE BOTTOM IS NEARLY AS EXPENSIVE AS THE TOP.** In React, Enter at the end of the document costs
a small fraction of Enter at the start, because only the rows after the caret are affected. In Vue
the two are within a factor of 1.7 — so most of the cost is proportional to the WHOLE document
rather than to the tail after the edit. That is a different defect from 45's, not a Vue-flavoured
copy of it, and `RowProps.index` was never its cause: Vue re-renders off its own reactivity and
took no memo dependency on the position.

**IT IS ALREADY VISIBLE AT 1000 ROWS.** 111 ms at the top of a thousand-row document is six dropped
frames on a document a person could actually write.

## What is measured and what is not

Measured: the numbers above, median of 10, each gesture awaited to the next frame with the frame
cadence subtracted, and the whole cost sits in the microtask drain after the event (798.9 of the
820.1 at the top of 4000; the synchronous half is 4.6 ms, so core's own commit is not it).

NOT measured, and the first thing to do: which Vue work it is. The obvious suspects are the ones
[46](46-vue-row-kind-has-no-reactive-node-read.md) is about — every row kind copies an incantation
to read its own node reactively, and each row holds several `computed`s and an `effect` bridging
core's signals into Vue's — but nothing yet says so. A render counter is NOT the instrument: Vue
runs `setup` once per instance, so the probe that answers this question in React (`renders=1`)
answers nothing here, and a run that reported it was reading its own mistake.

## Why it matters here

The showcase and its whole net are framework-free specifically so that a divergence between the
adapters is a failing test rather than a difference nobody diffs. This is the largest divergence
found so far and no test says a word about it, because every test in the net asserts behaviour and
none asserts cost.

The React side now has one that does — `scale.react.spec.tsx` pins the repaint count — and it is
React-only on purpose, because the count is meaningless in Vue. Whatever instrument answers this
ticket is also what a Vue-side pin would be built from.
