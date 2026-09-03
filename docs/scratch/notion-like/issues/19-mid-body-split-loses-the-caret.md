# One split shape cannot place the caret: mid-body, on a row that keeps a subtree

Type: task
Status: resolved — the plan names the caret as an offset (2026-08-27)
Blocked by: —

## Problem

`map.md:720-730`:

> **One split shape a single window cannot place the caret in: MID-BODY, on a row that KEEPS a
> subtree.** `splitPlan`'s window is trimmed to the changed bytes now, which is what put the caret
> at the tail's start for every childless split (the ordinary Enter). It cannot be trimmed when the
> head keeps its children, because the edit is then two disjoint pieces — bytes leave at the cut,
> bytes arrive past the subtree — and the smallest window covering both is the whole bound, where
> `resolveMappedAnchor` collapses the caret onto its end. MEASURED on the tip, controlled:
> `'abcd⏎⇥child⏎tail'` split at 2 emits `'ab⏎⇥child⏎cd⏎tail'` with the caret at 12, the END of
> `cd`, where the tail's start is 10. At a row's END the two readings agree (the tail is empty), and
> that case is pinned. Closing the last shape needs a post-edit CARET carried through the
> transaction to adoption rather than inferred from window arithmetic — new surface across
> `applyRange`, `CommitSink` and `adopt`, which is a design change and not this repair.

Verified at `52ef65ae`: `splitPlan` still returns `{window, text, tail, into}` and no caret
(`packages/core/src/features/tokens/tree/siblings.ts:1014-1021`), so the caret is still inferred
from the window downstream.

## Why it matters here

The value is right and the caret is four characters past where the user pressed Enter, which is
the class P11 named — *"every failing gesture was pinned by the VALUE the editor emits and by
nothing else, and the value was right in all seven cases"* (`outcome.md:159-161`).

## Cost

New surface across three modules (`applyRange`, `CommitSink`, `adopt`) to carry a post-edit caret
through the transaction. It is the same arithmetic [17](17-cross-row-paste-is-spliced-raw.md) would
have to widen, so the two want deciding together rather than in either order.

## Answer

**The cost this ticket states is refuted.** *"New surface across three modules (`applyRange`,
`CommitSink` and `adopt`) to carry a post-edit caret through the transaction"* was true when it was
written and is not true today: `applyRange(window, text, caret?)` has carried a post-edit caret
since the seeded retype (`turnIntoPlan`'s own `caret` field), and `CommitSink.commit` and
`valueBoundary`'s `Landing` carry it the whole way. What was left was one field on the plan and one
argument at the call.

So `splitPlan` names the caret, as an OFFSET, and `tail`/`into` came out with the `#enterRow` call
that consumed them — `#enterRow` lost its `into` parameter and the offset arm behind it, which had
no reachable caller left. The window's arithmetic could answer for a contiguous splice and only for
one; an offset is also the only spelling that holds in CONTROLLED mode, where a verb may move no
derived caret because the tree has not moved when it returns.

Where the offset comes from is its own rule and its own pin: a kind is asked where it puts its body
with a probe, not by comparing two of its own outputs. A shared prefix names a position one past the
caret for a body beginning with the kind's own closing bytes — for a fence, any body starting with a
newline. Measured: 17 where the caret is at 16.

The measured case: `'abcd⏎⇥child⏎tail'` split at 2, controlled — the caret was at 12, the END of
`cd`; it is at 10, the tail's start. Pinned by name, and the property asserts the caret for all 7691
controlled cases it can echo.

**Behaviour change:** the caret after any split or paste through this plan is named by the plan.
Uncontrolled that agrees with what `#enterRow` used to place; controlled it moves, from the window's
end to the tail's start wherever the head keeps its children.
