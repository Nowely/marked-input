# Design: `useMarkput` — Framework Reactive API

**Date:** 2026-04-12
**Branch:** impr5

---

## Problem

The current `.use()` method on `Signal<T>`, `Computed<T>`, and `Event<T>` is a framework hook disguised as a plain method call. This causes several issues:

- React rules-of-hooks linters cannot detect misuse (wrong call site, conditional call, called inside store methods)
- `.use()` has been called inside the store and feature code where no framework context exists, causing silent failures
- For multi-framework support, embedding a hook factory into signal primitives couples the reactive core to the framework adapter layer

---

## Goal

Replace `signal.use()` with a proper framework hook — `useMarkput(selector)` — that:

1. Follows React/Vue hook conventions so linters can enforce correct usage
2. Lives entirely in the framework adapter package, not in core
3. Supports both single-signal and multi-signal (object) subscriptions
4. Uses an identical call signature in React, Vue, and Solid

---

## API

### Single signal

```ts
const tokens = useMarkput(s => s.state.tokens)   // Token[]
const drag   = useMarkput(s => s.props.drag)      // boolean
```

### Object selector — multiple signals, one call

```ts
const { drag, tokens, className, readOnly } = useMarkput(s => ({
  drag:      s.props.drag,
  tokens:    s.state.tokens,
  className: s.computed.containerClass,
  readOnly:  s.props.readOnly,
}))
```

### TypeScript signature

```ts
// Single signal or computed
function useMarkput<T>(
  selector: (store: Store) => Signal<T> | Computed<T>
): T

// Object of signals/computeds
function useMarkput<R extends Record<string, Signal<unknown> | Computed<unknown>>>(
  selector: (store: Store) => R
): SignalValues<R>
```

`SignalValues<R>` already exists in core — `{ [K in keyof R]: R[K] extends Signal<infer V> | Computed<infer V> ? V : never }`.

---

## What Is Removed

| Item | Location | Reason |
|------|----------|--------|
| `Signal<T>.use()` | `core/src/shared/signals/signal.ts` | Replaced by `useMarkput` |
| `Computed<T>.use()` | same | same |
| `Event<T>.use()` | same | same |
| `_hook` memoization in signal factories | same | No longer needed |
| `setUseHookFactory` / `getUseHookFactory` / `UseHookFactory` | `core/src/shared/signals/registry.ts` | No longer needed |
| `createUseHook.ts` | `react/markput/src/lib/hooks/` | Replaced by `useMarkput.ts` |
| Module augmentation `.use()` on `Slot`, `MarkSlot`, `OverlaySlot` | `react/markput/src/lib/providers/StoreContext.ts` | No longer needed |

---

## React Implementation

**File:** `packages/react/markput/src/lib/hooks/useMarkput.ts`

```ts
import { useSyncExternalStore, useRef } from 'react'
import { computed, watch } from '@markput/core'
import type { Signal, Computed, SignalValues, Store } from '@markput/core'
import { useStore } from '../providers/StoreContext'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): T
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): SignalValues<R>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector) {
  const store = useStore()

  // Stable computed that merges selector result into a single reactive value.
  // Created once per hook instance via useRef to avoid new computed on every render.
  const derivedRef = useRef<Computed<unknown>>(null)
  if (derivedRef.current === null) {
    derivedRef.current = computed(() => {
      const result = selector(store)
      if (typeof result === 'function') {
        // Single Signal<T> or Computed<T> — unwrap
        return (result as Selectable<unknown>)()
      }
      // Object of signals — unwrap each entry
      const out: Record<string, unknown> = {}
      for (const key in result) {
        out[key] = result[key]()
      }
      return out
    })
  }

  const derived = derivedRef.current
  // subscribe and getSnapshot are stable closures over `derived`
  const subscribeRef = useRef((cb: () => void) => watch(derived, cb))
  const snapshotRef  = useRef(() => derived())

  return useSyncExternalStore(subscribeRef.current, snapshotRef.current, snapshotRef.current)
}
```

The `computed` wrapper tracks all signal dependencies touched during the selector run. When any dependency changes, `watch` fires and `useSyncExternalStore` triggers a re-render.

---

## Vue Implementation

**File:** `packages/vue/markput/src/lib/hooks/useMarkput.ts`

```ts
import { computed, onUnmounted } from 'vue'
import type { Signal, Computed, SignalValues, Store } from '@markput/core'
import { useStore } from '../providers/StoreContext'

type Selectable<T> = Signal<T> | Computed<T>
type ObjectSelector = Record<string, Selectable<unknown>>

export function useMarkput<T>(selector: (store: Store) => Selectable<T>): ComputedRef<T>
export function useMarkput<R extends ObjectSelector>(selector: (store: Store) => R): ComputedRef<SignalValues<R>>
export function useMarkput(selector: (store: Store) => Selectable<unknown> | ObjectSelector) {
  const store = useStore()
  return computed(() => {
    const result = selector(store)
    if (typeof result === 'function') return (result as Selectable<unknown>)()
    const out: Record<string, unknown> = {}
    for (const key in result) out[key] = result[key]()
    return out
  })
}
```

Vue's `computed()` auto-tracks alien-signals dependencies because the getter runs synchronously and reads signal values — no bridging needed. Returns a `ComputedRef<T>` that auto-unwraps in `<template>`.

---

## Framework Adapter Summary

| Framework | Package | Hook name | Return type | Notes |
|-----------|---------|-----------|-------------|-------|
| React | `@markput/react` | `useMarkput(selector)` | `T` | `useSyncExternalStore` |
| Vue 3 | `@markput/vue` | `useMarkput(selector)` | `ComputedRef<T>` | Vue `computed()`, auto-unwraps in template |
| Solid.js | `@markput/solid` (future) | `useMarkput(selector)` | `Accessor<T>` | Solid `createMemo()` |
| Angular | `@markput/angular` (future) | `store.select(selector)` | `Signal<T>` | Angular's DI pattern; `use` prefix not idiomatic |
| Svelte 5 | `@markput/svelte` (future) | `markput(selector)` | Svelte store `{ subscribe }` | `$tokens` in template |

---

## Migration: Internal React Components

Components currently do:
```ts
const store = useStore()
const drag   = store.props.drag.use()
const tokens = store.state.tokens.use()
```

After migration:
```ts
const { drag, tokens } = useMarkput(s => ({
  drag:   s.props.drag,
  tokens: s.state.tokens,
}))
```

`useStore()` remains available for cases where the raw `Store` instance is needed (attaching refs, emitting events, etc.) — it is not a subscription hook and does not change.

### Components to migrate

| File | Signals currently using `.use()` |
|------|----------------------------------|
| `Container.tsx` | `props.drag`, `state.tokens`, `computed.containerClass`, `computed.containerStyle`, `props.readOnly`, `computed.container` |
| `Block.tsx` | `computed.block`, `blockStore.state.isDragging` |
| `Token.tsx` | `computed.mark` |
| `useMark.tsx` | `props.readOnly` |
| `useOverlay.tsx` | `state.overlayMatch` |

---

## Events

`Event<T>.use()` is removed along with `Signal<T>.use()` and `Computed<T>.use()`. No subscribe-side replacement is needed in components — no React or Vue component currently subscribes to events via `.use()`. Components only **emit** events:

```ts
store.event.mounted()
store.event.afterTokensRendered()
```

Feature code subscribes to events via `watch`, which is unchanged. If a component ever needs to react to an event, the pattern is `useEffect` + `watch`:

```tsx
useEffect(() => watch(store.event.change, handler), [store])
```

`useMarkput` only accepts `Signal<T>` and `Computed<T>` selectors — events are intentionally excluded.

---

## Out of Scope

- Solid, Angular, Svelte adapters (future packages, not part of this change)
- Changes to `watch`, `batch`, `effect`, or alien-signals internals
