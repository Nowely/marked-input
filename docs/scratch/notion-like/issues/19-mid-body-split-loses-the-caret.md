# One split shape cannot place the caret: mid-body, on a row that keeps a subtree

Type: task
Status: needs-triage
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
