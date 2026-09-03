# The open decisions

Every question left in this tracker that only the maintainer can answer, in one place, so returning
to them is reading rather than re-deriving. Each entry names the question, the options with what
each costs, what is blocked on it, and the recommendation — a recommendation is not an answer.

Written 2026-08-29, after the scale group (45, 46, 47) closed. The tickets stay the source of
evidence; this file is the index of what is being ASKED.

Two things below need no answer at all and are marked **FREE** — they can be done on any day and
were left only because they sat next to a question.

---

## D1 — Does core get a per-row view store?

**Ticket:** [32](issues/32-no-per-row-view-state.md), and it unblocks a third option in
[31](issues/31-find-in-page-edits-the-document.md).

There is nowhere to put state that is ABOUT a row and must not be IN the document. The showcase got
out of it by making openness a document fact — a toggle is two kinds, `▸` and `▾` — which bought
three things: openness can be authored in the text, undo takes it back, and it survives a drag into
a different parent, where the component instance dies and a `useState` with it.

**The question is not whether to move openness back.** It is whether core owns a store keyed by row
id, surviving a re-parent because core keeps the row's identity across one and the frameworks do
not.

| | costs |
| --- | --- |
| **Build it** | New published surface with ONE would-be caller today. The repo's own rule wants a second caller before a surface earns its weight. |
| **Leave it** | Any consumer with row state that must not be in the value — a hover expansion, a per-row editing mode, a loaded preview — has no place for it and no way to survive a drag. And 31 keeps only two options instead of three. |

**Recommendation:** build it when a second caller appears, not before — but answer D2 now, because
it is the cheap half of the same silence.

Inherited note, recorded here so it is not lost: whether a click moves the caret, selects a block or
does nothing depends on whether the consumer called `useControlRef` on the thing under the pointer.
Nothing in core knows the click was declined, because nothing declined it. Same boundary, does not
on its own justify the store.

---

## D2 — Should the editor SAY that undo is off?

**Ticket:** [30](issues/30-foreign-value-disables-undo.md).

A controlled parent that rewrites `value` on its way through — normalising, formatting, accepting
another author's change — leaves every recorded entry naming a projection the document no longer
holds, so `canUndo` answers `false` until it comes back. Nothing on screen says so. Mapping windows
through foreign changes IS the collaborative-editing design and is not what this asks.

| | costs |
| --- | --- |
| **Report it** | One line through the channel that already exists for refusals. A console message a consumer meets in development. |
| **Leave it silent** | A whole feature turns itself off with no signal, from an ordinary thing for a controlled component's owner to do. |

**Recommendation:** report it. This is the silent-refusal class applied to a feature rather than a
keystroke, and the channel was built for exactly that.

---

## D3 — Publish `@markput/notion` now, or after the moving gestures settle?

**Ticket:** [39](issues/39-notion-package.md). Unblocked 2026-08-29: every named blocker is closed,
and since [46](issues/46-vue-row-kind-has-no-reactive-node-read.md) the showcase names no store hook
at all.

It is a MOVE, not a build — `boundary.spec.ts` already proves the whole editor is options and
components. What publishing costs is that it FREEZES the API around gestures that are still moving.

| | costs |
| --- | --- |
| **Publish now** | D5 and D6 are both open and both are contract-shaped: a package would inherit "no insert-above verb" and "the painted selection is not what a keystroke replaces" into its contract, and its consumers would build workarounds around them. |
| **Wait** | The proof stays a grep in a Storybook page rather than something a person can install. |

**Recommendation:** wait for D5 and D6, then move. Naming the condition is the point — "not yet" with
no exit is how a thing stays not-yet for ever.

---

## D4 — What does a copy over a collapsed toggle contain?

**Ticket:** [40](issues/40-copy-projects-what-the-write-excludes.md). Measured twice, byte-identical.

Two paths answer "what is in this selection" and they disagree. A write excludes subtrees the frame
paints no box for; a copy projects the raw anchors. So a CUT over a cover holding a collapsed toggle
puts the hidden body on the clipboard AND leaves it in the document — the next paste duplicates it.
It fails in the safe direction, which is why it was declared rather than blocked on.

| | costs |
| --- | --- |
| **The toggle's line alone** | Copy and cut agree with the write and the ticket closes completely. But copying a toggle gives you a toggle with no body, which is not what the reference product does. |
| **The whole subtree** | Matches what a person expects from a copy, and leaves the CUT asymmetric on purpose — the clipboard carries more than the document lost. Defensible only if written down as the rule, because it is the shape the ticket calls a defect. |

**FREE, and independent of the answer:** the cut's own clip can be made to match its own write with
no decision at all — `#handleCopy` already knows which event it is serving. That closes the
duplicate-on-paste half today and leaves only plain `copy` reporting a selection it cannot fully
take.

### D4b — and if the subtree wins, what does a foreign application receive?

`text/plain` and `text/html` come from the browser's own range serialization, not from the value.
Excluding a hidden subtree from them means BUILDING both entries from the projection instead of
reading them off the selection — a change to what another application gets on paste. A third
decision, not a detail of the first.

**Recommendation:** take the FREE half now. For the read, the whole subtree, with the asymmetry
written down as the rule.

---

## D5 — What shape does insert-above take?

**Ticket:** [42](issues/42-no-insert-above-verb.md). The engine is ready: `writeRows` already carries
an absolute caret offset, and `#insertAfter` already resolves the caret for its own use, so
insert-above is the same function one sequence index lower. It is open only because both shapes grow
`RowNode`, which is published.

| | costs |
| --- | --- |
| **`addSibling(options?: {before?, caret?})`** | One name, two flags, cheapest to publish — and exactly the "boolean prop proliferation" the repo's own guide warns about. |
| **`addSibling` + `addSiblingBefore`, both answering the caret** | Two names, no flags. Changes the behaviour of a SHIPPED verb, which has to be declared. |

One in-repo caller wants it today: the showcase's table footer writes `+ New` as
`node.turnInto(tableLine, {text: '\n|+ ' + slot})` — an insert-above expressed through a
turn-THIS-row verb.

**Recommendation:** the second. A verb that makes a row the user cannot then type in is no use to
any caller, and a declared behaviour change is cleaner than a flag pair.

---

## D6 — Paint the clamp, or clamp the sweep?

**Ticket:** [44](issues/44-painted-selection-outruns-the-write.md). Driven and measured.

The painted highlight is not the span a keystroke replaces. A sweep into a fence paints six
characters across THREE boxes and the write takes two of them: the user selects six, types one, and
four are still there. Ticket 43's fix widened the same shape to a closed toggle. And a third
measurement showed the write need not even start at the paint's low edge — the clamp is a SUBRANGE
of the sweep, not a prefix of it.

Not data loss: the clamp is correct and is what stops a hidden body being deleted. It is a PAINT
problem.

| | costs |
| --- | --- |
| **Paint the clamp** — re-seat the selection onto the span the write would take | The machinery exists (`rowSelectionText`, and the editor owns a `selectionchange` listener). But re-seating mid-drag moves the base the browser extends from — the exact defect ticket 12 fixed — so it must wait for the sweep to settle, and "when a sweep settles" is the unmeasured part. |
| **Clamp the sweep** — refuse to extend into a raw closed body at all | Cheaper, no timing. Changes what a drag CAN select: a user who wants the fence's text can no longer sweep into it from outside. |

**Recommendation:** paint the clamp, because of the third measurement — once the write can land in
the MIDDLE of the highlight, honest paint is the only thing that makes the gesture legible.

---

## D7 — Does a menu seed carry the lead of the row it was called on?

**Ticket:** [21](issues/21-table-gestures.md), item 1. Built, then REVERTED in review.

`/` → Table seeds a header row only, so a person meets a grid with one line and has to know to press
Enter. Seeding a second line was built and came back out: the body is re-parsed, and a written line
lands at the depth its OWN lead says. A seed carries no lead, so its second line always lands at the
document ROOT — the table splits across two depths on any nested row.

The question is narrow and is really about the seed mechanism rather than about tables: a multi-line
seed has to inherit the lead of the row it replaces, or multi-line seeds cannot exist.

**Recommendation:** yes — and note it fixes a general mechanism, not one menu entry.

---

## D8 — An escape grammar for a carved delimiter

**Ticket:** [21](issues/21-table-gestures.md), item 3, which is `RowSpec.split`'s own named
follow-up. A `|` typed in a table line's body carves a cell and there is no way to write a literal
one. A paragraph is unaffected — carving belongs to the kind that declares `split`.

The only item of the three with real cost: it wants its own grammar and its own pass.

**Recommendation:** its own design session, not folded into anything else.

---

## D9 — Does `RowSpec.continues` grow a depth?

**Ticket:** [22](issues/22-continues-carries-no-depth.md).

`continues` carries a KIND and never a DEPTH, so no option can say "Enter opens a CHILD of this row"
— which is what a container wants. Notion's toggle entry opens the toggle and drops the caret
inside; here the person presses Enter, then Tab.

Two of the four costed obstacles shrank on re-measurement (one was simply refuted). Two stand, and
the second is the sharper: a plan formed in `tree/` cannot ask whether the deeper row would be
PAINTED — that is a DOM fact living at the seam — so "Enter opens a child" has to be decided at the
seam and fall back to a sibling there. A second decision point the costing does not yet name.

| | costs |
| --- | --- |
| **Grow it** | An extra word in `RowSpec` and in `Continuation`, both published, plus the seam fallback above. One consumer in this repo declares `continues` at all. |
| **Leave it** | Every container kind costs the user one keystroke they have to know about. |

**Recommendation:** leave it filed until a second consumer declares `continues`. The gap is real and
the price is one keystroke.

---

## D10, D11, D12 — the three affordances not taken

**Ticket:** [27](issues/27-four-missing-affordances.md). The fourth of the group, the gutter `+`, is
BUILT — with its cost declared: the reserved gutter went from 24px to 48px, which is a published
layout change pinned in both adapters.

The reason the other three waited — tickets 12, 13 and 16 — is gone; all three landed. So each now
needs its own yes or no, and each is an addition to published surface.

- **D10 — "Turn into" in the row menu.** `ROW_MENU_ITEMS` is three entries: add below, duplicate,
  delete. No set-wide verb beyond indent and drag exists.
- **D11 — sections and icons in the `/` menu.** It is a flat unsectioned list of roughly two dozen
  entries. The shape is already settled in the record: `icon?: Slot`, which is the version that
  keeps the exit criterion "the showcase's menu component contains no filtering and no insert
  logic" — there is no such component, and that is the point.
- **D12 — a selection toolbar.** Bold, italic, link and colour are reachable only by typing markup.

**Recommendation:** D11 first — it is the one whose shape is already decided and whose absence a
person meets on their first `/`. D10 and D12 are features, and features want a driving session
asking for them rather than a list saying they are missing.

---

## Outside this branch

**[20](issues/20-rowspec-group.md) — the table as a fence.** Parked at the maintainer's word for a
separate pass. Its measurement stands and inverts the question it was filed with: a raw closed body
already carves, two-level carving costs eight lines and no new surface, and the real prices are that
the table stops being document rows and that overlay triggers die inside a fence. Nothing here
depends on it.
