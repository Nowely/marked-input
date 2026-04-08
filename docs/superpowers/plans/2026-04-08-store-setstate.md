# store.setState() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `store.setState(partial)` to `Store` so framework components can batch-update state with a single call instead of manually wrapping signal setters in `startBatch`/`endBatch`.

**Architecture:** A `SignalValues<T>` mapped type is added to `shared/signals` to derive plain-value types from a signals object. `Store` gets a `setState` method that iterates the provided partial and calls each signal's `.set()` inside a batch. React and Vue components replace their manual batching blocks with `store.setState({...})`.

**Tech Stack:** TypeScript, alien-signals (`startBatch`/`endBatch`), Vitest

---

### Task 1: Export `SignalValues<T>` type from `shared/signals`

**Files:**
- Modify: `packages/core/src/shared/signals/index.ts`

- [ ] **Step 1: Add `SignalValues<T>` export to `index.ts`**

Open `packages/core/src/shared/signals/index.ts`. Add one line at the end:

```ts
export {setUseHookFactory, getUseHookFactory} from './registry'
export type {UseHookFactory} from './registry'
export {signal, effect, voidEvent, payloadEvent, watch} from './signal'
export type {Signal, VoidEvent, PayloadEvent} from './signal'
export {effectScope, setActiveSub, startBatch, endBatch} from './alien-signals'
export type {SignalValues} from './signal'
```

Then add the type to `packages/core/src/shared/signals/signal.ts` just after the `Signal<T>` interface (after line 21):

```ts
/**
 * Derives a plain-value object type from an object of signals.
 * `{ foo: Signal<string>, bar: Signal<number> }` → `{ foo: string, bar: number }`
 */
export type SignalValues<T> = {
    [K in keyof T]: T[K] extends Signal<infer V> ? V : never
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm --filter @markput/core run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/index.ts
git commit -m "feat(core): add SignalValues<T> utility type to shared/signals"
```

---

### Task 2: Add `store.setState()` method with tests

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`
- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `packages/core/src/features/store/Store.spec.ts`. Add a `describe('setState', ...)` block inside the top-level `describe('Store', ...)`:

```ts
describe('setState', () => {
    it('should update provided state values', () => {
        const store = new Store({defaultSpan: null})
        store.setState({value: 'hello', readOnly: true})
        expect(store.state.value.get()).toBe('hello')
        expect(store.state.readOnly.get()).toBe(true)
    })

    it('should leave unprovided keys unchanged', () => {
        const store = new Store({defaultSpan: null})
        store.setState({readOnly: true})
        expect(store.state.value.get()).toBeUndefined()
        expect(store.state.readOnly.get()).toBe(true)
    })

    it('should not throw when called with an empty object', () => {
        const store = new Store({defaultSpan: null})
        expect(() => store.setState({})).not.toThrow()
    })
})
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm --filter @markput/core exec vitest run src/features/store/Store.spec.ts
```

Expected: FAIL — `store.setState is not a function`

- [ ] **Step 3: Add `setState` to `Store`**

Open `packages/core/src/features/store/Store.ts`. The `startBatch`/`endBatch` imports need to be added. Change the signals import line (currently line 2):

```ts
import {signal, voidEvent, payloadEvent, startBatch, endBatch} from '../../shared/signals'
import type {SignalValues} from '../../shared/signals'
```

Then add `setState` as a method on the `Store` class, after `applyValue`:

```ts
setState(values: Partial<SignalValues<typeof this.state>>): void {
    startBatch()
    try {
        for (const k in values) {
            // oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous map: per-key signal types verified by SignalValues<T> at the call site
            this.state[k as keyof typeof this.state].set(values[k as keyof typeof values] as never)
        }
    } finally {
        endBatch()
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @markput/core exec vitest run src/features/store/Store.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/store/Store.spec.ts
git commit -m "feat(core): add store.setState() batch update method"
```

---

### Task 3: Update React `MarkedInput` to use `store.setState`

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`

- [ ] **Step 1: Replace the two manual batching blocks and update the import**

Open `packages/react/markput/src/components/MarkedInput.tsx`.

Change the `@markput/core` import (line 2) — remove `startBatch, endBatch`:

```ts
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
```

Replace the `useState` initializer block (currently lines 92–112):

```tsx
const [store] = useState(() => {
    const nextStore = new Store({defaultSpan: DefaultSpan})
    nextStore.setState({
        value: props.value,
        defaultValue: props.defaultValue,
        onChange: props.onChange,
        readOnly: props.readOnly ?? false,
        drag: props.drag ?? false,
        options: props.options ?? DEFAULT_OPTIONS,
        showOverlayOn: props.showOverlayOn ?? 'change',
        Span: props.Span,
        Mark: props.Mark,
        Overlay: props.Overlay,
        className,
        style,
        slots: props.slots,
        slotProps,
    })
    return nextStore
})
```

Replace the `useLayoutEffect` block (currently lines 114–132):

```tsx
useLayoutEffect(() => {
    store.setState({
        value: props.value,
        defaultValue: props.defaultValue,
        onChange: props.onChange,
        readOnly: props.readOnly ?? false,
        drag: props.drag ?? false,
        options: props.options ?? DEFAULT_OPTIONS,
        showOverlayOn: props.showOverlayOn ?? 'change',
        Span: props.Span,
        Mark: props.Mark,
        Overlay: props.Overlay,
        className,
        style,
        slots: props.slots,
        slotProps,
    })
})
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @markput/react run typecheck
```

Expected: the only error is the pre-existing `@vitejs/plugin-react` missing package (env issue unrelated to this change). No new type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/MarkedInput.tsx
git commit -m "refactor(react): use store.setState() for prop sync in MarkedInput"
```

---

### Task 4: Update Vue `MarkedInput` to use `store.setState`

**Files:**
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`

- [ ] **Step 1: Replace the manual batching block and update the import**

Open `packages/vue/markput/src/components/MarkedInput.vue`.

Change the `@markput/core` import (line 3) — remove `startBatch, endBatch`:

```ts
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
```

Replace the `syncProps` function body (currently lines 32–56):

```ts
function syncProps() {
    const className = cx(styles.Container, props.className, props.slotProps?.container?.className as string | undefined)
    const style = merge(
        props.style as StyleProperties | undefined,
        props.slotProps?.container?.style as StyleProperties | undefined
    )

    store.value.setState({
        value: props.value,
        defaultValue: props.defaultValue,
        onChange: (v: string) => emit('change', v),
        readOnly: props.readOnly,
        drag: props.drag,
        options: props.options,
        showOverlayOn: props.showOverlayOn,
        Span: props.Span,
        Mark: props.Mark,
        Overlay: props.Overlay,
        className,
        style: style as StyleProperties,
        slots: props.slots as CoreSlots,
        slotProps: props.slotProps as CoreSlotProps,
    })
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @markput/vue run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/MarkedInput.vue
git commit -m "refactor(vue): use store.setState() for prop sync in MarkedInput"
```

---

### Task 5: Run all checks

- [ ] **Step 1: Run core unit tests**

```bash
pnpm --filter @markput/core run test
```

Expected: all 373+ tests PASS.

- [ ] **Step 2: Run lint**

```bash
pnpm run lint
```

Expected: same 4 pre-existing errors (all in `@vitejs/plugin-react` calls in react/storybook vite configs). No new errors.

- [ ] **Step 3: Run format**

```bash
pnpm run format
```

Expected: `All matched files use the correct format.`  
If not: `pnpm run format:fix` then re-run to confirm.

- [ ] **Step 4: Run core typecheck**

```bash
pnpm --filter @markput/core run typecheck
```

Expected: no errors.
