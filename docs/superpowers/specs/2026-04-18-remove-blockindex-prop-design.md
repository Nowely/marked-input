# Remove `blockIndex` prop from React Container

## Summary

Remove the `blockIndex` prop from `Container.tsx` and `Block.tsx` in the React package. `Block` computes its index internally via `store.state.tokens().indexOf(token)` instead of receiving it from the parent. Core API and Vue components are unchanged.

## Motivation

`blockIndex` is the array index of a token in the tokens list, currently passed from `Container` through `Block` and `DragHandle` down to `BlockStore.attachContainer()` / `attachGrip()`. The index can be derived from the store state, making the external prop unnecessary and the component API cleaner.

## Scope

React only. No core (`@markput/core`) or Vue (`@markput/vue`) changes.

## Changes

### `packages/react/markput/src/components/Container.tsx`

- Remove the index parameter from the `.map()` callback in block layout rendering
- Change `tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)` to `tokens.map(t => <Block key={key.get(t)} token={t} />)`

### `packages/react/markput/src/components/Block.tsx`

- Remove `blockIndex` from the `BlockProps` interface
- Add `tokens` subscription via `useMarkput(s => s.state.tokens)`
- Compute `blockIndex` as `tokens.indexOf(token)` inside the component
- The computed `blockIndex` is passed to `blockStore.attachContainer(el, blockIndex, store.event)` and `<DragHandle token={token} blockIndex={blockIndex} />` internally

### `packages/react/markput/src/components/DragHandle.tsx`

- No changes. Still receives `blockIndex` from `Block`.

## What stays the same

- `BlockStore.attachContainer(el, blockIndex, actions)` signature
- `BlockStore.attachGrip(el, blockIndex, actions)` signature
- `BlockRegistry` class
- Vue `Block.vue` and `DragHandle.vue`
- Core package (`@markput/core`)

## Risks

None. The index is derived from the same source (`store.state.tokens`) that `Container` uses. The value is identical at render time.
