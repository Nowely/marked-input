# Design: `store.setState()` — Batch State Update API

**Date:** 2026-04-08
**Branch:** correct-signals

## Problem

After removing `defineState` and migrating `Store.state` to a plain object of individual `signal()` calls, framework components (React, Vue) lost the batch-set convenience. They now manually wrap 13–14 individual signal calls with `startBatch()`/`endBatch()`, which is verbose and leaks a low-level batching primitive into framework component code.

## Goal

Restore a clean batch-update API on `Store` that:

- Accepts a partial subset of state values
- Wraps updates in a single batch (no intermediate re-renders)
- Keeps `state` as a pure data bag (signals only, no behavior)
- Removes `startBatch`/`endBatch` from framework component imports

## Design

### Type helper — `SignalValues<T>`

Added to `packages/core/src/shared/signals/index.ts` (exported as a named type).

```ts
export type SignalValues<T extends Record<string, Signal<unknown>>> = {
    [K in keyof T]: T[K] extends Signal<infer V> ? V : never
}
```

Derives a plain-value object type from a signals object. Reusable — `BlockStore` can use it for the same pattern if needed.

### `store.setState(values)` method

Added to `Store` class in `packages/core/src/features/store/Store.ts`.

```ts
setState(values: Partial<SignalValues<typeof this.state>>): void {
    startBatch()
    try {
        for (const k in values) {
            this.state[k as keyof typeof this.state].set(values[k] as never)
        }
    } finally {
        endBatch()
    }
}
```

- Accepts any subset of state keys with their value types (not signal types)
- Iterates only the provided keys — does not touch unmentioned signals
- `startBatch`/`endBatch` already imported in Store via `shared/signals`
- Custom equals (e.g. `style` with `shallow`) are respected — each signal's own setter logic runs

### Framework call sites

Both `MarkedInput.tsx` (React) and `MarkedInput.vue` (Vue) replace manual batching blocks with a single `store.setState({...})` call. `startBatch`/`endBatch` imports are removed from both files.

**Before (React, ~16 lines, twice):**
```ts
const s = store.state
startBatch()
s.value(props.value)
s.defaultValue(props.defaultValue)
s.onChange(props.onChange)
// ... 11 more lines ...
endBatch()
```

**After:**
```ts
store.setState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    // ...
})
```

## Scope

| File | Change |
|------|--------|
| `packages/core/src/shared/signals/index.ts` | Export `SignalValues<T>` type |
| `packages/core/src/features/store/Store.ts` | Add `setState()` method, add `startBatch`/`endBatch` imports |
| `packages/react/markput/src/components/MarkedInput.tsx` | Replace manual batching with `store.setState({...})` × 2 |
| `packages/vue/markput/src/components/MarkedInput.vue` | Replace manual batching with `store.setState({...})` × 1 |

No behavior change — same batching semantics, same signals updated with same values.

## Out of scope

- `BlockStore.setState` — `BlockStore` only does individual signal updates in event handlers; no batch need
- Exporting `StoreState` as a named public type — not needed unless consumers request it
