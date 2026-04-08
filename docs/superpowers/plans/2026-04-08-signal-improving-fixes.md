# signal-improving: Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four issues identified in code review of the `signal-improving` branch before merging to `next`.

**Architecture:** The branch replaces `Reactive`/`defineEvents`/`defineState` with a vendored alien-signals system. The fixes harden the abstraction layer (controllers should not import directly from alien-signals), fix a reactive tracking bug (double-subscription), correct a misleading test name, and bring documentation in sync with the new API.

**Tech Stack:** TypeScript, Vitest, alien-signals (vendored), pnpm monorepo

---

## Files Modified

| File                                                               | Change                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `packages/core/src/shared/signals/index.ts`                        | Re-export `effectScope` + `setActiveSub`                  |
| `packages/core/src/shared/signals/signal.ts`                       | Move `export {}` after imports                            |
| `packages/core/src/features/editable/ContentEditableController.ts` | Fix alien-signals direct import                           |
| `packages/core/src/features/events/SystemListenerController.ts`    | Fix alien-signals direct import + double-subscription bug |
| `packages/core/src/features/lifecycle/Lifecycle.ts`                | Fix alien-signals direct import                           |
| `packages/core/src/features/overlay/OverlayController.ts`          | Fix alien-signals direct import                           |
| `packages/core/src/features/selection/TextSelectionController.ts`  | Fix alien-signals direct import                           |
| `packages/core/src/shared/signals/signals.spec.ts`                 | Fix inverted test description                             |
| `packages/website/src/content/docs/development/architecture.md`    | Update to new signal API                                  |
| `AGENTS.md`                                                        | Remove stale Proxy auto-create language                   |

---

## Task 1: Re-export `effectScope` and `setActiveSub` from `signals/index.ts`

Controllers must not reach past the signals abstraction layer into `alien-signals/src/index.js` directly. The fix is to expose `effectScope` and `setActiveSub` from `packages/core/src/shared/signals/index.ts`.

**Files:**

- Modify: `packages/core/src/shared/signals/index.ts`
- Modify: `packages/core/src/shared/signals/signal.ts`

- [ ] **Step 1: Add re-exports to `signals/index.ts`**

Replace the entire file content:

```typescript
export {setUseHookFactory, getUseHookFactory} from './registry.js'
export type {UseHookFactory} from './registry.js'
export {signal, effect, voidEvent, payloadEvent, watch} from './signal.js'
export type {Signal, VoidEvent, PayloadEvent} from './signal.js'
export {defineState} from './defineState.js'
export type {StateObject} from './defineState.js'
export {defineEvents} from './defineEvents.js'
export {effectScope, setActiveSub} from '../alien-signals/src/index.js'
```

- [ ] **Step 2: Fix export-before-import in `signal.ts`**

Current lines 1-4 of `packages/core/src/shared/signals/signal.ts`:

```typescript
import {signal as alienSignal, effect as alienEffect, getActiveSub} from '../alien-signals/src/index.js'

export {alienEffect as effect}
import {getUseHookFactory} from './registry.js'
```

Replace with (move export after all imports):

```typescript
import {signal as alienSignal, effect as alienEffect, getActiveSub} from '../alien-signals/src/index.js'
import {getUseHookFactory} from './registry.js'

export {alienEffect as effect}
```

- [ ] **Step 3: Verify tests still pass**

```bash
pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts
```

Expected: all tests PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/signals/index.ts packages/core/src/shared/signals/signal.ts
git commit -m "refactor(core): re-export effectScope and setActiveSub from signals abstraction layer"
```

---

## Task 2: Fix controller imports — stop reaching into alien-signals directly

All 5 controllers currently import from `../../shared/alien-signals/src/index.js`. They must import from `../../shared/signals` instead (or `../../shared/signals/signal.js` for `watch`).

**Files:**

- Modify: `packages/core/src/features/editable/ContentEditableController.ts`
- Modify: `packages/core/src/features/events/SystemListenerController.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/selection/TextSelectionController.ts`

- [ ] **Step 1: Fix `ContentEditableController.ts` line 1**

Current:

```typescript
import {effectScope, effect} from '../../shared/alien-signals/src/index.js'
```

Replace with:

```typescript
import {effectScope, effect} from '../../shared/signals/index.js'
```

- [ ] **Step 2: Fix `SystemListenerController.ts` lines 1-2**

Current:

```typescript
import {effectScope, setActiveSub} from '../../shared/alien-signals/src/index.js'
import {watch} from '../../shared/signals/signal.js'
```

Replace with:

```typescript
import {effectScope, setActiveSub, watch} from '../../shared/signals/index.js'
```

- [ ] **Step 3: Fix `Lifecycle.ts` line 1**

Current:

```typescript
import {effectScope} from '../../shared/alien-signals/src/index.js'
import {watch} from '../../shared/signals/signal.js'
```

Replace with:

```typescript
import {effectScope, watch} from '../../shared/signals/index.js'
```

- [ ] **Step 4: Fix `OverlayController.ts` lines 1 and 3**

Current:

```typescript
import {effectScope, setActiveSub} from '../../shared/alien-signals/src/index.js'
import {KEYBOARD} from '../../shared/constants'
import {watch} from '../../shared/signals/signal.js'
```

Replace with:

```typescript
import {effectScope, setActiveSub, watch} from '../../shared/signals/index.js'
import {KEYBOARD} from '../../shared/constants'
```

- [ ] **Step 5: Fix `TextSelectionController.ts` line 1**

Current:

```typescript
import {effectScope, effect} from '../../shared/alien-signals/src/index.js'
```

Replace with:

```typescript
import {effectScope, effect} from '../../shared/signals/index.js'
```

- [ ] **Step 6: Run tests and typecheck**

```bash
pnpm --filter @markput/core exec vitest run
pnpm run typecheck
```

Expected: all tests PASS, typecheck produces no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/editable/ContentEditableController.ts \
        packages/core/src/features/events/SystemListenerController.ts \
        packages/core/src/features/lifecycle/Lifecycle.ts \
        packages/core/src/features/overlay/OverlayController.ts \
        packages/core/src/features/selection/TextSelectionController.ts
git commit -m "refactor(core): import effectScope/setActiveSub/effect from signals layer, not alien-signals directly"
```

---

## Task 3: Fix double-subscription bug in `SystemListenerController`

Inside the `fn()` callback of `watch()`, calling the event again (e.g. `this.store.events.delete()`) while `activeSub` is still pointing to the running effect registers the event signal as a dependency for a second time. The `delete` and `select` handlers both have this pattern. The fix is to read the payload via `setActiveSub(undefined)` guard — the same pattern already used for `events.parse()` in the `change` handler.

**File:**

- Modify: `packages/core/src/features/events/SystemListenerController.ts`

- [ ] **Step 1: Fix the `delete` watch handler (line 54-69)**

Current:

```typescript
watch(
    () => this.store.events.delete(),
    () => {
        const payload = this.store.events.delete()
        if (!payload) return
        // ...
    }
)
```

Replace the `fn` callback so the second read is guarded:

```typescript
watch(
    () => this.store.events.delete(),
    () => {
        const prevSub = setActiveSub(undefined)
        let payload: ReturnType<typeof this.store.events.delete>
        try {
            payload = this.store.events.delete()
        } finally {
            setActiveSub(prevSub)
        }
        if (!payload) return

        const {token} = payload
        const onChange = this.store.state.onChange.get()

        const tokens = this.store.state.tokens.get()
        const index = tokens.indexOf(token)
        this.store.state.tokens.set(tokens.toSpliced(index, 1))

        onChange?.(toString(this.store.state.tokens.get()))
    }
)
```

- [ ] **Step 2: Fix the `select` watch handler (line 71-130)**

Current fn callback starts:

```typescript
;() => {
    const event = this.store.events.select()
    if (!event) return
    // ...
}
```

Replace the start of that callback so the second read is guarded:

```typescript
;() => {
    const prevSub = setActiveSub(undefined)
    let event: ReturnType<typeof this.store.events.select>
    try {
        event = this.store.events.select()
    } finally {
        setActiveSub(prevSub)
    }
    if (!event) return

    const Mark = this.store.state.Mark.get()
    // ... rest of body unchanged ...
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @markput/core exec vitest run packages/core/src/features/events/SystemListenerController.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/events/SystemListenerController.ts
git commit -m "fix(core): guard event re-reads in watch callbacks with setActiveSub(undefined) to prevent double-subscription"
```

---

## Task 4: Fix inverted test name in `signals.spec.ts`

The test at line 486 is titled `'getUseHookFactory should throw with a clear message if factory not set'` but the body asserts `not.toThrow()`. The name contradicts the assertion.

**File:**

- Modify: `packages/core/src/shared/signals/signals.spec.ts`

- [ ] **Step 1: Fix the test description**

Current (line 486):

```typescript
it('getUseHookFactory should throw with a clear message if factory not set', async () => {
    // We can't easily unset the factory in the same module scope,
    // but we can verify the error message format from the source.
    // Since setUseHookFactory was already called in earlier tests,
    // we verify it doesn't throw when set.
    expect(() => getUseHookFactory()).not.toThrow()
})
```

Replace with:

```typescript
it('getUseHookFactory should not throw once a factory has been set', async () => {
    // setUseHookFactory was called in earlier tests in this suite.
    // Verify it does not throw when a factory is already registered.
    expect(() => getUseHookFactory()).not.toThrow()
})
```

- [ ] **Step 2: Run the registry describe block to confirm it passes**

```bash
pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts
```

Expected: all tests PASS, test name updated in output.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/signals/signals.spec.ts
git commit -m "test(core): fix inverted test description in registry spec"
```

---

## Task 5: Update architecture documentation

`packages/website/src/content/docs/development/architecture.md` references three things that no longer exist:

1. `Emitter<T>` type with `.on()` subscription method
2. `createUseHook` injected at Store construction
3. Signal interface with `.on()` subscribe method

Also `AGENTS.md` line 80 says "do not manually create Signals — just access `store.state.newProp` and the Proxy auto-creates it". There is no Proxy; state keys are defined explicitly in the `defineState()` call.

**Files:**

- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the Event System section in `architecture.md`**

Find and replace the **Emitter Architecture** block (lines 213-221):

Current:

````markdown
### Emitter Architecture

Events use `defineEvents<T>()` which creates typed emitters:

```typescript
export type Emitter<T = void> = {
    (payload?: T): void
    on(fn: (value: T) => void): () => void // returns unsubscribe
}
```
````

````

Replace with:
```markdown
### Emitter Architecture

Events use `defineEvents()` which creates typed emitters using reactive signals:

- **`VoidEvent`** — callable with no arguments; subscribable via `watch(() => event(), fn)`
- **`PayloadEvent<T>`** — callable with a payload to emit, or with no arguments to read the last payload inside a reactive context
````

- [ ] **Step 2: Update the Event Usage block (lines 234-247)**

Current:

````markdown
### Event Usage

```typescript
// Emit an event
store.events.change()

// Subscribe to an event (returns unsubscribe function)
const unsubscribe = store.events.change.on(() => {
    console.log('Text changed')
})

// Clean up
unsubscribe()
```
````

````

Replace with:
```markdown
### Event Usage

```typescript
// Emit a void event
store.events.change()

// Emit a payload event
store.events.delete({ token })

// Subscribe inside an effectScope (cleanup is automatic when scope disposes)
import {watch, effectScope} from '@markput/core'

const dispose = effectScope(() => {
    watch(
        () => store.events.change(),
        () => {
            console.log('Text changed')
        }
    )
})

// Clean up all subscriptions in the scope
dispose()
````

````

- [ ] **Step 3: Update the Reactive Signals section (lines 251-267)**

Current Signal interface block:
```markdown
### Reactive Signals

State is managed through `defineState<T>()` which creates a `StateObject` — a Proxy where each property is a `Signal<T>`:

```typescript
export interface Signal<T> {
    get(): T              // Read value
    set(value: T): void   // Write value
    on(fn: (value: T) => void): () => void  // Subscribe
    use(): T              // Framework-specific hook (React/Vue)
}
````

The framework adapter injects `createUseHook` at Store construction:

- **React**: `use()` returns the value via `useState` + `useEffect(signal.on)`
- **Vue**: `use()` returns a `Ref<T>` backed by `shallowRef` + `signal.on()`

This is the **only framework coupling point**.

````

Replace with:
```markdown
### Reactive Signals

State is managed through `defineState()` with explicit initial keys. Each property is a `Signal<T>`:

```typescript
export interface Signal<T> {
    (): T                 // Read value (also tracks as reactive dependency)
    (value: T): void      // Write value
    get(): T              // Alias for read
    set(value: T): void   // Alias for write
    use(): T              // Framework-specific reactive hook (React/Vue)
}
````

The framework adapter calls `setUseHookFactory()` once at module load (in `createUseHook.ts`) to register a framework-specific subscriber:

- **React**: `use()` calls `useSyncExternalStore`; the subscribe function creates an `effect()` that tracks the signal and calls the store callback on change
- **Vue**: `use()` creates a `shallowRef`, drives it with `effect()`, and disposes on `onUnmounted`

This is the **only framework coupling point**.

```

- [ ] **Step 4: Update AGENTS.md — remove stale Proxy language**

Find this line in `AGENTS.md` (in the "Do NOT" section):
```

- Do not manually create Signals for new state — just access `store.state.newProp` and the Proxy auto-creates it

```

Replace with:
```

- Do not manually create Signals for new state — add new state keys to the initial object passed to `defineState()` in `Store.ts`

````

- [ ] **Step 5: Run typecheck and lint to ensure docs build is unaffected**

```bash
pnpm run typecheck
pnpm run lint
````

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/website/src/content/docs/development/architecture.md AGENTS.md
git commit -m "docs: update architecture.md and AGENTS.md to reflect new signal/event API"
```

---

## Final Verification

- [ ] **Run all CI checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: all five commands exit with no errors.
