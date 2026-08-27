# The editor refuses silently, and what a click does depends on markup the user cannot see

Type: task
Status: resolved — one refusal channel, in core, painted by both adapters
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

## Answered 2026-08-27 (T-D)

**A CHANNEL, not five repairs.** `RowController.refuse(id)` writes one signal, `state.refused`,
and both adapters' controls layers paint one thing from it: a tint that fades over the row the
gesture was refused at (`a058794d`, `5761c743`). The shape is `reportBadProp`'s, which is the
house answer at the props boundary — many call sites, one owner, one look — because a refusal
spelled per key is a refusal the user has to learn per key.

The five call sites are the ticket's own list plus the two the neighbouring tickets carry:

| gesture | site |
| --- | --- |
| Shift+Enter inside a carved cell | `rowKeys.ts` `handleRowEnter`'s Shift arm |
| Tab past a carved row's last cell | `rowKeys.ts` `handleRowIndent`'s cell walk — [21](21-table-gestures.md)'s item 2 |
| a Tab the depth verb refuses | `rowKeys.ts` `handleRowIndent` — [28](28-gestures-the-first-session-left-standing.md)'s item 3, the dead key at depth 0 |
| Backspace at a boundary with no merge to offer | `input.ts` `handleDeleteKey`'s `!target` arm |
| a character typed over a row no caret may enter | `rowKeys.ts` `replaceRowSelection`, all three arms |

**WHAT IT SAYS AND WHAT IT DOES NOT.** It names the ROW and never the reason. A reason has to be a
string, and a string is either untranslatable or a published vocabulary of causes; what the user is
missing is not the rule but the fact that a rule ran. `state.refused` is `{id, at}` where `at`
counts PRESSES — two refusals of the same key on the same row are the same value, and a layer
handed the same value repaints nothing, so the count is what re-mounts the element and restarts the
animation. Nothing clears it: one run of the animation is the whole of its visible life.

**THE COST TO A CONSUMER WHO WANTS NONE** is one CSS custom property: `--markput-row-refused`, set
to `transparent`. There is no prop, and there is no channel to turn off — the signal is written
whether or not anything reads it, at five sites that were already returning.

**ROW-SCOPED, and that is a decision.** Every refusal the three sessions reported happens at a row,
and the layer that paints it already addresses rows by id. A gesture refused where the document
parses no rows — Backspace at an inline editor's first offset — reaches no call site and says
nothing, which is what every plain text field does.

**THE SECOND HALF OF THE TICKET IS NOT ANSWERED AND IS NOT THIS.** "Whether a click moves your
caret, selects a block, or does nothing depends on whether the consumer called `useControlRef` on
the thing under the pointer" is a fact about a consumer's own DOM, not a refusal the editor makes —
nothing in core knows a click was declined, because nothing declined it. It stays open, and it
belongs with [32](32-no-per-row-view-state.md)'s class of consumer-boundary questions rather than
here.

**Pins**, and every one of them was mutated and seen to redden:
`rowKeys.spec`'s `a refused gesture is announced` (six keys, plus one that asserts silence when the
same key is ACCEPTED) and `Base/rowKeymap.spec`'s browser case in both adapters. Mutants run:
`refuse()` made a no-op → 6 of 6 red; the press count frozen → the second-press case red; the Tab
site's report dropped → 2 red; the delete site's dropped → 1 red; React's element removed → the
React project red with Vue green; Vue's `:key` removed → the second-press identity assertion red.
