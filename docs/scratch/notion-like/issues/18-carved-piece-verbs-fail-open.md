# `duplicate` and `insertAfter` fail open on a carved PIECE

Type: task
Status: resolved — the membership test moved into `#insertAfter` (2026-08-27)
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

## Answer

Not one test per verb — ONE test, at the place all three verbs already pass through. `#insertAfter`
was computing the membership question for its own caret (`rowSequence(roots).indexOf(node)`, and
`index < 0` meant "leave the caret to adoption"), and writing anyway; it now refuses when the node
is a ROW the sequence does not name. `duplicate`, `insertAfter` and `addSibling` are all answered by
that one line, and `addSibling`'s own `preorderRows(...).some(...)` came OUT — the rule had two
implementations, which doctrine A.4 counts as a defect even while both are green.

The refusal is the ROW half only. When a document has rows the sequence holds rows and nothing else,
so an inline node is absent from it by construction; refusing on absence alone would have broken
`insertAfter` on a mark, which is pinned by *"still inserts after an INLINE node, which the row
sequence never names"*.

Pins in `rowVerbs.spec.ts`, all seen red. Deleting the refusal reddens all three carved-piece pins —
`duplicate`, `insertAfter` and the `addSibling` one that has been there since P9 — each with
`expected true to be false`, which is what proves the moved test is the same test. Dropping only the
`node.kind === 'row'` qualifier reddens the inline pin with `expected false to be true`.

**Behaviour change:** `duplicate()` and `insertAfter()` on a carved piece answer `false` and write
nothing, where they answered `true` and corrupted the line (`'| a | b'` → `'| a| a | b'` and
`'| a⏎ | b'`). No in-repo caller can reach a cell with either verb, so this is published API only —
which is the whole reason it was cheap rather than urgent.
