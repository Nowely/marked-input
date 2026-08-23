# One input pipeline with layout arms

Type: grilling
Status: resolved

## Question

`blockEdit.ts` (229 lines) attaches a second keydown listener and a second
beforeinput capture listener to the same container as `input.ts` (139 lines),
with a parallel replacement pipeline its own comment calls "The SAME
inputType→replacement table as `input.ts`" (`blockEdit.ts:188-190`), a
parallel Backspace/Delete arm, and a parallel all-selected arm. Shared helpers
already live in `beforeInput.ts` (blockEdit uses 5 of its 7 exports, input.ts
uses 6).

What is the unified pipeline shape — one listener pair with layout-aware
arms? What survives of the row-resolution tier (`findActiveRow`,
`rowFromAnchor`, `anchorOwner`, `rowHandle` — 46 lines) — anchors only?
Where do the block-unique behaviors live in the unified table: Enter inserts
`props.separator()`, merge via `a.mergeWith(b)`, the insertParagraph
fail-closed drop?

Known drift risk this ticket ends: blockEdit has its own history of diverging
from input.ts.

## Answer

**Decided 2026-08-22 by the maintainer: shape A, plus the `anchorsForDelete`
arm for the row tier.** 03 is independent of 01 and 02 — the pipeline touches
neither the row controls nor rendering, and both surviving options were measured green at
HEAD by two agents working separately.

### The shape: one listener pair (A)

`enableBlockEdit` and its two `listen()` registrations die. `input.ts`'s
keydown/beforeinput pair gains block arms placed **after** the shared
consumer-origin and all-selected checks. What goes with it: the
`if (e.defaultPrevented) return` coupling between the two beforeinput
listeners, the duplicate `isConsumerKeyOrigin` call, the duplicate control-root
check, `handleBlockBeforeInput`/`replaceBlockRange` as separate functions, and
2 of the 4 `isBlock` control-flow forks in `features/keyboard/`.

**BEHAVIOR CHANGE, declare in its own commit.** Block layout starts honouring a
consumer's explicit `contenteditable` island on beforeinput, as inline already
does. Today `blockEdit.ts:173` tests only `handleAt(target) === 'control'`,
never `inExplicitEditableIsland`, while `input.ts` returns early at :88 on
`isConsumerOrigin` and again at :114 on `isBlock` — so the block arm edits an
event the shared path already declined. Measured by both lenses:
`one\n\ntwo\n\n` → `one\n\ntwox\n\n` with `defaultPrevented=true`. Inline pins
the opposite contract at `input.spec.ts:435`. A strict improvement, but it is
silent model corruption today, so it lands as its own named change.

Naming/ownership question for the spec: `blockEdit.ts` stops being a feature
and becomes arms imported by `input.ts`. Published prose names it by path —
`architecture.md:362` (KeyboardController composes `enableInput` +
`enableBlockEdit`), `docs/adr/0003:9`, `docs/records/established-contracts.md:22`.

### The row tier: expand the separator in `anchorsForDelete`

Not the proposed option B (tier survives for the merge arm alone) but the arm
no proposal contained: a row-separator expansion in `anchorsForDelete` beside
the existing `adjacentMark` swallow. It deletes the same 46-line tier as the
rejected option D without D's universal `stepAnchor` rewrite.

Residue to carry into the spec: `rowFromAnchor` never checks `kind === 'row'`
— the tier is really "which ROOT", not "which row". And the ADR-0008 comment
block at `blockEdit.ts:48-66` must be rewritten: its `pendingStructural`
premise died in ADR-0008's own 2026-08-19 amendment, while the tier it
justifies is still load-bearing (removing it turns Vue's Backspace merge red).

### Rejected, with evidence

**C (Enter becomes an inputType table entry) and D (delete crosses the
unanchorable run) are off the table.** Both lenses measured, with real keys in
both frameworks: Enter over a non-empty selection in a row starts **deleting
the selection** (HEAD keeps `First`, C drops it). The mechanism is in source —
`handleEnter` does `edit.replace(at, at, sep)` with `at` the LOW end only,
while the shared tail does `edit.replace(target.anchor, target.head,
replacement)` over the whole range. The repo has **zero** ranged-selection Enter
tests, so "156/156 Drag green" was absence of coverage, not evidence. C also
inverts `beforeInput.ts:66-70`'s stated rule that block's divergence is decided
BEFORE the table.

The new ranged-Enter behavior may well be the correct one. If it is wanted, it
is a separate named fix with its own test — not a rider on this ticket.
