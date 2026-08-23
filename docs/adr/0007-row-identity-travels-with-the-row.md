# Per-row state travels with the row, not with its position

Nothing in the repo said which of the two it should be, and under same-index pairing it was the position: a reorder left every node id where it was and rotated the contents underneath, reporting `added: []`, `removed: []`, `structural: false` — a non-event. Both adapters key rows by `node.id` and `BlockController` prunes per-row UI state by it, so the consumer's row component, its local state and its DOM focus all stayed at the index while the text moved to a different row. This needed deciding rather than assuming, because for drag chrome — hover, the drop indicator — following the position is arguably the right answer; the mouse is over a place, not over a row.

Decided: a row owns its state. Dragging a row takes its node, its id and the consumer's component with everything inside it to the new index.

The cost is that a permutation is not derivable from the document. Moving a row past a byte-identical one produces the same string, so no diff — window-narrowed, LCS or keyed — can tell that move from a no-op; there is nothing to tell apart, and the difference is entirely in which row the user grabbed. The operation therefore states the permutation as a `Pairing` on the commit window, and adoption honours it only where the parse agrees with every pair ([ADR-0001](0001-tree-as-source-of-truth.md)).

Accepted scope boundaries, all three considered and deferred rather than overlooked. The framework still renders, and core does not own row DOM: moving rows without invoking the renderer, and full vapor-style DOM ownership, both require core to know how to build a row's DOM, which today only the adapter knows (`slots.block`, the consumer's `Mark`, `TokenChildren`). The controlled-mode caret for insertion-shaped operations stays a known defect by maintainer decision, 2026-08-17. Reopening any of the three is a new decision, not an oversight to be fixed in passing.

Full record: PR #283. The mechanism is in `packages/core/src/features/tokens/README.md`'s adoption section, and the term is in [`CONTEXT.md`](../../CONTEXT.md).

## Amendment, 2026-08-22: drag chrome follows the POSITION

The paragraph above names drag chrome as the case where following the position "is arguably the
right answer; the mouse is over a place, not over a row" — and then decides against it for
everything, chrome included. That half is amended: **block chrome is addressed by position.**
The decision it amends is untouched, and the two are separable because they are about different
state.

What moved: hover, the dragged row, the drop edge and the open menu are one editor-level
`ChromeController` (`store.chrome`), painted by one `ChromeLayer` per adapter at row boxes it
MEASURES. The per-row `BlockStore` this record's first paragraph points at is deleted, and so is
the `BlockController` that vended and pruned them — there is no per-row UI state left to travel
with a row, so the question this record answered no longer arises for chrome.

Each piece of chrome still STORES a row id; what is positional is how that id is chosen. Hover
is the row under the pointer's Y — the 24px gutter now hovers its row, and a point in the gap
between two rows snaps to the nearest one, where DOM containment showed nothing. The drop edge
is the same hit-test, so a drop in that gutter or gap now reorders where it previously reached
no handler. The menu is the one piece with an identity claim of its own, and it kept it: it
holds the id it opened on and refuses a verb whose row has left the tree.

What is NOT amended, and is still gated:

- **A row's own state travels with the row.** The consumer's row component, its local state, its
  DOM element and its id all move with a reorder — `Drag.spec.ts`'s "move the row ELEMENT rather
  than rebuilding it" and `tree/markNode.spec.ts`'s row-identity block.
- **The `Pairing` mechanism**, and adoption honouring it only where the parse agrees.
- **Both adapters key rows by `node.id`.**

Why chrome is the exception rather than a crack in the rule: chrome is not the row's state at
all. It is one editor's answer to "where is the pointer, and what is it doing" — one hovered row
per editor, one drag, one menu — and a reorder does not move any of it, because the pointer did
not move. Nothing about it survives a gesture.

The mechanism is in `packages/core/src/features/block/README.md`; the measurements that forced
the move, and the alternatives weighed against it, are in
`docs/scratch/row-mark-unification/issues/04-adapter-convergence.md`.
