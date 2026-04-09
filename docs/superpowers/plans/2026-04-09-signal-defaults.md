# Signal Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-time default fallback to signals so that signals created with a non-undefined initial value return that default when `.set(undefined)` is called. Simplify React/Vue framework layers to pass through props directly without `??` operators.

**Architecture:** When `signal(initial)` is called with `initial !== undefined`, the initial value becomes the default. On every read (`()`, `.get()`, `.use()`), if the stored value is `undefined`, the default is returned instead. Signals with `initial === undefined` have no default — zero overhead, behavior unchanged.

**Tech Stack:** TypeScript, alien-signals reactive system, Vitest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/core/src/shared/signals/signal.ts` | Add fallback logic to all 3 signal branches |
| Modify | `packages/core/src/features/store/Store.ts` | Update signal declarations with proper defaults |
| Modify | `packages/core/src/shared/signals/signals.spec.ts` | Add tests for default fallback behavior |
| Modify | `packages/core/src/features/store/Store.spec.ts` | Update tests for new default behavior |
| Modify | `packages/react/markput/src/components/MarkedInput.tsx` | Remove `??` operators from setState calls |
| Modify | `packages/vue/markput/src/components/MarkedInput.vue` | Remove `withDefaults`, remove `DEFAULT_OPTIONS` import |
| Modify | `packages/vue/markput/src/types.ts` | Keep prop types as-is (optional props stay optional) |

---

### Task 1: Add default fallback to signal function

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts`

- [ ] **Step 1: Add tests for default fallback behavior**

Add a new describe block to `packages/core/src/shared/signals/signals.spec.ts` inside the existing `signal<T>` describe, after the `.use()` tests (after line 151, before the closing `}`):

```ts
describe('default fallback', () => {
    it('should return initial value as default when set to undefined', () => {
        const s = signal<OverlayTrigger>('change')
        expect(s()).toBe('change')
        s.set(undefined)
        expect(s()).toBe('change')
        expect(s.get()).toBe('change')
    })

    it('should return the actual value when set to a non-undefined value', () => {
        const s = signal<OverlayTrigger>('change')
        s('focus')
        expect(s()).toBe('focus')
    })

    it('should NOT apply fallback when initial value is undefined', () => {
        const s = signal<string | undefined>(undefined)
        expect(s()).toBeUndefined()
        s('hello')
        expect(s()).toBe('hello')
        s.set(undefined)
        expect(s()).toBeUndefined()
    })

    it('should work with .use() returning default', () => {
        const mockHook = vi.fn(() => 'hook-result')
        const factory: UseHookFactory = vi.fn(() => mockHook)
        setUseHookFactory(factory)

        const s = signal<boolean>(false)
        s.set(undefined)
        const result = s.use()
        expect(result).toBe(false)
    })

    it('should work with equals: false and default fallback', () => {
        const s = signal<boolean>(false, {equals: false})
        expect(s()).toBe(false)
        s.set(undefined)
        expect(s()).toBe(false)
        s.set(true)
        expect(s()).toBe(true)
    })

    it('should work with custom equals and default fallback', () => {
        const s = signal({id: 1, name: 'a'}, {equals: (a, b) => a.id === b.id})
        s.set(undefined)
        expect(s()).toEqual({id: 1, name: 'a'})
    })

    it('should notify subscribers when reverting from value to default', () => {
        const s = signal<boolean>(false)
        s.set(true)
        const runs = vi.fn()
        trackedEffect(() => {
            s()
            runs()
        })
        runs.mockClear()
        s.set(undefined)
        expect(runs).toHaveBeenCalledTimes(1)
        expect(s()).toBe(false)
    })

    it('should not notify when setting undefined and already at default', () => {
        const s = signal<boolean>(false)
        const runs = vi.fn()
        trackedEffect(() => {
            s()
            runs()
        })
        runs.mockClear()
        s.set(undefined)
        expect(runs).toHaveBeenCalledTimes(0)
    })

    it('should work with array defaults', () => {
        const s = signal<number[]>([1, 2, 3])
        s.set(undefined)
        expect(s()).toEqual([1, 2, 3])
        s.set([4, 5])
        expect(s()).toEqual([4, 5])
    })
})
```

Note: `OverlayTrigger` needs to be imported or use a string literal type. Use a simple string type instead:

```ts
// At the top of the test, no new imports needed — just use inline types:
const s = signal<string>('change')  // instead of OverlayTrigger
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts`
Expected: All new tests FAIL (fallback logic not yet implemented)

- [ ] **Step 3: Implement default fallback in signal.ts**

The key change: every signal branch checks `initial !== undefined` to determine if a default exists. On reads, if stored value is `undefined` and default exists, return default.

In `packages/core/src/shared/signals/signal.ts`, update the `signal` function. The change pattern is the same for all 3 branches:

1. After creating the `inner` signal, capture the default:
```ts
const hasDefault = initial !== undefined
const _default = initial
```

2. Create a helper for reads:
```ts
const read = (): T => {
    const raw = inner()
    return hasDefault && raw === undefined ? _default as T : raw
}
```

3. Replace all `return inner()` / `return inner().v` with `return read()` / similar.

**Branch 1: `equals: false` (always-fire, boxed values)**

Current (lines 42-60):
```ts
const inner = alienSignal<{v: T; seq: number}>({v: initial, seq: seq++})
const callable = function signalCallable(...args: [T] | []) {
    if (args.length) {
        inner({v: args[0], seq: seq++})
    } else {
        return inner().v
    }
} as unknown as Signal<T>
callable.get = () => inner().v
```

Replace with:
```ts
const hasDefault = initial !== undefined
const _default = initial
const inner = alienSignal<{v: T; seq: number} | undefined>(undefined)
const read = (): T => {
    const box = inner()
    if (box === undefined) return _default as T
    return box.v
}
// oxlint-disable-next-line no-unsafe-type-assertion
const callable = function signalCallable(...args: [T | undefined] | []) {
    if (args.length) {
        inner({v: args[0] as T, seq: seq++})
    } else {
        return read()
    }
} as unknown as Signal<T>
callable.get = () => read()
callable.set = (v: T | undefined) => inner({v: v as T, seq: seq++})
```

**Branch 2: Custom equals function**

Current (lines 63-87):
```ts
const inner = alienSignal<T>(initial)
const callable = function signalCallable(...args: [T] | []) {
    if (args.length) {
        if (!equalsFn(inner(), args[0])) { inner(args[0]) }
    } else {
        return inner()
    }
} as unknown as Signal<T>
callable.get = () => inner()
```

Replace with:
```ts
const hasDefault = initial !== undefined
const _default = initial
const inner = alienSignal<T | undefined>(undefined)
const read = (): T => hasDefault && inner() === undefined ? _default as T : inner() as T
const equalsFn = equalsOpt
// oxlint-disable-next-line no-unsafe-type-assertion
const callable = function signalCallable(...args: [T | undefined] | []) {
    if (args.length) {
        const newVal = args[0] as T
        if (!equalsFn(read(), newVal)) {
            inner(newVal)
        }
    } else {
        return read()
    }
} as unknown as Signal<T>
callable.get = () => read()
callable.set = (v: T | undefined) => {
    if (!equalsFn(read(), v as T)) {
        inner(v)
    }
}
```

**Branch 3: Default (no custom equals)**

Current (lines 90-106):
```ts
const inner = alienSignal<T>(initial)
const callable = function signalCallable(...args: [T] | []) {
    if (args.length) { inner(args[0]) } else { return inner() }
} as unknown as Signal<T>
callable.get = () => inner()
callable.set = (v: T) => inner(v)
```

Replace with:
```ts
const hasDefault = initial !== undefined
const _default = initial
const inner = alienSignal<T | undefined>(undefined)
const read = (): T => hasDefault && inner() === undefined ? _default as T : inner() as T
// oxlint-disable-next-line no-unsafe-type-assertion
const callable = function signalCallable(...args: [T | undefined] | []) {
    if (args.length) { inner(args[0]) } else { return read() }
} as unknown as Signal<T>
callable.get = () => read()
callable.set = (v: T | undefined) => inner(v)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts`
Expected: ALL tests PASS (both new and existing)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/signals.spec.ts
git commit -m "feat(core): add read-time default fallback to signals"
```

---

### Task 2: Update Store.state signal declarations

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Update signal declarations in Store.ts**

In `packages/core/src/features/store/Store.ts`, make these changes:

1. Add import for `DEFAULT_OPTIONS`:
```ts
import {DEFAULT_OPTIONS} from '../../shared/constants'
```

2. Update the `state` object (lines 57-93). Change these signals:

```ts
// Before:
showOverlayOn: signal<OverlayTrigger | undefined>(undefined),
options: signal<CoreOption[] | undefined>(undefined),
readOnly: signal<boolean>(false),
drag: signal<boolean | {alwaysShowHandle: boolean}>(false),
tokens: signal<Token[]>([]),

// After:
showOverlayOn: signal<OverlayTrigger>('change'),
options: signal<CoreOption[]>(DEFAULT_OPTIONS),
readOnly: signal<boolean>(false),
drag: signal<boolean | {alwaysShowHandle: boolean}>(false),
tokens: signal<Token[]>([]),
```

Note: `readOnly`, `drag`, and `tokens` already have non-undefined initial values — they automatically gain fallback behavior without changing their declarations. Only `showOverlayOn` and `options` need explicit changes.

3. Remove the `OverlayTrigger` type from the `state` type assertions if needed — `signal<OverlayTrigger>('change')` should infer correctly.

- [ ] **Step 2: Update Store tests**

In `packages/core/src/features/store/Store.spec.ts`:

1. Add a test for default fallback on `showOverlayOn`:
```ts
it('should return default for showOverlayOn when not set', () => {
    const store = new Store({defaultSpan: null})
    expect(store.state.showOverlayOn.get()).toBe('change')
})

it('should return default for options when not set', () => {
    const store = new Store({defaultSpan: null})
    expect(store.state.options.get()).toEqual(DEFAULT_OPTIONS)
})
```

2. Add import at top:
```ts
import {DEFAULT_OPTIONS} from '../../shared/constants'
```

3. Update the "should leave unprovided keys unchanged" test — `value` still returns `undefined` (no default), so that assertion stays correct.

- [ ] **Step 3: Run Store tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/store/Store.spec.ts
git commit -m "feat(core): update store signal declarations with defaults"
```

---

### Task 3: Simplify React framework layer

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`

- [ ] **Step 1: Remove `??` operators and `DEFAULT_OPTIONS` import**

In `packages/react/markput/src/components/MarkedInput.tsx`:

1. Remove `DEFAULT_OPTIONS` from the import on line 2:
```ts
// Before:
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
// After:
import {cx, merge, Store} from '@markput/core'
```

2. Update both `setState` calls (lines 94-109 and 114-129) to remove `??` operators:
```ts
store.setState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    readOnly: props.readOnly,
    drag: props.drag,
    options: props.options,
    showOverlayOn: props.showOverlayOn,
    Span: props.Span,
    Mark: props.Mark,
    Overlay: props.Overlay,
    className,
    style,
    slots: props.slots,
    slotProps,
})
```

- [ ] **Step 2: Run React build and tests**

Run: `pnpm run build && pnpm test`
Expected: All tests PASS, build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/MarkedInput.tsx
git commit -m "refactor(react): simplify setState by removing manual defaults"
```

---

### Task 4: Simplify Vue framework layer

**Files:**
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`

- [ ] **Step 1: Remove `withDefaults` and `DEFAULT_OPTIONS` import**

In `packages/vue/markput/src/components/MarkedInput.vue`:

1. Remove `DEFAULT_OPTIONS` from import (line 3):
```ts
// Before:
import {cx, DEFAULT_OPTIONS, merge, Store} from '@markput/core'
// After:
import {cx, merge, Store} from '@markput/core'
```

2. Replace `withDefaults` (line 17-22) with plain `defineProps`:
```ts
// Before:
const props = withDefaults(defineProps<MarkedInputProps>(), {
    options: () => DEFAULT_OPTIONS,
    showOverlayOn: 'change',
    readOnly: false,
    drag: false,
})

// After:
const props = defineProps<MarkedInputProps>()
```

The `syncProps` function already passes props through without `??` — no changes needed there. Vue will pass `undefined` for unset props, which is exactly what we want (signals revert to defaults).

- [ ] **Step 2: Run Vue build and tests**

Run: `pnpm run build && pnpm test`
Expected: All tests PASS, build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/MarkedInput.vue
git commit -m "refactor(vue): simplify by removing withDefaults and manual defaults"
```

---

### Task 5: Run full validation

- [ ] **Step 1: Run all checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass with zero errors.

- [ ] **Step 2: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: format and lint fixes"
```
