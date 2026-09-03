# A selection covering a collapsed toggle WHOLE still deletes its hidden body

Type: task
Status: resolved — `replaceRows` excludes each hidden subtree (2026-08-27)
Blocked by: —

## Problem

`#visibleEnd` — the rule that a write may not take content the user cannot see — guards one door
of two. `insights.md:315-320`:

> **PROVEN by grep:** `#visibleEnd` is called only from `rowSelectionText` (`TokenModel.ts:496`),
> which is the TEXT write path. `replaceRows` (`TokenModel.ts:306`) — the exact-row-cover path
> that Backspace, Delete, paste and a typed character over a row selection all reach — never asks
> it. So a sweep that covers a collapsed toggle's row WHOLE takes its hidden subtree, which is
> exactly what the final session measured (`\tWho owns the status page?` and `\tDo we page on p95
> or p99?` gone to one keystroke).

Re-verified at `52ef65ae`: `#visibleEnd` has exactly two mentions in `packages/core/src` — its
call at `TokenModel.ts:496` inside `rowSelectionText`, and its definition at `:521`.
`replaceRows` (`:306-322`) resolves `rowSelectionSpan` and writes it unclipped.

What the clip already does, from its own docstring (`TokenModel.ts:501-519`): a collapsed toggle
*"renders its children and hides them, so their text is in the DOM and the browser's own paragraph
walk takes it"* — measured as `'▸ Z'`, 76 lines to 75 — and it *"ONLY EVER SHRINKS … so the
visible half of what the user selected is still replaced"*.

## Why it matters here

Silent data loss, in the shape this effort has now closed twice elsewhere. `insights.md:321-322`:
*"it is the same 'one rule, two doors' shape round eleven fixed on the delete path and P11.6 fixed
on the paste path — the third door of the same rule."*

## Cost

`insights.md:323-325`:

> **Cost:** one call, plus the declaration it forces. It IS a behaviour change: a Backspace over a
> sweep covering a collapsed toggle would then leave the hidden body behind, which is a strict
> improvement and still observable, so it is declared per AGENTS.md rather than filed as a fix.

The pin wants the gesture, not the value: the collapsed toggle's hidden lines must survive a
Backspace over a whole-row cover, and the OPEN toggle beside it must still lose its children under
the same gesture — which is what tells the collapse apart from the selection.

## Answer

`replaceRows` now asks `#visibleEnd` before it writes, and the record's cost estimate was right:
one call, plus one line of arithmetic the row path needs and the text path does not. The clip
answers a CONTENT end while this path's end is a BOUNDARY — a removal takes the separator after the
last row it takes and a replacement leaves it — so a clipped end is read back on the side each verb
writes on.

Both pins are in `Notion.react.spec.tsx`, both driven on the showcase, and both were seen red.
Deleting the clip turns *"leaves a collapsed toggle its hidden body when a row cover is deleted"*
into `expected 'after' to be '\tbody\nafter'` — the two hidden lines destroyed by one Backspace.
Clipping at every row inside the span instead of only at a boxless one reddens BOTH, the second
with `expected '▾ head\n\tbody\nafter' to be 'after'`, which is what says the open toggle's pin is
load-bearing rather than decorative.

**Behaviour change:** a Backspace, Delete, cut or paste over a selection that covers a collapsed
toggle's row whole now stops before the toggle's hidden body. The toggle's own line still goes; its
children stay and are re-parented by the depth clamp, exactly as an over-indented paste is.

**And one asymmetry it opens, declared rather than hidden.** `ClipboardController`'s cut copies
through `valueBetween` over the raw anchors and removes through `replaceRows`, so a cut over such a
cover now puts the hidden body on the clipboard AND leaves it in the document. The comment there —
*"a cut takes exactly what the copy above put on the clipboard"* — is no longer true for this one
shape. It fails in the safe direction (a duplicate on paste rather than a silent loss), and the
follow-up is the copy path's own clip, which is a wider change: `selectedContent` and `valueBetween`
serve plain copy too. **Filed as [40](40-copy-projects-what-the-write-excludes.md)**, and the
comment at `ClipboardController.ts:22-32` now states the disagreement and points at it — the
declaration had been living in a commit body a reader of that file does not have.

## The clip was wrong twice, and the rule is now written as the rule

Three reviewers of the pass re-measured the answer above and all three found the same regression;
one found a second. Both are fixed, and the mechanism is no longer a clipped END.

**It fused two rows when the covered run ended the document.** `rowSelectionSpan` charges a
document-final removal its LEADING separator, because the run it takes owns no trailing one
(`tree/siblings.ts:241`). Clipping the END un-finalises that removal, and nothing re-read the
start, so both separators went: `'intro⏎before⏎▸ head⏎⇥body'`, Esc, Shift+ArrowDown, Backspace gave
`'intro⇥body'` — the child's indent a literal tab in the middle of a paragraph. Silent structural
corruption from three keystrokes, where the original defect was silent loss. **Neither the shipped
pins nor the implementer's own probe file could see it: every one of them put an `after` row below
the toggle's subtree, so `endsDocument` was false in all of them.**

**And a cover spanning PAST one collapsed toggle under-deleted every visible row beyond it.** A
truncation stops at the first hidden row and drops the rest of the span:
`'before⏎▸ one⏎⇥b1⏎▸ two⏎⇥b2⏎after'` swept whole and deleted left `'⇥b1⏎▸ two⏎⇥b2⏎after'`. `'▸ two'`
is a row the user selected, could see, and watched survive a delete; at showcase scale a sweep of
twenty rows crossing one toggle deleted down to it and left the other fifteen standing. The
docstring's *"the visible half of what the user asked for"* held for one hidden subtree and stopped
holding for the second.

The rule the clip argues for is a per-SUBTREE exclusion, so `#hiddenWithin` now answers the hidden
subtrees inside a span; `replaceRows` writes the span whole and puts each of them back, and
`#visibleEnd` is the first element of that same list — `rowSelectionText` holds an anchor pair,
which has no way to say "all of this except the middle". One walk, one paint reading, one owner.
A PASTE over a cover crossing two toggles now keeps both bodies as well.

Four pins in `Notion.react.spec.tsx`, each seen to redden on the clause it holds: dropping the
leading separator reddens the document-final pin ALONE; dropping the trailing one reddens it and
the older ticket-13 pin; keeping only the first hidden subtree reddens the two-toggle delete and
paste pins ALONE; removing the empty-`kept` short-circuit reddens the new no-toggle control (a
document-final delete with nothing hidden must still leave `'intro'`) and two older pins.

## Two things measured and deliberately left

**A typed character over an exact row cover holding a collapsed toggle is a NO-OP**, and Delete over
one behaves as `rowSelectionText` decides rather than as this door does. Measured byte-for-byte
identical at `ddc0a6c3` and after the fix, so it is pre-existing and not this door's: those gestures
reach `rowSelectionText`, whose clip can only shrink a span. `replaceRows`'s docstring lists a typed
character among the gestures it serves; for this shape that is unverified. Worth its own ticket if
the no-op is judged wrong — the safe answer today is that nothing is destroyed.

**Every pin here is React-only**, because the Notion page has never been migrated to the shared-spec
harness (ticket [26](26-vue-showcase-p12.md)). The clip's whole verdict comes from
`DomModel.rowPaint` → `element.checkVisibility()`, i.e. from what the ADAPTER painted, so a Vue
regression in collapsed-row painting would take it down with the suite green. No Vue test anywhere
exercises a `'boxless'` row.

**Measured and NOT changed:** select-all followed by Backspace still clears the whole document,
hidden child included — `''` both before and after the fix, on `'intro⏎▸ closed⏎\tchild'`. The
sweep over the same rows with a tail row after them clips as expected (`'\tchild⏎tail'`), so the two
gestures reach the write by different routes; which route select-all takes was not chased, and the
outcome is the one a user asking for the whole document expects either way.
