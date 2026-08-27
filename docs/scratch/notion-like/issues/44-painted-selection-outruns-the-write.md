# The painted selection is not the span a keystroke replaces

Type: task
Status: needs-triage
Blocked by: —

> Split out of [29](29-refusal-is-silent.md) during the affordance group's review. 29 named it in
> its Problem section, answered the other two items, and closed `resolved` without a word on this
> one — which is exactly the "record the reason so nobody re-opens it blind" discipline, missed on
> one of three items.

## Problem

`insights.md:150-160`, the final driving session's sharpest line:

> *"Painted highlight ≠ what a keystroke replaces, in both directions"* — a sweep into a fence
> paints 20 characters that survive typing (a correct clamp, an incomprehensible paint), and a
> sweep across a collapsed toggle eats two hidden lines that were never painted at all.

The second half is [13](13-collapsed-body-lost-on-a-row-cover.md) and is closed. This is the first
half, and it is NOT a data-loss bug: the clamp (`488ab0a5`) is right — a sweep whose end lands
inside a raw closed body writes a smaller span than the browser painted, and the fence survives.
The user sees twenty highlighted characters, types one, and twenty characters are still there.

## Why it is not [29](29-refusal-is-silent.md)'s channel

29's channel says *"the editor consumed your key and did nothing"*. Here the editor DID something —
it wrote, on a span the user did not ask for. `refuse()` would be a lie, and the tint names a row
where the mismatch is a span. This is a PAINT problem: the selection shown has to be the selection
that will be replaced.

## Shape of a fix

Two directions, and picking one is the triage:

1. **Paint the clamp.** The editor already owns a row-selection overlay (`.RowSelected::after`).
   The write's span is known before the key arrives — `rowSelectionText` computes it — so the
   selection could be re-seated onto the clamped span when the sweep settles, and the browser's own
   highlight would then be the truth.
2. **Clamp the SWEEP, not the write.** Refuse to extend a selection into a raw closed body at all,
   so the painted end never enters one. Cheaper to see, and it changes what a drag can select.

Neither is measured. Whoever takes it should first drive the gesture on the showcase and record
what the browser actually paints across a fence, because the clamp's bounds were corrected once
already (`0851786a`).
