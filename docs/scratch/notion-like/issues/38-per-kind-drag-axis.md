# A per-kind drag axis — a phase, not a follow-up

Type: task
Status: wontfix
Blocked by: —

> Filed so the refusal has a home and a reason. Re-open as a PHASE with a spec, not as a fix.

## Problem

The drop tiles the document by Y, so two rows cannot sit side by side and be dragged between.
`outcome.md`'s item 21, after the board itself was fixed in the showcase: *"The metric cards are
still stacked, not beside the callout: two rows cannot sit side by side while the drop tiles the
document by Y."*

## Why it stays out (`insights.md:399-402`)

> **A per-kind drag axis** — and therefore the nested-row board and the metric cards beside the
> callout. It is cross-axis hit-testing, which P10 put out of scope with a measurement rather than
> a preference (a board's columns share one Y span, so a card dragged between them lands in an
> arbitrary one). Reopening it is a phase, not a follow-up.

Related and already answered: the board's own card drag IS the document's now — `Board` is
controlled, a drop announces the next arrangement, and the option writes it back with
`node.turnInto(board, {text})` (`outcome.md`'s item 21, fixed 2026-08-26). The reading that produced
that defect — *"not owned by core" = "keep it in the component"* — is corrected in `showcase.md`.

Also relevant to the cost: `RowController`'s drop tick is already **~1.5 ms per `dragover` at 4000
rows, 9% of a frame** with one axis ([33](33-nothing-is-measured-at-document-scale.md)).

## Re-open when

A layout is needed that the document's own Y order cannot express AND somebody is prepared to spec
cross-axis hit-testing with the depth rule the mover owns. Anything smaller is the same defect P10
measured.
