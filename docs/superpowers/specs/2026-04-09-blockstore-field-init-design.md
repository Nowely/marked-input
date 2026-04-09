# BlockStore: Move State Initialization to Class Field

## Summary

Refactor `BlockStore` to initialize `state` as a class field instead of in the constructor, matching the pattern used by `Store`.

## Motivation

`Store` initializes its `state` as a class field without a constructor. `BlockStore` currently uses a constructor solely to assign `this.state`. Aligning the two classes improves consistency and removes unnecessary boilerplate.

## Changes

### File: `packages/core/src/shared/classes/BlockStore.ts`

- Remove the type-only `state` declaration and `constructor()`
- Replace with a single class field initializer:

```ts
readonly state = {
    isHovered: signal(false),
    isDragging: signal(false),
    dropPosition: signal<DropPosition>(null),
    menuOpen: signal(false),
    menuPosition: signal({top: 0, left: 0}),
}
```

- Remove unused `import type {Signal}` if no other usage remains

## Scope

Single file change. No API change. No behavior change. All existing tests pass unchanged.

## Verification

- `pnpm test`
- `pnpm run build`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run format`
