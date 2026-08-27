# A paste whose SPAN crosses two rows is spliced raw

Type: task
Status: needs-triage
Blocked by: —

## Problem

`map.md:664-672`, measured on the tip:

> **A paste whose SPAN crosses two rows is still spliced raw**, which is the one shape of defect 1
> left open. MEASURED 2026-08-26 on the tip: `'- alpha⏎⇥- beta'`, DOM selection from offset 2 of
> `alpha` to offset 2 of `beta`, paste `'one⏎two'` → `'- alone⏎twota'` — the second line carries
> neither lead nor opener. `splitPlan` refuses a span that leaves the row's own body (`'what sends
> a paste across several rows back to the ordinary splice'`), and that refusal is deliberate:
> widening it means the head row keeps the text before the span, the LAST covered row's tail
> follows the last piece, and every row between them plus three subtree placements are consumed in
> one plan. That is a contract change to `splitPlan`, not a hardening fix, so it is declared in
> `keyboard-handling.md` rather than half-built.

Verified at `52ef65ae`: the refusal is one line,
`packages/core/src/features/tokens/tree/siblings.ts:1038` —

    if (from < slot.start || to > slot.end) return undefined

— inside `splitPlan` (`:1014`), which is why the paste falls back on the ordinary splice.

The three OTHER shapes of the same defect are closed and must not be re-filed: a paste inside one
row's body (P11.6), a foreign clip over a row selection (`replaceRows` taking `string | readonly
string[] | null`, P11.6 review), and the editor's own clip at a non-line-start caret (`4f365608`).

## Why it matters here

Selecting across two rows and pasting is an ordinary editing gesture, and it is the one arm of the
paste family that still writes bytes in nobody's language into the value.

## Cost, and why it is a decision first

Widening `splitPlan` is a contract change to the one function whose window arithmetic is already
the fragile part — the same function [19](19-mid-body-split-loses-the-caret.md) says cannot place
the caret for one existing shape. A plan that consumes several rows plus their subtree placements
needs the caret question answered with it, not after it.
