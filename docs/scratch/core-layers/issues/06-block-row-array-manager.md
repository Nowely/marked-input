# The block row-array manager

Type: research
Status: open

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
