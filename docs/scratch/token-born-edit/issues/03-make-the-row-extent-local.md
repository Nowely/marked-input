# Phase 1 — make the Row extent local

Status: resolved

**Done 2026-08-20 inside phase 0's execution (#291).** `PatternMatcher.resolveSlotLeadingMatches`
is gone — the file's numstat in `31fac6d1` is `0 42`, the exact deletion size this issue
predicted — and `filterEmptyText` went with it (`0 14`). Only a tombstone comment remains
(`parser/core/RowBuilder.ts:94`). The replacement is `RowBuilder.closeTrailingGaps`, which closes
an open trailing gap FORWARD to the next separator, bounded by the enclosing slot or end of input.

**Three ways it landed differently from this plan, recorded because they falsify its premises:**

1. It took NEITHER route this issue allowed. Rows became tree NODES (`RowNode`), not
   self-delimiting Marks, and it was not a pure `parser/` refactor — `31fac6d1` is 82 files,
   +1960/−857.
2. "A pure deletion, replaced by nothing" is false: `RowBuilder.ts` is +185 new lines.
3. The promise that "`adopt`, anchors, `Pairing`, `bind` and both adapters are untouched and no
   ADR is amended" did not hold. All four were touched and ADR-0009 was written.

The capability the chain provided was DROPPED BY DECLARATION, not silently lost: a markup may no
longer begin with a placeholder (`MarkupDescriptor.ts` throws at registration, pinned in
`Parser.spec.ts`).

**One limit worth stating:** the replacement is still document-wide. `RowBuilder.rowPass` is a
fixpoint over the whole accepted-match set and `findSeparators` scans the entire value. The Row's
extent is local SEMANTICALLY (the span between nearest separators) and not STRUCTURALLY.

---

Delete `PatternMatcher.resolveSlotLeadingMatches`, so a Row's extent is decided by its own
boundaries instead of by a document-wide left-to-right chain.

## The mechanism being removed

`PatternMatcher.ts:113-137` walks the completed matches left to right with a running boundary
starting at `0`, setting each slot-leading match's start to the **end of the previous** one, and
assigning everything between as that match's Slot. Its own docblock states the consequence: matches
between two slot-leading matches "become nested children rather than siblings". The call carries
`//TODO need review it` at `PatternMatcher.ts:43`.

This chain is the single hardest obstacle to a windowed or Token-local parse, because it makes a
Row's extent a property of the whole document.

## Evidence that it deletes cleanly

The `phase7-first-class-rows-wip` branch removed it in `f3e1bdd0`:

```
git diff --numstat aac02ac4 5328a158 -- PatternMatcher.ts   →   0 42
```

A pure deletion, replaced by **nothing** — the inline parser simply never sees a row markup once
the boundary is decided before the inline call. The `Match` zero-width slot seed went with it and
both `//TODO need review it` markers died.

The equivalence argument is what licenses this as a refactor rather than a behaviour change: the
chain's `boundary = 0; match.start = boundary; boundary = match.end` **is** a left-to-right split.

## What dies with it

`filterEmptyText` (now wired into `tree/valueBoundary.ts` one line before adoption), the two
`isSlotLeading` predicates left after [issue 01](01-one-row-predicate.md), `isSlotLeadingMark`,
`isTextLikeRow`, `canMergeRows`' descriptor comparison, and the slot-versus-text branch in the row
merge. That list is the success checklist.

## Warning from the prior attempt

`f3e1bdd0` also deleted the whole `describe('slot-leading single-segment patterns')` — seven cases
including nesting and a stringify round-trip — plus the identity fixture and the slot-leading
property test, replacing them with NOTE comments and no inline substitute. A slot-leading
single-segment Markup could no longer be parsed inline at all. Do not repeat that: whatever
capability the chain provided must either survive or be declared dropped.

## Suggested first move

A characterization property spec beside `parser/Parser.spec.ts` pinning today's chained parse
against a local split-then-parse reference over generated documents, compared with
`tokensToDebugTree()`. Generate the trailing-unterminated remainder explicitly — that is the one
case where the two could legitimately disagree; `Parser.spec.ts` pins
`'First\n\nTrailing'` as `[TEXT "", MARK, TEXT "Trailing"]`.

If they agree, the replacement is a pure refactor inside `parser/`: the emitted shape stays
`TextToken | MarkToken`, so `adopt`, anchors, `movePlan`, `Pairing`, `bind` and both adapters are
untouched and no ADR is amended.

Existing guards that would catch a regression: `Parser.spec.ts:1237-1308`,
`storybook/src/pages/renderCount.spec.ts:160,195`, `tree/adopt.spec.ts` plus
`adopt.property.spec.ts`, and `tree/valueBoundary.spec.ts:438` — expect that last one to change,
deliberately.
