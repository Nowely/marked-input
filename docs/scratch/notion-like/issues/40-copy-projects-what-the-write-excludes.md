# A copy projects content the matching write refuses to take

Type: task
Status: needs-triage — re-measured 2026-08-27, unchanged; it is the DECISION that blocks it, not the code
Blocked by: —

## Problem

Two paths answer "what does this selection contain", and since `177422cb` they disagree.

- `ClipboardController.#handleCopy` (`packages/core/src/features/clipboard/ClipboardController.ts:31`)
  projects through `TokenModel.selectedContent()` / `valueBetween` over the **raw** anchors.
- Every write over a row cover goes through `TokenModel.replaceRows`, which excludes the subtrees
  the frame paints no box for (`#hiddenWithin`) — the rule that a write may not take content the
  user cannot see.

So a **cut** over a cover holding a collapsed toggle puts the toggle's hidden body on the clipboard
and leaves it in the document. MEASURED 2026-08-27 on the Notion showcase, controlled, value
`'before\n▸ head\n\tbody\nafter'`, an exact cover of `'before'` and `'▸ head'`, then a `cut` event:

    clipboard  'beforeheadbody'      ← the hidden body is in it
    value      '\tbody\nafter'       ← and still in the document

A paste afterwards duplicates it. Plain **copy** has the same projection without any cut, so it
reports a selection contains rows the user cannot see.

## Why it matters

It fails in the SAFE direction — a duplicate rather than a loss — which is why `177422cb` declared
it rather than blocking on it, and why it is not in the data-loss group. But it is one rule with
two answers, and the two are three lines apart in `ClipboardController`.

## Cost

Wider than the cut branch, which is why it was not taken with the write:

- `selectedContent`/`valueBetween` serve plain `copy`, `MARKPUT_MIME` and the drag payload, not
  just this cut.
- The clip is a DOM reading (`DomModel.rowPaint`), so putting it in the projection puts an adapter
  measurement on the copy path.
- It needs a decision the write did not: whether a copy over a collapsed toggle projects the
  toggle's line ALONE, or the whole subtree as the user would get by opening it first. The write's
  answer ("do not take what you cannot see") does not settle the read.

## What it needs

A decision on that last question, then the clip at the projection. A pin per verb — copy, cut,
and the `MARKPUT_MIME` round trip — on the showcase's collapsed toggle.

The in-code comment at `ClipboardController.ts:22-32` states the disagreement and points here, so
the next reader of that branch is not misled by the invariant it used to assert.


## Re-measured, 2026-08-27 (T-E)

Driven again on the showcase, controlled, `'before⏎▸ head⏎⇥body⏎after'` with the toggle closed, an
exact cover of `'before'` and `'▸ head'`, then a `cut` event:

```
clipboard  'beforeheadbody'      ← the hidden body is on it
value      '\tbody\nafter'       ← and still in the document
```

Byte-identical to what the ticket recorded. Nothing this pass did touches it: ticket 43's fix is on
the WRITE path and this is the READ, and the two doors are three lines apart in
`ClipboardController` exactly as the ticket says.

## Why it stays open, stated precisely

It is one decision away from being an afternoon, and the decision is not the implementer's:
**does a copy over a collapsed toggle project the toggle's LINE alone, or its whole subtree?**

Both answers are defensible and they cost different things.

- **The line alone** makes copy and cut agree with `replaceRows` and closes this ticket completely.
  It also means selecting a toggle and copying it gives you a toggle with no body, which is not what
  the reference product does and is a surprise nobody asked for.
- **The whole subtree** matches what a user expects from a copy and leaves the CUT asymmetric on
  purpose: the clipboard would carry more than the document lost. That is defensible only if it is
  written down as the rule, because it is exactly the shape this ticket calls a defect.

What is NOT a decision, and is worth recording so the next reader does not re-derive it: the cut's
own clip could be made to match its own write with no answer to that question at all, because
`ClipboardController.#handleCopy` already knows which event it is serving. That would close the
duplicate-on-paste half and leave plain `copy` reporting a selection it cannot fully take —
half a fix, and the reason the ticket says the read is wider than the cut branch.

The cost the ticket lists is still right and one item of it is now firmer: the `text/plain` and
`text/html` entries come from the browser's own range serialization (`DomModel.selectedContent`),
not from the value, so excluding a hidden subtree from them means BUILDING both entries from the
projection instead of reading them off the selection. That is a change to what a foreign application
receives on paste, which is a third thing to decide rather than a detail of the first.
