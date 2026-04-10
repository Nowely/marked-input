# Remove Lifecycle: Inline into Store with mounted/unmounted Events

## Problem

`Lifecycle` is a 44-line class in its own feature folder whose only job is:

1. Watch `store.event.updated` → on **first** emission, call `f.enable()` on all 11 features
2. Watch `store.event.unmounted` → call `f.disable()` on all features

It is instantiated only in `Store.ts`, accessed only by its own tests, and adds indirection without value. The "first updated" detection hack (`#enabled` flag) is an artifact of overloading the `updated` event with mount semantics.

## Solution

### 1. Introduce `mounted` event

Add `mounted: event()` to `Store.event`. This gives Store a clean, explicit lifecycle:

- **`mounted`** — emitted once by frameworks on initial mount → enables all features
- **`updated`** — emitted on every render (mount + updates) → parse sync, etc.
- **`unmounted`** — emitted on unmount → disables all features

No more "first updated" flag hack.

### 2. Inline lifecycle watches into Store

Replace `readonly lifecycle = new Lifecycle(this)` with private state and watches directly in Store:

```typescript
readonly #lifecycle = (() => {
    watch(this.event.mounted, () => {
        for (const f of Object.values(this.features)) f.enable()
    })
    watch(this.event.unmounted, () => {
        for (const f of Object.values(this.features)) f.disable()
    })
})()
```

No guards needed — `mounted` and `unmounted` each fire exactly once per lifecycle cycle.

### 3. Update framework integrations

**React** (`MarkedInput.tsx`): emit `store.event.mounted()` in `useLayoutEffect` (mount phase), keep `updated()` for all renders, keep `unmounted()` in cleanup.

**Vue** (`MarkedInput.vue`): emit `store.value.event.mounted()` in `onMounted`, keep `updated()` in `onUpdated`, keep `unmounted()` in `onUnmounted`.

### 4. Delete Lifecycle feature folder

Remove entirely:

- `packages/core/src/features/lifecycle/Lifecycle.ts`
- `packages/core/src/features/lifecycle/Lifecycle.spec.ts`
- `packages/core/src/features/lifecycle/index.ts`

### 5. Delete Lifecycle tests

The 12 test cases in `Lifecycle.spec.ts` are deleted. The enable/disable behavior will be verified through existing component/integration tests.

### 6. Update documentation

- `packages/website/src/content/docs/development/architecture.md` — remove Lifecycle section, update lifecycle timing diagram
- `AGENTS.md` / `CLAUDE.md` — remove Lifecycle references

## What doesn't change

- Feature `enable()`/`disable()` contracts remain identical
- `store.event.updated` continues to exist for re-render handling (parse sync, etc.)
- `store.event.unmounted` continues to exist
- No new public API on Store beyond the new `mounted` event

## Files affected

| File                                                            | Change                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/core/src/features/store/Store.ts`                     | Remove Lifecycle import, inline watches, add `mounted` event |
| `packages/core/src/features/lifecycle/*`                        | Delete entire folder                                         |
| `packages/react/markput/src/components/MarkedInput.tsx`         | Emit `mounted()` on mount                                    |
| `packages/vue/markput/src/components/MarkedInput.vue`           | Emit `mounted()` in `onMounted`                              |
| `packages/website/src/content/docs/development/architecture.md` | Update lifecycle section                                     |
| `AGENTS.md`                                                     | Remove Lifecycle references                                  |
