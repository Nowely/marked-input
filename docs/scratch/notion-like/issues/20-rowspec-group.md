# `RowSpec.group` — the primitive three table wants are blocked on

Type: task
Status: needs-triage
Blocked by: —

> Cited from four places in the records with three wants hanging off it. This is the ONE ticket for
> it; the table's own gesture gaps are [21](21-table-gestures.md).

## Problem

A table is a run of independent lines, and nothing wraps consecutive siblings that share a
component. `map.md:732-738`:

> **A table is a run of independent lines, and three wants hang off that one gap.** Columns cannot
> align, the accessible semantics cannot be a table (one `role="table"` per LINE describes a table
> of one row, which is why the probe carries none), and the header can only be read from the DOM
> run. All three are the same missing thing — a wrapper around consecutive siblings sharing a
> component, `RowSpec.group` — and none of them is a reason to give a cell a node kind of its own.
> The alignment line is a fourth: `'| ---'` is a longer opener than `'| '`, so a kind of its own is
> available to the consumer whenever someone wants it to paint as a rule instead of as dashes.

`outcome.md`'s item 8 states the same three wants; `outcome.md:594-599` and `insights.md:396-398`
state the threshold.

Verified at `52ef65ae`: `RowSpec` (`packages/core/src/shared/types.ts:151-208`) declares
`Component`, `continues`, `indents`, `split` — no `group` — and the showcase's `options.tsx`
contains no `role=` attribute at all, exactly as the record says.

## Why it matters here

`insights.md:396-398`:

> **`RowSpec.group`.** Three wants are blocked on it (column alignment, table semantics, header
> runs) and `map.md` records the threshold honestly: *when a fourth turns up, it stops being a
> feature and becomes the missing primitive.* No fourth has turned up. Re-check when one does.

## The threshold, not a plan

This stays unbuilt on purpose, and the trigger is written down rather than left to taste: a FOURTH
want. `outcome.md:597-599` — *"The one exception is `RowSpec.group`, which three separate wants are
blocked on … when a fourth turns up, it stops being a feature and becomes the missing primitive."*

The doctrine's own first test — what does the proposal delete — is what keeps it out today: it
deletes nothing and adds published surface (`insights.md:392-395`).

## A direction, recorded rather than acted on (2026-08-27)

The maintainer's own, and it is not `RowSpec.group`: **a FENCE before and after the table, with the
mark parsing the interior** — which is how the properties panel, the table of contents and the board
already work. It answers all three wants at once and adds no published surface: one element wraps
the run, so columns align in a real table box, `role="table"` has somewhere to live, and the header
is a position in the interior rather than a run read off the DOM.

**The trade it implies, measured rather than asserted**, on the two shapes side by side:

- A CELL IS A ROW. `'| a @[Kara] | b'` under `split: {at: ' | ', as: cell}` parses to one row with
  TWO child ROWS, and the first holds `text('a ')`, a MARK and `text('')`. So the caret enters a
  cell, every row verb addresses it, and a mention parses inside it — which is what probe ticket
  [02](02-variadic-placeholders.md) was closed on.
- A RAW CLOSED BODY IS ONE TEXT CHILD. `'@table⏎a @[Kara] | b⏎@end'` under
  `'@table⏎__value__⏎@end'` parses to one row with ONE text child carrying `'a @[Kara] | b'`
  verbatim. No cells, no mark, no caret position the editor owns — the interior is the consumer's
  to parse and to paint.

So a fenced table gives up EDITABLE CELLS to gain the three wants. That is the trade, and it is a
real one in both directions: everything the interior does — a caret in a cell, Tab between cells, a
mention inside one, a drag of one line — would be the mark's own to rebuild, and none of it is
markup the editor can read back.

Left open. Nothing here decides between the two; both sides are now on the record with the
measurement that supports them.
