# Remove `.get()` / `.set()` from Signal & Computed Primitives

**Date:** 2026-04-10
**Status:** Approved
**Approach:** Big-bang removal (Approach A)

## Motivation

Signal and Computed primitives expose both a callable form (`signal()`, `signal(value)`) and explicit method aliases (`.get()`, `.set()`). These are functionally identical — the callable form already handles all read/write logic. The explicit methods are redundant API surface that adds ~80 lines of duplicated implementation code and creates an inconsistent consumption pattern across the codebase.

## Scope

### What changes

**Interface simplification:**

```typescript
// Before
interface Signal<T> {
    (): T
    (value: T | undefined): void
    get(): T
    set(value: T | undefined): void
    use(): T
}

// After
interface Signal<T> {
    (): T
    (value: T | undefined): void
    use(): T
}

// Before
interface Computed<T> {
    (): T
    get(): T
    use(): T
}

// After
interface Computed<T> {
    (): T
    use(): T
}
```

**`Event<T>` is unchanged** — `.read()` and `.use()` remain since the callable form emits (different semantic).

### Implementation changes (`signal.ts`)

Remove `callable.get` and `callable.set` assignments from all three signal factory branches:
1. `equals: false` branch (boxed value)
2. Custom `equals` function branch
3. Default branch (reference equality)

Remove `callable.get` from `computed()` factory.

Net removal: ~80 lines of duplicated write logic.

### Migration patterns at call sites

| Before | After |
|--------|-------|
| `store.state.value.get()` | `store.state.value()` |
| `store.state.tokens.set(newTokens)` | `store.state.tokens(newTokens)` |
| `someComputed.get()` | `someComputed()` |

### Files affected

**Core implementation (1 file):**
- `packages/core/src/shared/signals/signal.ts`

**Core feature files (~16 files):**
- Store, Lifecycle, InputFeature, OverlayFeature, DragFeature, BlockEditFeature, FocusFeature, ArrowNavFeature, CopyFeature, TextSelectionFeature, SystemListenerFeature, ContentEditableFeature, valueParser, selectionHelpers, createSlots, BlockStore

**Test files (~8 files):**
- Store.spec, Lifecycle.spec, OverlayFeature.spec, TextSelectionFeature.spec, SystemListenerFeature.spec, signals.spec, computed.spec

**Framework components (0 files):** React/Vue components only use `.use()`, which is unchanged.

## What stays unchanged

- `.use()` on Signal and Computed — framework bridge
- `.read()` on Event — distinct semantic from callable emit
- `watch()`, `effect()`, `batch()` — no changes
- `SignalValues<T>` type helper — no changes
- `SignalOptions<T>` — no changes
- `setUseHookFactory()` / `getUseHookFactory()` — no changes
- Framework adapters (React `createUseHook.ts`, Vue `createUseHook.ts`) — no changes

## Risk

Low. The callable form already exists and is functionally identical. TypeScript enforces correctness — removing from the interface makes `.get()`/`.set()` calls compile errors, so missed call sites are caught at build time. The migration is mechanical find-and-replace.

## Verification

After implementation, all five checks must pass:
1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint`
5. `pnpm run format`
