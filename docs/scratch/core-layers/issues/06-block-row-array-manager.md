# The block row-array manager

Type: research
Status: resolved

The layer split is done, and the note that asked for it ("extract an array manager, a view
part") is closed as already-done. One residue survives it: `features/block/operations.ts` is a
second row-array manager, projecting the document into row strings and composing it back,
outside `tree/`.

It is not the naive version, though — its reads are anchor-addressed (`operations.ts:5-6`
declares a slice as `(from: NodeAnchor, to: NodeAnchor) => string`, backed by
`tokens.valueBetween`), and the module documents that it works on the tree's own string and
never the props-first `value()`. So it is a string *composer* over anchored reads, not a
parallel model.

**Question.** Should the row-array projection move into `tree/` as an anchor-addressed
sibling-list API, or is composing over strings the right shape for what block editing actually
does? Worth answering together with 03 and 05 — all three are about how much of "row" belongs
below the block feature.

Note in passing, found while checking this: `features/block/README.md:3` is stale — it says the
feature routes value mutations through `store.edit.replace()`, but `BlockController` calls
`edit.setValue(...)`.

## Answer

Neither: the projection dissolved instead of moving (2026-08-21). Its one surviving consumer
was `addRowUnanchored` — a single row insert — and two anchor slices express that directly
through the existing `read`: `read('start', cut) + separator + read(cut, 'end')`, where `cut`
is `'start'` or `{after: rows[at - 1]}`. `project()`, `compose()` and `insertRow()` are
deleted; no anchor-addressed sibling-list API needs to enter `tree/`, because nothing composes
over row arrays anymore.

The texts/gaps channel's non-tiling safety was the only thing lost, and it was already worth
less than it read: on a non-tiling tree the old compose DROPPED content before the first and
after the last row. The slice form preserves edge content and puts the pre-insertion gap after
the separator instead of before it. On the live tree — which always tiles, so every gap is
`''` — output is byte-identical, pinned by `BlockController.spec`'s `afterIndex: -1` /
`afterIndex: 0` / empty-document cases.

The stale-README note above was already fixed separately.
