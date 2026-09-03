# The table's own gestures: a header-only seed, a dead Tab at the last cell, no escape for the delimiter

Type: task
Status: needs-triage — 1 REVERTED in review, 2 answered by the refusal channel, 3 still the named follow-up
Blocked by: —

> The three gaps `outcome.md:509` calls *"a table worth the name"*, separated from the missing
> primitive underneath them, which is [20](20-rowspec-group.md).

## Problem

Three distinct gestures, each verified at `52ef65ae` rather than taken from the record's phrasing.

**1. `/` → Table gives a header row only.** The driving session's complaint (`outcome.md:494`)
holds: `packages/storybook/src/pages/Notion/notion/options.tsx:599` seeds
`text: 'Task | Status | Owner | Due | Effort'` and nothing else. The header does declare
`continues: tableLine` (`:591`), so Enter opens a data line — the gap is that the user must know to
press it, on a construct whose whole point is a grid.

**2. Tab at the LAST cell is a dead key.** `packages/core/src/features/keyboard/rowKeys.ts:182-192`:
inside a carved row Tab walks pieces, and where there is no next piece it still calls
`preventDefault()` and returns. So Tab neither creates the next row (Notion's gesture) nor leaves
the cell, and nothing on screen says which happened — the silent-refusal class,
[29](29-refusal-is-silent.md).

**3. A `|` typed in a table line's body carves a cell, and there is no escape.** `RowSpec.split`'s
own docstring (`packages/core/src/shared/types.ts:203-205`): *"a piece cannot contain the delimiter
— an escape scoped to a cell's body is the named follow-up."* `outcome.md:509` states this more
loosely as *"a pipe typed in prose silently becomes a cell boundary"*; measured, a paragraph is
unaffected, because carving belongs to the kind that declares `split`.

## Why it matters here

The table is the showcase's most structural kind and the one a consumer is most likely to copy. Two
of the three gaps are one line of vocabulary each; the third (the escape) is a parser question and
is the only one with real cost.

## Cost

1 is a `menu.text` change in the showcase (a header plus one blank data line) and nothing in core.
2 is a decision about what Tab means at the end of a carved run — open a row of the `continues`
kind, or release the key. 3 is the named follow-up in `RowSpec.split` and wants its own escape
grammar; do not fold it in with the other two.

## Answered 2026-08-27 (T-D)

**1. The header-only seed — BUILT (`1fa7a6e6`), and it is a showcase change with nothing in core.**
`menu.text` is the row's own body and a body may carry a separator, which the table footer's own
`turnInto` already relies on, so the entry seeds the header line AND one empty data line under it,
with a cell per column: `'Task | Status | Owner | Due | Effort\n|  |  |  |  | '`. The seeded caret is
unchanged — the row's entry, which for a carved seed is the header's first cell — so the first thing
typed still replaces `Task`. Three showcase cases carried the one-row seed; the third of them, Enter
at the end of the seeded header, now writes its data row ABOVE the seeded empty one.

**2. Tab at the last cell — ANSWERED, and the answer is that it REFUSES OUT LOUD.**
Neither of the ticket's two options was taken, and the reason is in `rowKeys.ts`'s own rule:
*"Tab does NOT wrap into a row the user did not point at."* Releasing the key is the split ADR-0002
measured as a defect (a Tab that indents on one row and moves focus on the next), and it is exactly
what the consuming arm was added to stop — measured then, `document.activeElement` was a `<button>`
after one Tab past the last cell, and the next Enter was dead because the editor no longer had the
focus to split a row with. Opening a row of the `continues` kind is the other option and it makes a
NAVIGATION key write the document; the honest full gesture is three rungs (next cell → next row's
first cell → create), and only the third of them is what the ticket asks for, so taking that rung
alone would put a new row in the middle of a table where a user expected the next line's first
column.

What was actually wrong is that nothing said which of the two had happened. It does now: the key is
consumed and the row is tinted ([29](29-refusal-is-silent.md)). Re-open this as "Tab walks to the
next LINE'S first cell" if a driving session asks for it — that is the gesture worth having, and it
is a walk rather than a write.

**3. A `|` in a cell's body — UNCHANGED, and deliberately not folded in.** It is `RowSpec.split`'s
own named follow-up, it wants an escape grammar, and it is the only one of the three with real cost.
Nothing here touches it.

## Corrected 2026-08-27, in review — item 1 came back out

**THE TWO-LINE SEED SPLITS THE TABLE ACROSS TWO DEPTHS ON ANY NESTED ROW.** The claim the build
rested on — *"a body may carry a separator, which the table footer's own `turnInto` already relies
on"* — is false as a general rule. The body IS re-parsed, and the extra line is written at the depth
its OWN lead says. A seed carries no lead, so its second line always lands at the document ROOT.

Measured at core level, a bullet with one nested empty row turned into a two-line-seeded kind:

```
'- parent⏎⇥x'  →  '- parent⏎⇥|= A | B⏎|  | '
'- parent⏎x'   →  '- parent⏎|= A | B⏎|  | '
```

The header is nested under the bullet and the grid's only data row is at the root: one menu pick,
a table in two pieces. All three showcase cases seed at `rowsOf(host)[0]`, a ROOT row, where depth 0
is the right answer by accident — which is why the suite was green.

The footer's `turnInto(tableLine, {text: '⏎|+ ' + slot})` (`options.tsx:611`) is the same shape and
is PRE-EXISTING; it works because a table in the showcase document sits at the root. Not touched.

**The seed is one line again** and `MenuSpec.text` now says so: a seed is ONE ROW's body and may not
carry the separator. `continues: tableLine` still opens the first data line on Enter.

**So item 1 is OPEN again, and the two shapes that would close it properly are:**

1. **A seed that opens ROWS.** `menu.text` stays one row and gains a sibling — a list of lines the
   entry writes UNDER the row it seeds, at that row's own depth. New published surface on
   `MenuSpec`, and it needs a rule for where the caret lands across several rows.
2. **Re-lead the seed at the seam.** `OverlayController.#turnRowInto` knows the target row, so it
   could rewrite `separator` as `separator + row.lead()` before handing the text to `turnInto`.
   Four lines, but it gives `menu.text` a meaning `node.turnInto` does not share — two answers to
   one contract, which is the thing this effort keeps taking out.

Neither is a fixer's call. (1) is the honest one and is the more expensive.
