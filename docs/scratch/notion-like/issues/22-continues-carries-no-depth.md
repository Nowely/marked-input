# No option can say "Enter opens a CHILD of this row"

Type: task
Status: needs-triage — judged 2026-08-27 and left filed; two of its four costs are now smaller
Blocked by: —

## Problem

`continues` carries a KIND and never a DEPTH, so a CONTAINER kind cannot express its own Enter.
`map.md:789-794`:

> **`continues` CARRIES A KIND AND NEVER A DEPTH, so no option can say "Enter opens a CHILD of
> this row" — which is what a CONTAINER wants.** The showcase's toggles declared `continues: true`
> and got the only thing the field can express: another toggle beside this one (`'▾ Why'` + Enter +
> text emitted `'▾ Why⏎▾ text'`), with Tab then nesting a toggle inside a toggle. That word is gone
> (2026-08-26) and the gesture is Enter, Tab — the `/text` in the middle is no longer needed — but
> the Tab is still the user's to press.

`outcome.md:510` names the same gap from the product side, as the last of the seven things missing
against Notion: *"Notion's toggle entry, where the first Enter opens the toggle and drops the caret
inside as a child."*

Verified at `52ef65ae`: `RowSpec.continues` is `boolean | CoreOption`
(`packages/core/src/shared/types.ts:178`) and resolves through `TokenModel.#continues`
(`:1279`) into `{descriptor, meta}` — a kind and a seed, no depth.

## Why it matters here

Every container kind in the showcase pays it, and the cost is one keystroke the user has to know
about. It is also the one gap the record costed against the code rather than sketching.

## Cost, measured against the code (`map.md:794-811`)

- one more word in `RowSpec`: `continues` and `Continuation = {descriptor, meta}` both grow a "one
  level deeper" answer;
- `siblings.ts`'s `openedLine` writes `node.lead() + rowMarkup(…)`, the splitting row's OWN lead —
  *"which is exactly why the tail is always a sibling. It would have to take a lead rather than read
  one, and the deeper lead is `lead + config.indent`"*, a primitive that exists as
  `rowKeys.ts`'s `continuationDepth`;
- `splitPlan` PLACES the tail past the whole subtree (`head + subtree + separator + written`), and
  the `tail` index it returns moves with a child — *"a contract change to the one function whose
  window arithmetic is already the fragile part"*, which is [19](19-mid-body-split-loses-the-caret.md);
- it inherits two refusals it must not re-derive: the scan's ceiling (`AnchoredRow.childDepth`,
  which an EMPTY row makes 0) and `TokenModel.#nestingIsPainted`, a DOM fact living at the seam.

## Judged 2026-08-27: leave it filed, with the costing corrected

Not built, and the reason is doctrine A.9 rather than difficulty: `RowSpec.continues` is PUBLISHED
surface, and this grows it. The proposal deletes nothing and adds a word to the one field a consumer
declares a container kind with, which is a decision to be made from the outside on usage — one
consumer in this repo declares `continues` at all. It is also the third change to `splitPlan` in one
pass ([17](17-cross-row-paste-is-spliced-raw.md) and [19](19-mid-body-split-loses-the-caret.md)
landed there together), and stacking a published-API feature on the function whose window arithmetic
has broken twice is exactly the big-bang the workflow rules refuse.

**Two of the four costs are now smaller, measured against the code as it stands at `da03807d`.**

- *"`splitPlan` PLACES the tail past the whole subtree, and the `tail` index it returns moves with a
  child"* — **refuted as stated.** The plan returns no `tail` index at all: it names the caret as an
  absolute OFFSET, and `#enterRow`'s pre-order walk went with it. There is no index left to move.
- *"`openedLine` would have to take a lead rather than read one, and the deeper lead is
  `lead + config.indent`"* — **halved.** `splitPlan` now takes the whole `RowConfig` rather than the
  bare separator, so `config.indent` is already in scope where the line is written; the
  `continuationDepth` primitive `rowKeys.ts` holds is still the thing to reuse.

**Two stand unchanged**, and they are the ones that make it a design rather than an afternoon: the
extra word in `RowSpec` and in `Continuation`, and the two refusals it inherits and must not
re-derive — the scan's ceiling, which an EMPTY row makes 0, and `TokenModel.#nestingIsPainted`, a
DOM fact living at the seam that `tree/` cannot read. The second is the sharper one: a plan formed
in `tree/` cannot ask whether the deeper row would be painted, so "Enter opens a child" has to be
decidable at the seam and fall back to a sibling there — a second decision point the costing does
not yet name.
