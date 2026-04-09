# Event Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `voidEvent()` and `payloadEvent<T>()` with a single `event<T = void>()` primitive that has an explicit `.emit()` method and no `getActiveSub()` context sniffing.

**Architecture:** A unified `event<T = void>()` factory in `signal.ts` that internally uses the same box trick as `payloadEvent` (ensures every emit fires even for same reference). Calling `e()` always reads/subscribes; calling `e.emit(payload)` always emits. The `watch()` helper and all reactive patterns are unchanged.

**Tech Stack:** TypeScript, alien-signals (reactive primitives), Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-event-primitive-design.md`

---

## File Map

| File                                                                 | Change                                                                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/shared/signals/signal.ts`                         | Add `Event<T>` interface + `event<T>()` factory; delete `VoidEvent`, `PayloadEvent`, `voidEvent`, `payloadEvent` |
| `packages/core/src/shared/signals/signals.spec.ts`                   | Replace `voidEvent`/`payloadEvent` test blocks with `event<T>()` block; update `watch()` tests                   |
| `packages/core/src/shared/signals/index.ts`                          | Swap exports                                                                                                     |
| `packages/core/src/shared/classes/index.ts`                          | Swap exports                                                                                                     |
| `packages/core/index.ts`                                             | Swap public exports                                                                                              |
| `packages/core/src/features/store/Store.ts`                          | `voidEvent()` → `event()`, `payloadEvent<T>()` → `event<T>()`                                                    |
| `packages/core/src/features/store/Store.spec.ts`                     | Update test description string                                                                                   |
| `packages/core/src/features/mark/MarkHandler.ts`                     | `events.change()` → `events.change.emit()`, `events.delete(...)` → `events.delete.emit(...)`                     |
| `packages/core/src/features/input/KeyDownController.ts`              | `events.change()` → `events.change.emit()`                                                                       |
| `packages/core/src/features/overlay/OverlayController.ts`            | `events.clearOverlay()` → `events.clearOverlay.emit()`, `events.checkOverlay()` → `events.checkOverlay.emit()`   |
| `packages/core/src/features/events/SystemListenerController.ts`      | `events.parse()` → `events.parse.emit()`                                                                         |
| `packages/core/src/features/lifecycle/Lifecycle.ts`                  | `events.parse()` → `events.parse.emit()`                                                                         |
| `packages/vue/markput/src/lib/hooks/useOverlay.ts`                   | `events.clearOverlay()` → `events.clearOverlay.emit()`, `events.select(...)` → `events.select.emit(...)`         |
| `packages/core/src/features/events/SystemListenerController.spec.ts` | All `store.events.X()` emit calls → `store.events.X.emit()`                                                      |
| `packages/core/src/features/overlay/OverlayController.spec.ts`       | All emit calls → `.emit()`                                                                                       |
| `packages/core/src/features/lifecycle/Lifecycle.spec.ts`             | All emit calls → `.emit()`                                                                                       |

---

## Task 1: Add `event<T>()` — failing tests first

**Files:**

- Modify: `packages/core/src/shared/signals/signals.spec.ts`

- [ ] **Step 1: Add failing `event<T>()` describe block to signals.spec.ts**

Add this block after the existing `payloadEvent<T>()` describe block (around line 298), before the `watch()` describe:

```ts
// ---------------------------------------------------------------------------
// event<T>()
// ---------------------------------------------------------------------------

describe('event<T>()', () => {
    beforeEach(() => vi.clearAllMocks())

    it('should return undefined before first emit', () => {
        const ev = event<string>()
        expect(ev()).toBeUndefined()
    })

    it('should return void event undefined before first emit', () => {
        const ev = event()
        expect(ev()).toBeUndefined()
    })

    it('should auto-track inside effect and re-run when emitted', () => {
        const ev = event<number>()
        const runs = vi.fn()

        trackedEffect(() => {
            ev()
            runs()
        })

        expect(runs).toHaveBeenCalledTimes(1)
        ev.emit(42)
        expect(runs).toHaveBeenCalledTimes(2)
    })

    it('should re-run effect when void event is emitted', () => {
        const ev = event()
        const runs = vi.fn()

        trackedEffect(() => {
            ev()
            runs()
        })

        expect(runs).toHaveBeenCalledTimes(1)
        ev.emit()
        expect(runs).toHaveBeenCalledTimes(2)
    })

    it('should return latest payload from read', () => {
        const ev = event<number>()
        let captured: number | undefined

        trackedEffect(() => {
            captured = ev()
        })

        expect(captured).toBeUndefined()
        ev.emit(42)
        expect(captured).toBe(42)
    })

    it('should fire subscribers even when emitting same payload reference', () => {
        const ev = event<{id: number}>()
        const payload = {id: 1}
        const runs = vi.fn()

        trackedEffect(() => {
            ev()
            runs()
        })

        expect(runs).toHaveBeenCalledTimes(1)
        ev.emit(payload)
        expect(runs).toHaveBeenCalledTimes(2)
        ev.emit(payload) // same reference
        expect(runs).toHaveBeenCalledTimes(3)
    })

    it('should allow multiple effects to subscribe independently', () => {
        const ev = event()
        const runsA = vi.fn()
        const runsB = vi.fn()

        trackedEffect(() => {
            ev()
            runsA()
        })
        trackedEffect(() => {
            ev()
            runsB()
        })

        expect(runsA).toHaveBeenCalledTimes(1)
        expect(runsB).toHaveBeenCalledTimes(1)

        ev.emit()
        expect(runsA).toHaveBeenCalledTimes(2)
        expect(runsB).toHaveBeenCalledTimes(2)
    })

    it('should not cause infinite loop when e() called inside effect', () => {
        const ev = event()
        let count = 0

        trackedEffect(() => {
            ev()
            count++
        })

        expect(count).toBe(1)
    })

    it('.use() should call the registered factory', () => {
        const mockHook = vi.fn(() => 'event-hook')
        const factory: UseHookFactory = vi.fn(() => mockHook)
        setUseHookFactory(factory)

        const ev = event<number>()
        const result = ev.use()

        expect(factory).toHaveBeenCalledWith(ev)
        expect(mockHook).toHaveBeenCalled()
        expect(result).toBe('event-hook')
    })
})
```

Also update the import on line 6 to include `event`:

```ts
import {signal, voidEvent, payloadEvent, watch, event} from './signal'
```

- [ ] **Step 2: Run tests to verify new block fails**

```bash
cd packages/core && npx vitest run src/shared/signals/signals.spec.ts
```

Expected: failures on all `event<T>()` tests — `event is not a function` or similar. Existing tests still pass.

---

## Task 2: Implement `event<T>()` in signal.ts

**Files:**

- Modify: `packages/core/src/shared/signals/signal.ts`

- [ ] **Step 1: Add `Event<T>` interface and `event<T>()` factory**

Insert after the closing `}` of `payloadEvent<T>()` (after line 179), before the `watch()` section:

```ts
// ---------------------------------------------------------------------------
// Event<T> — unified reactive event primitive
// ---------------------------------------------------------------------------

export interface Event<T = void> {
    /** Read/subscribe — auto-tracks inside effects. Returns latest payload or undefined. */
    (): T | undefined
    /** Emit — always fires even when payload reference is unchanged. */
    emit(payload: T): void
    /** Framework hook bridge. */
    use(): T | undefined
}

export function event<T = void>(): Event<T> {
    let seq = 0
    const inner = alienSignal<{v: T; id: number} | undefined>(undefined)

    // oxlint-disable-next-line no-unsafe-type-assertion -- callable matches Event<T> interface but TS can't verify the call signature
    const callable = function eventCallable() {
        const box = inner()
        return box !== undefined ? box.v : undefined
    } as unknown as Event<T>

    callable.emit = (payload: T) => inner({v: payload, id: ++seq})
    // oxlint-disable-next-line no-unsafe-type-assertion -- getUseHookFactory returns () => unknown; cast to T | undefined is safe by Event<T> contract
    callable.use = () => getUseHookFactory()(callable)() as T | undefined

    return callable
}
```

- [ ] **Step 2: Run tests to verify new block passes**

```bash
cd packages/core && npx vitest run src/shared/signals/signals.spec.ts
```

Expected: all `event<T>()` tests pass. All other tests still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/signals.spec.ts
git commit -m "feat(core): add event<T>() unified reactive event primitive"
```

---

## Task 3: Remove old primitives from signal.ts and update exports

**Files:**

- Modify: `packages/core/src/shared/signals/signal.ts`
- Modify: `packages/core/src/shared/signals/index.ts`
- Modify: `packages/core/src/shared/classes/index.ts`
- Modify: `packages/core/index.ts`

- [ ] **Step 1: Delete `VoidEvent`, `voidEvent`, `PayloadEvent`, `payloadEvent` from signal.ts**

Remove lines 117–179 (the two old sections and their interfaces). The file should go from the `Signal<T>` section directly to the new `Event<T>` section, then `watch()`, then `batch()`.

Also remove the `getActiveSub` import on line 4 if it is now unused (check — `watch()` uses `setActiveSub` but not `getActiveSub`):

```ts
import {signal as alienSignal, effect as alienEffect, setActiveSub, startBatch, endBatch} from './alien-signals'
```

- [ ] **Step 2: Update signals/index.ts**

Replace the current line 3–4:

```ts
export {signal, effect, event, watch, batch} from './signal'
export type {Signal, Event, SignalValues} from './signal'
```

- [ ] **Step 3: Update shared/classes/index.ts**

Replace line 6–7:

```ts
export {setUseHookFactory, getUseHookFactory, effect, event, signal, watch, batch} from '../signals'
export type {Signal, Event, UseHookFactory} from '../signals'
```

- [ ] **Step 4: Update packages/core/index.ts**

Replace lines 20–30:

```ts
// Reactive system
export type {Signal, Event, UseHookFactory} from './src/shared/signals'
export {setUseHookFactory, getUseHookFactory, effect, event, signal, watch, batch} from './src/shared/signals'
```

- [ ] **Step 5: Update import in signals.spec.ts**

Replace line 6 to remove `voidEvent` and `payloadEvent`:

```ts
import {signal, watch, event} from './signal'
```

- [ ] **Step 6: Run typecheck to verify no missing exports**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: TypeScript errors pointing to all remaining usages of `voidEvent`, `payloadEvent`, `VoidEvent`, `PayloadEvent` in other files — these are the call sites to fix in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts packages/core/src/shared/signals/signals.spec.ts packages/core/src/shared/signals/index.ts packages/core/src/shared/classes/index.ts packages/core/index.ts
git commit -m "refactor(core): remove voidEvent and payloadEvent, export event<T>"
```

---

## Task 4: Remove old `voidEvent`/`payloadEvent` test blocks from signals.spec.ts

**Files:**

- Modify: `packages/core/src/shared/signals/signals.spec.ts`

- [ ] **Step 1: Delete the `voidEvent()` describe block (lines 155–216)**

Remove this entire block:

```ts
// ---------------------------------------------------------------------------
// voidEvent()
// ---------------------------------------------------------------------------

describe('voidEvent()', () => {
    ...
})
```

- [ ] **Step 2: Delete the `payloadEvent<T>()` describe block (lines 219–298)**

Remove this entire block:

```ts
// ---------------------------------------------------------------------------
// payloadEvent<T>()
// ---------------------------------------------------------------------------

describe('payloadEvent<T>()', () => {
    ...
})
```

- [ ] **Step 3: Update the `watch()` tests that used `voidEvent`/`payloadEvent`**

In the `watch()` describe block, two tests use the old primitives. Replace them:

Test at line ~361 "should allow callbacks to emit void events":

```ts
it('should allow callbacks to emit void events', () => {
    const source = event()
    const emitted = event()
    const runs = vi.fn()

    trackedEffect(() => {
        emitted()
        runs()
    })

    const dispose = watch(
        () => source(),
        () => {
            emitted.emit()
        }
    )
    disposers.push(dispose)

    expect(runs).toHaveBeenCalledTimes(1)
    source.emit()
    expect(runs).toHaveBeenCalledTimes(2)
})
```

Test at line ~384 "should not replay stale payloads on unrelated reactive changes":

```ts
it('should not replay stale payloads on unrelated reactive changes', () => {
    const source = event<number>()
    const extra = signal(0)
    const seen: number[] = []

    const dispose = watch(
        () => source(),
        () => {
            const latest = source()
            if (latest !== undefined) {
                seen.push(latest)
            }
            extra()
        }
    )
    disposers.push(dispose)

    source.emit(1)
    expect(seen).toEqual([1])

    extra(1)
    expect(seen).toEqual([1])

    source.emit(2)
    expect(seen).toEqual([1, 2])
})
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
cd packages/core && npx vitest run src/shared/signals/signals.spec.ts
```

Expected: all tests pass, no references to `voidEvent` or `payloadEvent`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shared/signals/signals.spec.ts
git commit -m "test(core): replace voidEvent/payloadEvent tests with event<T> tests"
```

---

## Task 5: Migrate Store.ts and its test

**Files:**

- Modify: `packages/core/src/features/store/Store.ts`
- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Update import in Store.ts**

Replace line 2:

```ts
import {signal, event, batch} from '../../shared/signals'
import type {SignalValues} from '../../shared/signals'
```

- [ ] **Step 2: Update event declarations in Store.ts**

Replace lines 103–110:

```ts
readonly events = {
    change: event(),
    parse: event(),
    delete: event<{token: Token}>(),
    select: event<{mark: Token; match: OverlayMatch}>(),
    clearOverlay: event(),
    checkOverlay: event(),
}
```

- [ ] **Step 3: Update Store.spec.ts test description**

Replace line 17:

```ts
it('should have events', () => {
```

- [ ] **Step 4: Run Store tests**

```bash
cd packages/core && npx vitest run src/features/store/Store.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/store/Store.spec.ts
git commit -m "refactor(core): migrate Store events to event<T> primitive"
```

---

## Task 6: Migrate emit sites in MarkHandler and KeyDownController

**Files:**

- Modify: `packages/core/src/features/mark/MarkHandler.ts`
- Modify: `packages/core/src/features/input/KeyDownController.ts`

- [ ] **Step 1: Update MarkHandler.ts**

Line 85 — `remove`:

```ts
remove = () => this.#store.events.delete.emit({token: this.#token})
```

Line 88 — `#emitChange`:

```ts
#emitChange(): void {
    this.#store.events.change.emit()
}
```

- [ ] **Step 2: Update KeyDownController.ts**

There are 3 emit sites (lines 120, 127, 466). Replace each:

```ts
this.store.events.change.emit()
```

And line 466:

```ts
store.events.change.emit()
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: no errors in these two files.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/mark/MarkHandler.ts packages/core/src/features/input/KeyDownController.ts
git commit -m "refactor(core): migrate MarkHandler and KeyDownController emit calls"
```

---

## Task 7: Migrate emit sites in OverlayController, SystemListenerController, Lifecycle

**Files:**

- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/events/SystemListenerController.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`

- [ ] **Step 1: Update OverlayController.ts emit sites**

Line 50 (inside watch callback):

```ts
this.store.events.checkOverlay.emit()
```

Line 62 (inside method body):

```ts
this.store.events.checkOverlay.emit()
```

Line 87 (inside `enableClose` handler):

```ts
this.store.events.clearOverlay.emit()
```

Line 95 (inside `enableClose` handler):

```ts
this.store.events.clearOverlay.emit()
```

Note: lines 27, 34, 43 are **dep functions** inside `watch(() => ...)` — these call `e()` to subscribe and must **not** change.

- [ ] **Step 2: Update SystemListenerController.ts emit sites**

Line 43 (inside watch callback for `change`):

```ts
this.store.events.parse.emit()
```

Line 113 (inside watch callback for `select`):

```ts
this.store.events.parse.emit()
```

Note: lines 16, 48, 64 are **dep functions** — must **not** change.  
Lines 50, 66 are **payload reads** inside callbacks — must **not** change.

- [ ] **Step 3: Update Lifecycle.ts emit sites**

Line 68 (inside `syncParser`):

```ts
store.events.parse.emit()
```

Note: line 95 is a dep function `() => store.events.parse()` — must **not** change.

- [ ] **Step 4: Run typecheck**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: no errors in these three files.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/overlay/OverlayController.ts packages/core/src/features/events/SystemListenerController.ts packages/core/src/features/lifecycle/Lifecycle.ts
git commit -m "refactor(core): migrate controller emit calls to event.emit()"
```

---

## Task 8: Migrate emit sites in Vue useOverlay

**Files:**

- Modify: `packages/vue/markput/src/lib/hooks/useOverlay.ts`

- [ ] **Step 1: Update useOverlay.ts emit sites**

Line 37:

```ts
const close = () => store.events.clearOverlay.emit()
```

Lines 42–43:

```ts
store.events.select.emit({mark, match})
store.events.clearOverlay.emit()
```

- [ ] **Step 2: Typecheck the vue package**

```bash
cd packages/vue/markput && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/lib/hooks/useOverlay.ts
git commit -m "refactor(vue): migrate useOverlay emit calls to event.emit()"
```

---

## Task 9: Update controller spec files

**Files:**

- Modify: `packages/core/src/features/events/SystemListenerController.spec.ts`
- Modify: `packages/core/src/features/overlay/OverlayController.spec.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`

- [ ] **Step 1: Update SystemListenerController.spec.ts**

Replace all bare emit calls (outside dep functions). There are 8 occurrences across the file:

```
store.events.change()   → store.events.change.emit()
store.events.delete({token})  → store.events.delete.emit({token})
store.events.delete({token: missingToken})  → store.events.delete.emit({token: missingToken})
store.events.select({mark, match})  → store.events.select.emit({mark, match})
```

All occurrences appear in test bodies (not inside reactive dep functions), so all need `.emit()`.

- [ ] **Step 2: Update OverlayController.spec.ts**

Open the file and replace all emit calls:

```
store.events.clearOverlay()   → store.events.clearOverlay.emit()
store.events.checkOverlay()   → store.events.checkOverlay.emit()
store.events.change()         → store.events.change.emit()
```

- [ ] **Step 3: Update Lifecycle.spec.ts**

Replace all emit calls:

```
store.events.parse()   → store.events.parse.emit()
```

- [ ] **Step 4: Run all core tests**

```bash
cd packages/core && npx vitest run
```

Expected: all tests pass, zero failures.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/events/SystemListenerController.spec.ts packages/core/src/features/overlay/OverlayController.spec.ts packages/core/src/features/lifecycle/Lifecycle.spec.ts
git commit -m "test(core): update controller specs to use event.emit()"
```

---

## Task 10: Final typecheck and full test run

- [ ] **Step 1: Typecheck all packages**

```bash
cd packages/core && npx tsc --noEmit
cd packages/vue/markput && npx tsc --noEmit
```

Expected: zero errors in both.

- [ ] **Step 2: Run all core tests**

```bash
cd packages/core && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Verify no remaining references to old API**

```bash
grep -r "voidEvent\|payloadEvent\|VoidEvent\|PayloadEvent" packages/ --include="*.ts"
```

Expected: no matches.

- [ ] **Step 4: Final commit if any cleanup needed, otherwise done**

```bash
git log --oneline -10
```

Confirm all tasks are committed cleanly.
