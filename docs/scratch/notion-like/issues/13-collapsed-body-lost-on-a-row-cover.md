# A selection covering a collapsed toggle WHOLE still deletes its hidden body

Type: task
Status: ready-for-agent
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
