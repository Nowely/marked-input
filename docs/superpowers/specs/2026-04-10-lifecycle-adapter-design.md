# Lifecycle Adapter Design

## Problem

Both React and Vue `useCoreFeatures` hooks contain identical orchestration logic:

1. Subscribe to `value`, `Mark`, `options` signals → call `syncParser()` after render
2. Subscribe to `tokens` signal → call `recoverFocus()` after DOM commit

This logic belongs in core but cannot be moved there because the core signal system is synchronous — it has no concept of "post-render" or "post-DOM-commit" scheduling. Each framework provides this timing differently:

| Concern                        | React                         | Vue                                               |
| ------------------------------ | ----------------------------- | ------------------------------------------------- |
| Mount/unmount                  | `useEffect(cb, [])`           | `onMounted` / `onUnmounted`                       |
| Post-render (syncParser)       | `useEffect(cb, [deps])`       | `watch(deps, cb, {flush:'post', immediate:true})` |
| Post-DOM-commit (recoverFocus) | `useLayoutEffect(cb, [deps])` | `watch(dep, cb, {flush:'post'})`                  |

## Solution: LifecycleAdapter

A per-component adapter that frameworks register via a global factory, following the existing `UseHookFactory` pattern in `packages/core/src/shared/signals/registry.ts`.

### Core Interface

```typescript
// packages/core/src/shared/signals/lifecycle-adapter.ts

/** A signal or computed callable that has a .use() method for framework subscription. */
type Subscribable<T = unknown> = (() => T) & {use(): T}

interface LifecycleAdapter {
    /** Framework runs callback on component mount. */
    onMount(callback: () => void): void
    /** Framework runs callback on component unmount. */
    onUnmount(callback: () => void): void
    /**
     * Watch signal deps and run callback after framework render.
     * First run is immediate (matches Vue immediate:true / React mount effect).
     * React: useEffect with .use() deps.
     * Vue: watch with flush:'post', immediate:true.
     */
    watchPostRender(deps: Subscribable[], callback: () => void): void
    /**
     * Watch a signal dep and run callback after framework DOM commit.
     * First run is skipped (only fires on changes).
     * React: useLayoutEffect with .use() dep.
     * Vue: watch with flush:'post' (no immediate).
     */
    watchPostCommit(dep: Subscribable, callback: () => void): void
}

type LifecycleAdapterFactory = () => LifecycleAdapter
```

### Registry

```typescript
// Added to packages/core/src/shared/signals/lifecycle-adapter.ts

let _adapterFactory: LifecycleAdapterFactory | undefined

export function setLifecycleAdapterFactory(f: LifecycleAdapterFactory): void {
    _adapterFactory = f
}

export function getLifecycleAdapterFactory(): LifecycleAdapterFactory | undefined {
    return _adapterFactory
}
```

Note: `getLifecycleAdapterFactory` returns `undefined` (not throws) so unit tests can run without a framework adapter. The `Lifecycle` class falls back to manual mode when no adapter is registered.

### React Hooks Constraint

React hooks must be called unconditionally and in the same order every render. The adapter factory is called once during render, and the adapter methods (`onMount`, `watchPostRender`, `watchPostCommit`) collect their callbacks. A final `activate()` step registers the actual React hooks.

The hook count is fixed because `Lifecycle.setup()` always registers exactly:

- 1 `onMount` + 1 `onUnmount` → 1 `useEffect([], ...)`
- 1 `watchPostRender` with 3 deps → 1 `useEffect([v, M, opts], ...)`
- 1 `watchPostCommit` with 1 dep → 1 `useLayoutEffect([tokens], ...)`

### How Lifecycle Uses the Adapter

New method on `Lifecycle`:

```typescript
setup(adapter: LifecycleAdapter): void {
  adapter.onMount(() => this.enable())
  adapter.onUnmount(() => this.disable())

  const {state} = this.store
  adapter.watchPostRender(
    [state.value, state.Mark, state.options],
    () => this.syncParser()
  )
  adapter.watchPostCommit(
    state.tokens,
    () => this.recoverFocus()
  )
}
```

### React Adapter Implementation

```typescript
// packages/react/markput/src/lib/hooks/createLifecycleAdapter.ts

import {setLifecycleAdapterFactory} from '@markput/core'
import {useEffect, useLayoutEffect} from 'react'

setLifecycleAdapterFactory(() => {
    let mountCb: (() => void) | undefined
    let unmountCb: (() => void) | undefined
    let postRenderDeps: Subscribable[] = []
    let postRenderCb: (() => void) | undefined
    let postCommitDep: Subscribable | undefined
    let postCommitCb: (() => void) | undefined

    return {
        onMount(cb) {
            mountCb = cb
        },
        onUnmount(cb) {
            unmountCb = cb
        },
        watchPostRender(deps, cb) {
            postRenderDeps = deps
            postRenderCb = cb
        },
        watchPostCommit(dep, cb) {
            postCommitDep = dep
            postCommitCb = cb
        },

        // Called after lifecycle.setup() to register React hooks
        activate() {
            useEffect(() => {
                mountCb?.()
                return () => unmountCb?.()
            }, [])

            const renderDepValues = postRenderDeps.map(d => d.use())
            useEffect(() => {
                postRenderCb?.()
            }, renderDepValues)

            const commitDepValue = postCommitDep?.use()
            useLayoutEffect(() => {
                postCommitCb?.()
            }, [commitDepValue])
        },
    }
})
```

The `activate()` method is React-specific. It is called by `useLifecycleAdapter()` after `lifecycle.setup(adapter)` to register the hooks in the correct order.

### Vue Adapter Implementation

```typescript
// packages/vue/markput/src/lib/hooks/createLifecycleAdapter.ts

import {setLifecycleAdapterFactory} from '@markput/core'
import {onMounted, onUnmounted, watch as vueWatch} from 'vue'

setLifecycleAdapterFactory(() => ({
    onMount(cb) {
        onMounted(cb)
    },
    onUnmount(cb) {
        onUnmounted(cb)
    },

    watchPostRender(deps, cb) {
        const vueRefs = deps.map(d => d.use())
        vueWatch(vueRefs, cb, {flush: 'post', immediate: true})
    },

    watchPostCommit(dep, cb) {
        const vueRef = dep.use()
        vueWatch(vueRef, cb, {flush: 'post'})
    },
}))
```

Vue does not need `activate()` because Vue's `watch` and lifecycle hooks are registered during `setup()` and don't have React's ordering constraint.

### What useCoreFeatures Becomes

**React** (`packages/react/markput/src/lib/hooks/useCoreFeatures.ts`):

```typescript
import type {MarkputHandler, Store} from '@markput/core'
import {getLifecycleAdapterFactory} from '@markput/core'
import {useImperativeHandle} from 'react'

export function useCoreFeatures(store: Store, ref: React.Ref<MarkputHandler> | undefined) {
    useImperativeHandle(ref, () => store.handler, [store])

    const factory = getLifecycleAdapterFactory()!
    const adapter = factory()
    store.lifecycle.setup(adapter)
    adapter.activate() // registers React hooks
}
```

**Vue** (`packages/vue/markput/src/lib/hooks/useCoreFeatures.ts`):

```typescript
import type {Store} from '@markput/core'
import {getLifecycleAdapterFactory} from '@markput/core'

export function useCoreFeatures(store: Store) {
    const factory = getLifecycleAdapterFactory()!
    const adapter = factory()
    store.lifecycle.setup(adapter)
}
```

### Typing the activate() Method

The `activate()` method is React-specific and not part of the core `LifecycleAdapter` interface. The React adapter returns an extended type:

```typescript
interface ReactLifecycleAdapter extends LifecycleAdapter {
    activate(): void
}
```

The factory in React returns `ReactLifecycleAdapter`. The `useCoreFeatures` hook casts or accesses it directly since it knows it's in React context.

### Backward Compatibility

- `Lifecycle.syncParser()` and `Lifecycle.recoverFocus()` remain public methods
- `Lifecycle.enable()` and `Lifecycle.disable()` remain public methods
- The adapter is optional — if no factory is registered, the old manual pattern still works
- Unit tests continue to call `enable()` / `syncParser()` / `recoverFocus()` directly

### Files Changed

**New files:**

- `packages/core/src/shared/signals/lifecycle-adapter.ts` — interface + registry
- `packages/react/markput/src/lib/hooks/createLifecycleAdapter.ts` — React adapter
- `packages/vue/markput/src/lib/hooks/createLifecycleAdapter.ts` — Vue adapter

**Modified files:**

- `packages/core/src/shared/signals/index.ts` — export new types and functions
- `packages/core/src/features/lifecycle/Lifecycle.ts` — add `setup()` method
- `packages/react/markput/src/lib/hooks/useCoreFeatures.ts` — simplify to use adapter
- `packages/react/markput/src/components/MarkedInput.tsx` — import adapter side-effect
- `packages/vue/markput/src/lib/hooks/useCoreFeatures.ts` — simplify to use adapter
- `packages/vue/markput/src/components/MarkedInput.vue` — import adapter side-effect
- `packages/core/index.ts` — export new public API if needed

### Testing Strategy

- Core unit tests: `Lifecycle.spec.ts` unchanged (tests call `enable()`/`syncParser()` directly)
- New unit test: `lifecycle-adapter.spec.ts` — test registry set/get, test `setup()` wires callbacks
- Storybook browser tests: existing tests validate the full integration (React + Vue)
- No new browser tests needed — the behavior is identical, only the wiring changes
