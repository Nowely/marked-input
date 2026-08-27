# The table's own gestures: a header-only seed, a dead Tab at the last cell, no escape for the delimiter

Type: task
Status: needs-triage
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
