# A consumer cannot name a Row

Type: task
Status: resolved — both halves landed; `Store` and `MarkInfo` are in both adapter barrels (2026-08-27)
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

## Note — half of this landed in P1 (2026-08-25)

`RowNode` is now exported from `packages/core/index.ts:16` and re-exported from both adapter
barrels (`packages/react/markput/index.ts:23`, `packages/vue/markput/index.ts:22`), together with
a new `RowProps` in each. The second half is UNTOUCHED: `Store` is still not re-exported from
either adapter, so a react consumer selecting through `useMarkput(s => …)` still has to add
`@markput/core` to name the type it already receives. Stays open for that.

## Answer — the second half (2026-08-27)

`export type {MarkInfo, Store}` in both adapter barrels. TYPE only: core exports the `Store` class
as a value because both adapters construct one, and publishing the constructor from an adapter
would offer "build an editor by hand" as a contract nobody asked for.

`MarkInfo` went with it, found by the audit this ticket asks for: `useMarkInfo()` is published by
both adapters and its RETURN type was not, so declaring that value separately cost the same second
dependency. The generated page for the hook named it and linked nothing.

**Checked and NOT taken: `CSSProperties`.** `packages/storybook/src/shared/lib/marks.shared.ts` and
`marks.react.tsx` import it from core, but those files are framework-FREE by design and could not
use an adapter barrel either way, so they are not evidence about this boundary. A consumer's
spelling is `RowProps['style']`, which is what the showcase itself uses (`options.tsx`'s
`Paragraph`), and indexed access is the same reasoning that dropped `Id` and `MarkPatch` from
core's own barrel.

**The audit's own answer, recorded so it is not re-run blind:** the showcase imports NOTHING from
`@markput/core`, and cannot — `boundary.spec.ts` fails on any specifier that is not `react`,
`@markput/react` or a file inside its own directory. The one core import under `pages/Notion/` is
`structure.react.spec.tsx`'s `new Store()`, which is a headless parse harness reaching test-only
oracles, not consumer code. The last time this grep found something real, the answer was publishing
`Suggestion`; this time it is `Store` and `MarkInfo`.
