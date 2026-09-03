# A paste whose SPAN crosses two rows is spliced raw

Type: task
Status: resolved — `splitPlan` takes a span that leaves its row (2026-08-27)
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

## Answer

Taken together with [19](19-mid-body-split-loses-the-caret.md), because the ticket's own reading was
right: one function, one unanswered question. `splitPlan`'s span rule now asks only that the LOW end
be inside this row's body; the HIGH end may close in any later row whose own line holds it. The head
keeps what precedes the span, every row between the two ends is consumed — they lie wholly inside
it by construction — and the last covered row's tail follows the last piece.

Whose kind and whose lead: the tail carries the LAST covered row's KIND, which is the rule the
head/tail swap at a row's own start already follows (*the row that keeps the content keeps the
kind*), and the HEAD's lead, because every line the plan opens is written at the row the span began
in — which is what makes a tail a sibling and not a child.

That lead is what bounds it, and both bounds are refusals rather than repairs: a last row with
CHILDREN would have them re-parented by the clamp instead of moved, which is a depth plan and not a
splice (the same test refuses a carved row, whose cells are its child rows), and the row AFTER the
span must land where it landed before, since it now follows a line at the head's depth.

The measured case: `'- alpha⏎⇥- beta'`, span from offset 2 of `alpha` to offset 2 of `beta`, clip
`['one','two']` — `'- alone⏎twota'` before, `'- alone⏎- twota'` now. Pinned by name in
`writeRows.property.spec.ts`.

The deliverable was the property, not the code. 13136 spans over six generated documents carrying
surplus leads; 7701 written, 6269 of those crossing a row boundary — every one of which answered
`undefined` before. Restoring the old one-row refusal takes acceptance from 7701 to 1432.

**Behaviour change:** a paste whose selection crosses rows opens rows instead of splicing raw,
except for the two shapes above, which fall back on the ordinary splice exactly as before.

## Corrected 2026-08-27 — one defect the property could not see, and three gaps it still has

**The following-row depth guard was unsound for a MARKUP clip** (`9794ecce`). It asserted that the
row after a crossing span follows a line written at the HEAD's depth, which holds for a foreign clip
— every opened line is built with `node.lead()` — and not for a markup clip, whose lines are written
verbatim and carry their own leads. The ceiling then came from the wrong predecessor and the guard
accepted the plan it exists to refuse: `'r⏎⇥a⏎⇥⇥b⏎⇥⇥c⏎⇥⇥d'` with `'x⏎y'` written across `b` and `c`
returned `true` and left `'⇥⇥d'` at depth 1 where it had been at depth 2 — re-parented with not a
byte of its own changed. The clamp is replayed line by line now, each line's lead read off its own
bytes the way `RowScanner` reads one. Foreign clips are untouched and the property's counts prove
it: 13136 / 7701 / 6269 before and after.

**Also corrected: the claim that the childful-tail test refuses a carved row.** It does not and
cannot — `preorderRows` names no cell, so a span from a table LINE into one of its own cells closes
on the table row itself and is not crossing at all. What holds that rule is the SEAM, where
`contentLineRows` does descend into cells. Refusing every carved head in the plan was tried and
measured: **6 red**, because Enter splits a table line through this very plan. The claim is corrected
in both places that carried it (`15b665a7`); the code is unchanged.

**Three gaps the property still has**, none of them closed here:

1. **No markup clip.** `CLIPS` is an array of LINE arrays, so `typeof rows === 'string'` is false for
   all 13136 cases and the whole verbatim arm — `joinsHead`, the opened lines, the depth guard over
   them — is unexercised. That is how the defect above survived the deliverable. Two named cases pin
   the shape now; the corpus still cannot generate it, and doubling the corpus is not free (see 3).
2. **No carved row, no raw body, no mark.** `OPTIONS` is `[HEADING, BULLET]`. A review probed the
   missing shapes by hand against HEAD and found no wrong bytes, so this is a coverage gap rather
   than a known defect.
3. **No hidden-row oracle**, and it cannot grow one as it stands: the property's stores never paint,
   so `rowPaint` is never `'boxless'`. See [43](43-cross-row-write-takes-hidden-rows.md), which is a
   real cross-row write path with no such exclusion.

**Two weaknesses of the property itself, closed** (`9794ecce`): its acceptance floors were loose —
`accepted > 7000` against 7701, `crossed > 6000` against 6269, ~700 crossing shapes of slack with no
oracle saying a describable shape must be WRITTEN — and both are exact counts now; and it flaked,
13136 fresh stores being 6 s alone and 13-17 s under `pnpm test` either side of the 15 s default, so
both properties carry an explicit budget with the cost stated rather than the corpus shrunk.
