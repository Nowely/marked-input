# The editor refuses silently, and what a click does depends on markup the user cannot see

Type: task
Status: resolved — one refusal channel, in core, painted by both adapters; the click half went to 32 and the clamped sweep to 44
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
| a character typed over a row no caret may enter | `rowKeys.ts` `replaceRowSelection`, all three arms |

**WHAT IT SAYS AND WHAT IT DOES NOT.** It names the ROW and never the reason. A reason has to be a
string, and a string is either untranslatable or a published vocabulary of causes; what the user is
missing is not the rule but the fact that a rule ran. `state.refused` is `{id, at}` where `at`
counts PRESSES — two refusals of the same key on the same row are the same value, and a layer
handed the same value repaints nothing, so the count is what re-mounts the element and restarts the
animation. Nothing clears it: one run of the animation is the whole of its visible life.

**THE COST TO A CONSUMER WHO WANTS NONE** is one CSS custom property: `--markput-row-refused`, set
to `transparent`. There is no prop, and there is no channel to turn off — the signal is written
whether or not anything reads it, at four sites that were already returning.

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
`rowKeys.spec`'s `a refused gesture is announced` (five keys, plus one that asserts silence when the
same key is ACCEPTED and one that asserts silence for a delete the model cannot express) and
`Base/rowKeymap.spec`'s browser case in both adapters. Mutants run:
`refuse()` made a no-op → 6 of 6 red; the press count frozen → the second-press case red; the Tab
site's report dropped → 2 red; React's element removed → the React project red with Vue green;
Vue's `:key` removed → the second-press identity assertion red; the tint's `animation` line deleted
→ the browser case red in both projects.

## Corrected 2026-08-27, in review

**THE DELETE SITE CAME BACK OUT.** `input.ts` `handleDeleteKey`'s `!target` arm announced for one
commit and was wrong more often than it was right. `anchorsForDelete` answers `undefined` for TWO
facts and cannot tell them apart: a boundary with no merge to offer, and the plain DOCUMENT EDGE.
Measured on `'one⏎two'` with a live DOM caret: Backspace at offset 0 of row 0 → `{id: 1, at: 1}`;
Delete at the end of row 1 → `{id: 3, at: 1}`. That is the universal no-op of every text field, and
because `at` counts presses and both adapters key the element on it, holding the key repainted the
tint on every autorepeat.

Telling the two apart needs `boundarySpan` to distinguish "found and refused" from "not found",
which widens a PUBLISHED return type for one key in one narrow document shape (a raw closed body
followed by another row). Deleted instead, and measured: exactly one test reddened — this pass's
own pin — which is now inverted to assert the silence, with both document edges added to it.

The `boundarySpan` round-trip guard (`2cd50c8d`) STAYS: it is the real repair, and it stands on its
own — the key writes nothing and takes no undo step for it.

**THE CLAMPED SWEEP was never answered here and is not this channel.** *"A sweep into a fence
paints 20 characters that survive typing"* is a write that HAPPENED on a smaller span than what was
painted — `refuse()` would be a lie, since the gesture did write. It is a PAINT problem (the
selection shown is not the selection that will be replaced), filed as
[44](44-painted-selection-outruns-the-write.md).

**A SOFT KEYBOARD or an Edit-menu delete reaches `beforeinput` with no keydown**, and that door
never announced either. With the keydown site gone the two doors agree, which is what "one
mechanism" meant.

**TWO OF `replaceRowSelection`'S THREE ARMS ARE UNPINNED, and I could not write the pin.** Only the
first (`holdsFrozenRow(anchors)`) is exercised by any test; silencing the other two to a bare
`return true` is invisible to the whole suite. I drove eight shapes looking for a witness — a sweep
from a plain row into a fence interior, a row selection over a carved table row, over a fence whole,
over a frozen card with its surface removed, a sweep ENDING exactly at a frozen row's start, an
empty frozen body, a first-row-to-frozen-end selection, and a sweep from a plain row into a frozen
card — and every one that touches a frozen row at all lands on ARM 1. That follows from
`holdsFrozenRow`'s overlap test being asked of the RAW pair: a resolution can only cover a frozen
line the pair already touches, except at an exact boundary, and the boundary case was driven and
does not reach it either.

So the honest state is: arm 2 may be DEAD in the current model, and arm 3 is reachable only through
a shape none of these fixtures makes. Their comment cites defects that WERE measured, at a time the
model has since changed under. Not deleted — the class they guard is a page-scale delete from one
click and one keystroke — and not pinned, because a pin against a shape I cannot construct would be
the §A.12 failure mode again. Whoever takes it should drive the SHOWCASE, where a frozen row is a
real atomic kind rather than a fixture with its surface removed.

**NOT DONE, recorded so nobody re-measures it blind:** `state.refused` is never cleared, so a dead
refusal is re-measured by `boxOf` on every geometry bump and keeps an `opacity: 0` element mounted
for the editor's lifetime. The rAF loop bumps `geometry` only when a box actually moved, so the
steady-state cost is near zero; a clean fix is `onAnimationEnd`/`@animationend` in the adapters,
which needs no clock in core. Left as a smell, not a defect.
