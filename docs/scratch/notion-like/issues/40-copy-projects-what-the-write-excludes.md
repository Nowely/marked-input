# A copy projects content the matching write refuses to take

Type: task
Status: needs-triage
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
