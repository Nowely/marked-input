# An upward mouse drag re-places the caret instead of extending the selection

Type: task
Status: ready-for-human
Blocked by: —

> THE SHIPPING BLOCKER. The final driving session's verdict is that this editor cannot be
> shipped as a mouse-driven editor while it stands, and that everything else in that report is
> a smaller version of it.

## Problem

Press in a paragraph and drag UPWARD and no selection grows: the editor answers each pointer
move by placing a caret. The record, `insights.md:302-306`:

> A drag that crosses a row boundary upward collapses to a caret — measured on a two-paragraph
> document on `Notion/Empty`, with `draggable: false`, with downward drags, leftward drags,
> Shift+click and Shift+ArrowUp all passing. Sweep up over five rows, release, Backspace: one
> character dies.

It is the third instance of the class rounds 4–11 spent eleven repair rounds on
(`insights.md:270-272`):

> The final session's four defects reduce to one sentence — *the editor answering a pointer with
> "place a caret" when the user meant "extend a selection"* — and the one that matters is an
> upward mouse drag on a two-paragraph document, nothing to do with Notion.

**And the suite cannot see it, which is half the ticket.** `insights.md:272-278`:

> **PROVEN, cheaply:** the whole test corpus dispatches `mousemove` exactly twice
> (`RowController.spec.ts:128`, a hover/drop tick, and `Notion.react.spec.tsx:1651`, a drop
> test), and neither begins a text selection. Every backward selection in 2240 tests is a
> `setBaseAndExtent`, a Shift+click or a Shift+Arrow. **A gesture the suite has no vocabulary for
> is a gesture the suite cannot regress-test, and eleven sessions of driving did not reach it
> either** — because a driver reaches for the mouse to click, and reaches for the keyboard to
> select.

Re-measured here at `52ef65ae`: still exactly two `mousemove` dispatches in the whole repo (a
third grep hit, `Drag.spec.ts:510`, is a comment); `setBaseAndExtent` appears in 12 places and
`shiftKey: true` on 36 spec lines. The suite SIZE differs across the records — 2096
(`outcome.md`, at `c6b681ce`), 2232 (the coverage audit), 2240 (`insights.md`) — and was not
re-run for this ticket.

## Why it matters here

`insights.md:307-308`: *"it is the first minute of use for a mouse-driven editor, it is unrelated
to any of the block sophistication above it, and it is the third instance of the class rounds
4–11 have been chasing."* Twenty-six row kinds, nested drag and an undo stack that unwinds 607
characters byte-exact do not compensate for a text field that cannot select backwards with a
mouse.

## Where to start, and what is NOT known

`insights.md:309-313` is explicit that the owner is unproven:

> **Cost, honestly:** two pieces, and the second is the larger. The fix has a named starting point
> (`SelectionDriver.ts`'s `pointerdown` latch, `RowController.ts:178`'s container `mousemove`) but
> no owner I have proven — **hypothesis only, I did not drive it.** The harness is the real cost:
> nothing in the repo sweeps text with the button down, so the pin is a new capability, not a new
> test. Build the harness first and drive the reduced two-paragraph case before touching an owner.

Verified at `52ef65ae`, so a reader starts from facts rather than from the sketch:

- `packages/core/src/features/tokens/dom/SelectionDriver.ts:56-62` — `#pointerControl`, *"written
  by every `pointerdown`, consumed by the first selection sync after it, dropped by the next
  keydown"*; the listener that writes it is `:393`, and `:213` records the measurement that a
  mousedown on a `draggable` island makes Chromium collapse the caret to the editing host's start.
- `packages/core/src/features/rows/RowController.ts:178` — `listen(container, 'mousemove', …)`,
  the controls layer's hover tick, `rowAt`-driven.
- **Core registers no `pointermove` listener at all** (`grep -rn pointermove packages/core/src`:
  zero hits), so whatever re-places the caret during the drag does so through the
  `selectionchange` path, not through a move handler of ours.

Order of work, per the record: build the sweep harness first (a real button-down move sequence in
Vitest Browser Mode, reusable from `packages/storybook/src/shared/lib/`), reproduce the reduced
two-paragraph case on `Notion/Empty`, and only then name an owner.
