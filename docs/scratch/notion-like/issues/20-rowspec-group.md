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

## The trade above does not exist — measured 2026-08-27

The section above is wrong, and so was the question both the maintainer and the orchestrator were
asking. **A raw closed body already carves.** `split` and a closing literal are compatible by
construction: `rowMarkupError` accepts `'@table\n__value__\n@end'` (one body gap, no second value,
no touching placeholders); `usableOptions` and `shadowedRowKinds` police openers only;
`MarkupRegistry` sets `rowSplits` from the declaration alone; and `RowScanner.carve` splits
`row.slot` without asking how the body was bounded. Nothing excludes them.

Parsed three ways, same table, same marks:

| shape | tree | caret in a cell | mention parses |
| --- | --- | --- | --- |
| carved run (today) | 6 root rows, 5 cell rows each | yes | yes |
| fence, no `split` | 1 root row, 1 text child | no | no |
| fence **+ `split: {at: '\n'}`** | 1 root row, 5 line rows, inline-parsed | yes | yes |

So the fence keeps everything the carve had. What it does not do is recurse: `carve` is one level by
design (its own comment says so), so a fence carves into LINES but a line inside it does not carve
into cells.

**Two levels cost eight lines.** Measured on a copy of core in `/tmp`: `carve` made recursive with a
`seen: MarkupDescriptor[]` guard against a self-naming kind — **+8 lines, 0 deletions, 0 new public
surface**, since `Option.row.split` already carries everything. Fence → 3 lines → 3 cells each,
marks inside cells, `tree.value()` round-trips, and the tree's own §7.1 oracle passes. The code
around it was already shaped for this: `anchors.ts`'s descent comment says *"the descent is
recursive because that cell may be carved in turn"*. Core suite under an aliased config: 1427
passed, byte-identical to the unpatched baseline. The adapter projects were NOT run — their config
would not load from `/tmp` — so that half is unmeasured rather than green.

**It is shorter for the consumer, not longer.** Today: five options, ~45 lines, and the header must
be its own kind because which line is the header is a fact about the line after it. Fenced carve:
three options, ~20 lines — an anonymous `cell`, an anonymous `line` carrying
`split: {at: ' | ', as: cell}`, and the fenced `table` carrying `split: {at: '\n', as: line}`. The
header stops being a kind at all: the line component gets `index`, so `index === 0` is the header.
Column alignment and `role="table"/"row"/"cell"` land on real elements.

**It is more readable in the file.** Today six independent lines whose leading `|`/`|=` is both
opener and delimiter, with nothing marking where the table ends. Fenced: `@table`, lines whose pipes
are delimiters only, `@end` — two lines of fence bought, two characters per line saved, and the
extent explicit.

**What it really costs, and neither framing named either one.**

1. **The table stops being document rows.** `preorderRows` answers 1 for the whole fence, so no
   per-line grip, drag, row selection or Tab. Today every line is draggable.
2. **Overlay triggers die inside a fence.** `OverlayController` refuses a trigger when the caret's
   row `hasRawBody`, and `rowOf` reports the FENCE for a caret inside a carved piece — measured at
   one and two levels. So `@` in a cell is a literal `@`, though a mention written by hand still
   parses. Relaxing the guard to `&& !hasCells(row)` re-opens the `/` menu, whose pick would
   `turnInto` the FENCE and destroy the table. That is a decision about what `/` and `@` mean inside
   a carved cell, not a one-line relaxation.

**A fourth shape, measured and rejected:** a fence with a `__slot__` body inline-parses its whole
interior across newlines — marks and caret work — but there is no line or cell structure, and
`hasRawBody` is false, so Enter splits the fence.

**Verdict of the measurement, for the conversation this ticket is parked for.** The fenced two-level
carve wins every want this ticket exists for, shortens the consumer's declaration, and makes the
stored file more readable, for eight lines in one function. `RowSpec.group` is not needed for any of
the three. Two questions decide it: whether dragging a single table line is worth paying for the
cross-axis hit-testing ADR-0007 rules out, and what `/` and `@` should do inside a fenced cell.

Still open, and still the maintainer's call.
