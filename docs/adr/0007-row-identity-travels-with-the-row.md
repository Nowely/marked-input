# Per-row state travels with the row, not with its position

Nothing in the repo said which of the two it should be, and under same-index pairing it was the position: a reorder left every node id where it was and rotated the contents underneath, reporting `added: []`, `removed: []`, `structural: false` — a non-event. Both adapters key rows by `node.id` and `BlockController` prunes per-row UI state by it, so the consumer's row component, its local state and its DOM focus all stayed at the index while the text moved to a different row. This needed deciding rather than assuming, because for drag chrome — hover, the drop indicator — following the position is arguably the right answer; the mouse is over a place, not over a row.

Decided: a row owns its state. Dragging a row takes its node, its id and the consumer's component with everything inside it to the new index.

The cost is that a permutation is not derivable from the document. Moving a row past a byte-identical one produces the same string, so no diff — window-narrowed, LCS or keyed — can tell that move from a no-op; there is nothing to tell apart, and the difference is entirely in which row the user grabbed. The operation therefore states the permutation as a `Pairing` on the commit window, and adoption honours it only where the parse agrees with every pair ([ADR-0001](0001-tree-as-source-of-truth.md)).

Accepted scope boundaries, all three considered and deferred rather than overlooked. The framework still renders, and core does not own row DOM: moving rows without invoking the renderer, and full vapor-style DOM ownership, both require core to know how to build a row's DOM, which today only the adapter knows (`slots.block`, the consumer's `Mark`, `TokenChildren`). The controlled-mode caret for insertion-shaped operations stays a known defect by maintainer decision, 2026-08-17. Reopening any of the three is a new decision, not an oversight to be fixed in passing.

Full record: PR #283. The mechanism is in `packages/core/src/features/tokens/README.md`'s adoption section, and the term is in [`CONTEXT.md`](../../CONTEXT.md).
