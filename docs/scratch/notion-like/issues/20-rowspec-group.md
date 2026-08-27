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
