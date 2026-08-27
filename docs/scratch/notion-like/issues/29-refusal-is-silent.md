# The editor refuses silently, and what a click does depends on markup the user cannot see

Type: task
Status: needs-triage
Blocked by: —

> Two of the four rough edges `insights.md:148-167` records as *"nobody filed and everybody felt"*.
> They are filed together because both are the same complaint from the user's side: the editor's
> rules are correct and invisible.

## Problem

**Refusal is silent.** `insights.md:150-160`:

> The editor has exactly one visible refusal: the drop indicator, which *promises rather than
> predicts* — a depth the mover would refuse is never painted. Everything else refuses without
> saying so. A typed character over a row that holds no editable position is *"CONSUMED AND
> REFUSED"* (round nine, and it is the right call — `false` falls through to the text path and
> deletes the row by another door). Shift+Enter inside a carved cell is *"consumed and doing
> nothing"*. Tab is consumed by every row in an editor where any kind declares `indents` — **7 of
> the showcase's 26** — so a root paragraph outdented to depth 0 presses a dead key. And the final
> session's sharpest line is this edge in its strongest form: *"Painted highlight ≠ what a keystroke
> replaces, in both directions"* — a sweep into a fence paints 20 characters that survive typing (a
> correct clamp, an incomprehensible paint), and a sweep across a collapsed toggle eats two hidden
> lines that were never painted at all.

The second half of that last sentence is [13](13-collapsed-body-lost-on-a-row-cover.md) and is a
data-loss bug. The FIRST half is not a bug at all — the clamp is right — and that is exactly what
makes it this ticket: nothing tells the user why the highlighted bytes did not go.

**And one gesture has answers the user cannot predict.** `insights.md:162-167`: round eleven
measured a click across a button decoration, frozen presentation and a `<select>`, with and without
a prior caret, found *"three answers where there should be two"*, fixed the odd one, and left two
that are consumer-dependent by design — *"defensible as a rule and undiscoverable as a user:
whether a click moves your caret, selects a block, or does nothing depends on whether the consumer
called `useControlRef` on the thing under the pointer."*

Verified at `52ef65ae`: the dead Tab is `rowKeys.ts:194-198` (an editor-level `rowsIndent` gate,
then `indentRows` alone deciding), and the cell walk that consumes Tab with no next piece is
`:182-192`.

## Why it matters here

Every one of these is a rule the effort measured, argued and got right. The gap is that a correct
refusal and a broken editor look identical from the user's chair — which is what the first driving
session meant by *"the document model is good and the editing experience is not"*.

## Shape of a fix

Not a repair: a decision about whether this editor has a refusal CHANNEL at all (the drop indicator
is the only precedent), and what it costs a consumer who wants none. Anything here that turns out
to be a defect rather than an invisible rule belongs in its own ticket.
