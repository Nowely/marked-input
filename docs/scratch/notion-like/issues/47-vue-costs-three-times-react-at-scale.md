# The Vue adapter costs three times React for the same gesture at document scale

Type: bug
Status: resolved — the adapter rebuilt one shared computed's inputs on every sync; 820 -> 37.5 ms
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

## Answered 2026-08-29 (T-F), and the cause was in the adapter's props sync

**EVERY ROW REPAINTED ON EVERY EDIT, wherever the caret was.** Counted rather than timed, at 4000
rows: `4007` row updates per Enter at the top AND at the bottom — which is exactly why the cost
barely depended on position and why this was never a Vue-flavoured copy of 45.

**One subscription did it, and the probe named it.** Each row holds four `useMarkput` calls; per
edit they ran `slot=4008`, `drag=1`, `sel=1`, `render=1`. So `useMarkput(s => s.slots.node)` woke
once per row while the other three woke once for the whole document.

**And one recompute upstream woke all four thousand.** `SlotsFeature.node` is ONE computed that
every row subscribes to, and it recomputed exactly once per edit (`nodeSlot=1` in Vue, `0` in
React — the same probe in both projects, which is what made the adapters comparable at all). Every
watcher of it re-ran, each wrote a fresh resolver into its own `shallowRef`, and each row repainted.

**The dirt came from `MarkedInput.vue`'s `syncProps`**, which rebuilt two of that computed's five
inputs inline on every sync: `props.options?.map(...)` minted a new array of new option objects, and
`markSlotComponents(props.slots)` a new slots object. React hands both through untouched, which is
the whole of why its counter read zero. Both are Vue `computed`s now, so their identity holds while
the consumer's own array and object are unchanged.

| | before | after |
| --- | --- | --- |
| top of 1000 | 110.9 ms | 12.2 ms |
| top of 4000 | 820.1 ms | **37.5 ms** |
| bottom of 4000 | 475.2 ms | 33.4 ms |
| row repaints per Enter at 4000 | 4007 | **0** |

Vue is now faster than React on this gesture (37.5 against 117.5), because what remains on the React
side is its own keyed reconciliation of the tail and Vue's patch does not pay it.

**Pinned by `scale.vue.spec.ts`**, the twin of the React one and stronger: it counts repaints
through the published `slots.paragraph`, asserts the edit actually happened first, and reddens at
401 at BOTH caret positions when the sync is put back — the React pin can only redden at the top.

**The general shape, corrected — the first version of this paragraph was wrong.** It said a consumer
writing `:options="[...]"` inline buys the same 820 ms back. That is FALSE, and reading
`reportBadProp`'s own docblock is what caught it: `props.options` carries `{equals: shallow}`
(`PropsModel.ts:26`), an ELEMENT-WISE gate, so a fresh array holding unchanged options is already
absorbed. What defeats the gate is minting new ELEMENTS, which is exactly what `syncProps`' `markRaw`
map did — the array was never the problem, its contents were.

**`slots` and `slotProps` had no gate at all**, and that WAS a live consumer hazard: a fresh object
each render — which `slots={{paragraph: P}}` written inline is — dirtied one input of the same
shared computed and repainted the whole document. Both carry `{equals: shallow}` now. Measured on
the pin: with the slots object deliberately rebuilt on every sync, it reddened at 401 before the
gate and is green after, so the gate is what closes it rather than the adapter's own care. The
adapter's `rawSlots` computed came out again as redundant once the gate existed; `rawOptions` stays,
because no shallow gate can absorb newly minted elements.

**Which half was load-bearing: both, independently.** Rebuilding only the options and rebuilding
only the slots each redden the pin at 401 on their own, so neither fix was riding the other.

**What is still unguarded, honestly:** `slotProps`' nested bags are compared by reference, so a
consumer rebuilding `{row: {...}}` inline still dirties it. One more level of comparison would cost
more than it is worth until someone meets it.