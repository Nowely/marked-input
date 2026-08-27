# The painted selection is not the span a keystroke replaces

Type: task
Status: needs-triage — driven and measured 2026-08-27; the paint is recorded, the direction is still the maintainer's
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


## Driven, 2026-08-27 (T-E)

The ticket's own first step — *"drive the gesture on the showcase and record what the browser
actually paints across a fence"* — is done. React, Chromium, a hand-built range because the mouse
sweep that produces it is a drag; `Selection.toString()` for what is highlighted and
`Range.getClientRects().length` for how many boxes the user sees.

| sweep | painted | boxes | typed once, value became |
| --- | --- | --- | --- |
| `head` `he\|ad` → `co\|de` inside a fence | `"ad⏎⏎co"` — 6 chars | 3 | `'heZ⏎```js⏎code⏎```⏎plain'` |
| `▸ head` `he\|ad` → `af\|ter`, toggle CLOSED | `"ad⏎af"` — 5 chars | 4 | `'▸ heZ⏎⇥body⏎after'` |

So the paint is not a near miss: the browser highlights across the fence's opener and closing
literal, in three separate boxes, and the write takes the two characters in the first of them. The
user sees six characters selected, types one, and four of them are still there — still highlighted,
in fact, until the selection is re-placed.

**THE SECOND ROW IS NEW, and it is this pass's doing.** Ticket 43's fix put the same visibility clip
on an ordinary mid-row sweep, so a sweep across a CLOSED TOGGLE now writes a shorter span than the
browser painted, exactly as a sweep into a fence already did. That is a strict improvement — it is
what stops the hidden body being deleted — and it widens this ticket's reach from one shape to two.
Declared at the commit rather than left to be found here.

**AND A THIRD, from 43's review round.** A sweep starting at the toggle's title END writes the
first NON-EMPTY visible stretch, which is on the FAR side of the hidden body:

| sweep | painted | typed once, value became |
| --- | --- | --- |
| `▸ head` `head\|` → `af\|ter`, toggle CLOSED | `"⏎⇥body⏎af"` | `'▸ head⏎⇥body⏎Zter'` |

The write is inside the paint as before, but for the first time it does not start at the paint's low
edge — it lands after a stretch the browser highlighted. Whichever direction this ticket takes, the
clamp it paints is a SUBRANGE of the sweep and not a prefix of it.

## What the two directions look like now, priced

The ticket named them; the measurement prices them.

1. **Paint the clamp** — re-seat the selection onto the span the write would take, once the sweep
   settles. The span is already computed (`TokenModel.rowSelectionText`) and the editor already
   owns a `selectionchange` listener, so the machinery exists. The cost is that a drag would fight
   it: re-seating mid-drag moves the base the browser is extending from, which is exactly the defect
   ticket 12 fixed by NOT writing back during a sweep. So it has to wait for the drag to end, and
   "when a sweep settles" is the part that is not measured.
2. **Clamp the sweep** — refuse to extend into a raw closed body or past a hidden row at all. Cheaper
   to see and it needs no timing, but it changes what a drag CAN select, which is a bigger claim
   than the write's: a user who wants the fence's text can no longer sweep into it from outside.

Neither is taken here. The measurement above is what the ticket asked for first, and the choice
between a paint change and a gesture change is the maintainer's.
