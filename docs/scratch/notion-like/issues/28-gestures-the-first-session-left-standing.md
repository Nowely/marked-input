# Four gestures the first driving session reported that no commit since names

Type: task
Status: needs-triage
Blocked by: —

> `outcome.md:491-497` lists what the first session's "thirteen things felt wrong" left standing
> after the amendments. This ticket carries the four that are still open and are not covered by a
> ticket of their own; the fifth on that list — a row selection painted as a text selection — is
> **done** (`36404009`, `.RowSelected::after`), and the sixth and seventh are
> [21](21-table-gestures.md) and [27](27-four-missing-affordances.md).

## Problem

**1. The first Cmd+A selects the entire document** — *"one keystroke from wiping everything"*
(`outcome.md:478`). Verified at `52ef65ae`: `packages/core/src/features/keyboard/input.ts:80-84`
answers Mod+A with `widenRowScope(store)` first and `selection.selectAll()` otherwise, and
`widenRowScope` (`rowKeys.ts:252-257`) only widens *"while a row selection stands inside a NESTED
row"*. From a plain caret — the state a user is in — the first press takes the whole value.

**2. Backspace at the start of the row after an atomic block is a total no-op**
(`outcome.md:479`). Reported, not re-measured here.

**3. Nesting is a one-way door for a root paragraph.** `outcome.md:307-312`: 7 of the showcase's 26
kinds declare `indents`, so Tab never leaves the field there, and *"A ROOT paragraph has no parent
to inherit from, so a paragraph outdented to depth 0 cannot be indented again"* — the key is
consumed and nothing moves, which is [29](29-refusal-is-silent.md)'s shape.

**4. Undo granularity is uneven.** `outcome.md:480-482`: *"57 undos to unwind ~30 gestures,
splitting mid-word"* — while the same session's 57 undos landed byte-exact on the original and 57
redos byte-exact on the driver's version, which is the strongest single result in the record.
Correctness is not in question; the step SIZE is.

## Why it matters here

Each is a first-hour gesture with a known reading and no owner. 1 and 4 are the two a user can lose
work to.

## Shape of a fix, per item

1. A rung below select-all for the plain-caret case — Notion escalates block → document — or a
   deliberate "no, one press takes the value" with the reason written down.
2. Needs re-measuring before it is costed; it is likely the same "a row that holds no editable
   position" class rounds 4–11 chased.
3. Decide what Tab means at depth 0: release the key to the browser (ADR-0002's original bargain,
   which the editor-level `indents` answer took away) or say nothing and stay silent.
4. An undo step wants a policy — per word, per gesture, per commit window — and `HistoryModel` is
   where it would live.
