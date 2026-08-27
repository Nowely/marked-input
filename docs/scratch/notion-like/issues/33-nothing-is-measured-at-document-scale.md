# Nothing is measured at document scale: row-verb runtime and caret ergonomics

Type: research
Status: needs-triage
Blocked by: —

## Problem

Two items on `outcome.md`'s open list say the same thing about different subjects: the editor has
never been driven or timed on a document large enough to hurt.

**Runtime** — `outcome.md`'s item 30:

> **Row-verb runtime is uncharacterised.** `rowOf` is a full pre-order walk now run on every Enter,
> Tab and Backspace, with no benchmark. The one figure that exists is the drop tick: **~1.5 ms per
> `dragover` at 4000 rows, 9% of a frame**, kept because the alternative is a depth rule restated
> outside the mover.

`insights.md:170-173` records that same figure as the one place a cost is stated at all, and notes
what it buys: the drop's depth is chosen by the pointer's X in MEASURED indent units, so *"its cost
is stated where nothing else states one."*

**Ergonomics** — `outcome.md`'s item 27 and `map.md:743-745`: *"Caret ergonomics at document scale
— atomic tables and code blocks, Tab leaving the field (ADR-0002's accepted cost) — are unmeasured
over a document this size. Native undo is no longer on that list: the editor owns it (ADR-0012)."*

## Why it matters here

AGENTS.md's own engineering default is that *"performance claims need a benchmark or a documented
hot path"*, and the row verbs are on the keystroke path with neither. Twelve driving sessions all
ran on an 87-line showcase; the one number anybody has for 4000 rows came out of the drag.

## Shape of the work

A bench beside `commitCost.bench.ts` for `rowOf` / Enter / Tab / Backspace at 100, 1000 and 4000
rows, and one driving session on a document of that size. It is research: the output is numbers and
a verdict on whether anything needs an owner, not a fix.
