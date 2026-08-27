# `duplicate` and `insertAfter` fail open on a carved PIECE

Type: task
Status: ready-for-agent
Blocked by: —

## Problem

`map.md:674-681`:

> **`duplicate` and `insertAfter` on a CARVED PIECE fail open in the shape `addSibling` just
> stopped failing in.** MEASURED 2026-08-26: on `'| a | b⏎after'` the first cell answers
> `duplicate() === true` → `'| a| a | b⏎after'` and `insertAfter('\n') === true` → `'| a⏎ | b⏎after'`.
> PRE-EXISTING and a family rather than a case — the cure is the same pre-order membership test,
> applied where each verb reaches `#applyStructural`. Not taken with `addSibling` because that verb
> was this phase's own and these are not; a cell is unreachable from `BlockController` (its target
> comes from `state.menu`, and `rowAt` treats a carved row as a leaf), so both are published-API-only
> today.

Verified at `52ef65ae`, and the asymmetry is visible in one screen of
`packages/core/src/features/tokens/seam/TokenModel.ts`:

- `addSibling` (`:1243-1252`) tests membership first —
  `if (!preorderRows(roots).some(entry => entry.row === node)) return undefined` — and its own
  docstring says why: *"A CARVED PIECE is why it is needed: a cell is a Row and answers `lead()`
  and `endsDocument` like any other, but both are meaningless for it."*
- `duplicate` (`:1103-1114`) and `insertAfter` (`:1115`) go straight to `#insertAfter` (`:1297`)
  with no such test.

`BlockController` is `RowController` now (the 2026-08-26 vocabulary rename); the reachability
claim holds unchanged — `ROW_MENU_ITEMS`'s `duplicateRow` runs through `#runMenuVerb`, whose target
is the open menu's row.

## Why it matters here

It is published API that corrupts a line rather than declining, and it is a family: every verb
reaching `#applyStructural` answers the same question. Low blast radius today (no in-repo caller can
reach a cell), which is why it is cheap rather than urgent.

## Cost

One membership test per verb, shared with the one `addSibling` already runs, plus a pin per verb
that drives a cell and asserts `false`.
