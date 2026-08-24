# A consumer cannot name a Row

Type: task
Status: needs-triage
Blocked by: —

## Problem

`RowNode` is exported from no public barrel. `packages/core/index.ts:14` exports
`Anchors`, `MarkNode`, `NodeAnchor`, `TextNode`, `TreeNode` — and
`packages/react/markput/index.ts:23` re-exports the same set minus `Anchors`.
Neither lists `RowNode`, though a row is the only root kind block layout
produces (`packages/core/src/features/tokens/tree/types.ts:51-79`) and
`store.tokens.nodes()` hands them straight to the consumer.

`Store` is exported from core (`packages/core/index.ts:5`) but NOT re-exported
from the react barrel, so a react consumer who selects through
`useMarkput(s => …)` — the only way to reach `store.block`, `store.edit` or
`store.tokens` — must add `@markput/core` as a second dependency to name the
type they already receive.

## Why it matters here

A notion-like package is exactly the consumer that writes row-level code: "what
kind of row is the caret in", "insert a row after this one", "paint chrome for
each row". Today that code is either untyped or dual-dependent.

## Note

This is a barrel question, not a design question: the values are already
reachable and already shipped. Cheap to fix, and worth checking against
`docs/scratch/api-v2/spec.md` first so the export list is settled once.
