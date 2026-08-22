# Per-node state: does BlockStore generalize?

Type: grilling
Status: open

## Question

`BlockStore` (`packages/core/src/features/block/BlockStore.ts`, 147 lines)
holds per-row UI state — `isHovered`, `isDragging`, `dropPosition`, `menuOpen`,
`menuPosition` — plus DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`),
vended lazily by `BlockController`'s WeakMap keyed by the row's TreeNode.
Nothing analogous exists for marks.

Under one facility set: what is the generic per-node state facility for any
node kind, who owns it, and is block chrome state an extension of it or a
consumer beside it? Does `BlockController` (92 lines: the `DragAction` event +
one watch lowering actions onto node verbs) survive as a separate owner, or
does it fold into the generic facility?

Constraints: one-way unification (marks gain no drag/menu); one owner per
state (AGENTS.md); the phase-4 target surface (~12 members) is the API budget
this must fit.
