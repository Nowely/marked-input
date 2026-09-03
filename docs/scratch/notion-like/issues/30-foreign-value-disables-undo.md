# A value the editor did not write disables undo while it stands

Type: task
Status: needs-triage
Blocked by: —

## Problem

`map.md:748-752`:

> **A value the editor did not write disables undo while it stands** (P8, declared). A parent that
> writes `value` itself, or another author's change arriving through it, leaves every entry naming
> a projection the document no longer holds, and `canUndo` answers `false` until it comes back.
> Mapping recorded windows through foreign changes is the collaborative-editing design, and this
> one does not foreclose it.

`outcome.md`'s item 22 states the same in one line.

## Why it matters here

A controlled React or Vue parent that reformats or normalises `value` on its way through — a very
ordinary thing for a controlled component's owner to do — turns the editor's own undo stack off
with nothing on screen saying so. It is the silent-refusal class ([29](29-refusal-is-silent.md))
applied to a whole feature.

## Shape of a fix, and why it is not a repair

Recorded as a design boundary rather than a defect: mapping recorded windows through foreign
changes IS the collaborative-editing design. The cheap intermediate — say so, rather than answer
`false` in silence — is what a decision here would settle first.

See ADR-0012 for what the stack records and why a `setValue`-shaped undo was measured wrong before
`invertWindow` existed.
