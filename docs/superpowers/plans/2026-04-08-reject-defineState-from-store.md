# Reject `defineState` from Store — Replace with Direct Signal Declarations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `defineState` usage from `Store` (and `BlockStore`), replacing it with direct `signal()` declarations. Then simplify or remove the `defineState` utility entirely.

**Architecture:** Instead of a dynamic `defineState` call that builds signals from an object via `Object.create(null)` + `Object.defineProperty`, each consumer declares its signals as plain typed properties. The batched `.set()` pattern is replaced with explicit `startBatch`/`endBatch` calls at the few call sites that need it.

**Tech Stack:** TypeScript, alien-signals (existing reactive primitive)

---

## Current State

`defineState` is used in 2 places:

1. **`Store`** — 17 signal properties (`tokens`, `parser`, `value`, `style`, etc.), with custom `equals` on `style`
2. **`BlockStore`** — 5 signal properties (`isHovered`, `isDragging`, `dropPosition`, `menuOpen`, `menuPosition`)

The batched `state.set({...})` method is **never called in production code** — it only appears in tests (`defineState.spec.ts`, `signals.spec.ts`). All production code uses individual `state.key.set(v)` or `state.key(v)` calls.

## File Structure

| Action | File                                                   | Purpose                                                |
| ------ | ------------------------------------------------------ | ------------------------------------------------------ |
| Modify | `packages/core/src/features/store/Store.ts`            | Replace `defineState` with direct signals              |
| Modify | `packages/core/src/shared/classes/BlockStore.ts`       | Replace `defineState` with direct signals              |
| Modify | `packages/core/src/shared/signals/index.ts`            | Remove `defineState` and `StateObject` exports         |
| Modify | `packages/core/src/shared/classes/index.ts`            | Remove `defineState` and `StateObject` re-exports      |
| Modify | `packages/core/index.ts`                               | Remove `defineState` and `StateObject` from public API |
| Delete | `packages/core/src/shared/signals/defineState.ts`      | Remove the utility                                     |
| Delete | `packages/core/src/shared/signals/defineState.spec.ts` | Remove its tests                                       |
| Modify | `packages/core/src/shared/signals/signals.spec.ts`     | Remove `defineState()` describe block (lines 414-495)  |

---

### Task 1: Replace `defineState` in Store with direct signal declarations

**Files:**

- Modify: `packages/core/src/features/store/Store.ts`

**Context:** `StateObject<MarkputState>` gave a dynamic object where `state.tokens` returns `Signal<Token[]>`. After this change, `state` becomes a plain object with explicitly typed signal properties. Every `state.X.get()` / `state.X.set()` / `state.X.use()` call site remains unchanged — only the declaration changes.

- [ ] **Step 1: Replace the `defineState` call with direct signal declarations**

In `Store.ts`, change the import line:

```typescript
// FROM:
import {defineState, defineEvents, voidEvent, payloadEvent, type StateObject} from '../../shared/signals'
// TO:
import {signal, defineEvents, voidEvent, payloadEvent} from '../../shared/signals'
import type {Signal} from '../../shared/signals'
```

Replace the `state` declaration (lines 46 + 95-119). The `readonly state: StateObject<MarkputState>` type annotation becomes an inline typed object. The constructor body changes from `this.state = defineState<MarkputState>({...}, {equals: {style: shallow}})` to:

```typescript
readonly state: {
	tokens: Signal<Token[]>
	parser: Signal<Parser | undefined>
	previousValue: Signal<string | undefined>
	recovery: Signal<Recovery | undefined>
	selecting: Signal<'drag' | 'all' | undefined>
	overlayMatch: Signal<OverlayMatch | undefined>
	value: Signal<string | undefined>
	defaultValue: Signal<string | undefined>
	onChange: Signal<((value: string) => void) | undefined>
	readOnly: Signal<boolean>
	options: Signal<CoreOption[] | undefined>
	showOverlayOn: Signal<OverlayTrigger | undefined>
	Span: Signal<GenericComponent | undefined>
	Mark: Signal<GenericComponent | undefined>
	Overlay: Signal<GenericComponent | undefined>
	className: Signal<string | undefined>
	style: Signal<StyleProperties | undefined>
	slots: Signal<CoreSlots | undefined>
	slotProps: Signal<CoreSlotProps | undefined>
	drag: Signal<boolean | {alwaysShowHandle: boolean}>
}
```

Constructor body:

```typescript
this.state = {
    tokens: signal<Token[]>([]),
    parser: signal<Parser | undefined>(undefined),
    previousValue: signal<string | undefined>(undefined),
    recovery: signal<Recovery | undefined>(undefined),
    selecting: signal<'drag' | 'all' | undefined>(undefined),
    overlayMatch: signal<OverlayMatch | undefined>(undefined),
    value: signal<string | undefined>(undefined),
    defaultValue: signal<string | undefined>(undefined),
    onChange: signal<((value: string) => void) | undefined>(undefined),
    readOnly: signal<boolean>(false),
    options: signal<CoreOption[] | undefined>(undefined),
    showOverlayOn: signal<OverlayTrigger | undefined>(undefined),
    Span: signal<GenericComponent | undefined>(undefined),
    Mark: signal<GenericComponent | undefined>(undefined),
    Overlay: signal<GenericComponent | undefined>(undefined),
    className: signal<string | undefined>(undefined),
    style: signal<StyleProperties | undefined>(undefined, {equals: shallow}),
    slots: signal<CoreSlots | undefined>(undefined),
    slotProps: signal<CoreSlotProps | undefined>(undefined),
    drag: signal<boolean | {alwaysShowHandle: boolean}>(false),
}
```

Add the missing type imports at the top of `Store.ts` (check what's already imported — `Recovery`, `OverlayMatch`, `OverlayTrigger`, `GenericComponent`, `StyleProperties`, `CoreSlots`, `CoreSlotProps` come from `../../shared/types`):

```typescript
import type {
    CoreOption,
    MarkputHandler,
    MarkputState,
    OverlayMatch,
    OverlayTrigger,
    Recovery,
    GenericComponent,
    StyleProperties,
    CoreSlots,
    CoreSlotProps,
} from '../../shared/types'
```

Wait — the type inline in `state` needs to reference `Recovery`. Check that `Recovery` is imported. It was part of `MarkputState` but now needs to be imported explicitly. Same for `Parser`, `Token`, etc.

Import changes needed at the top of `Store.ts`:

```typescript
import type {
    Recovery,
    OverlayTrigger,
    GenericComponent,
    StyleProperties,
    CoreSlots,
    CoreSlotProps,
} from '../../shared/types'
```

- [ ] **Step 2: Run typecheck to verify**

Run: `pnpm run typecheck`
Expected: PASS (no type errors in Store.ts or any consumer)

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: PASS

---

### Task 2: Replace `defineState` in BlockStore with direct signal declarations

**Files:**

- Modify: `packages/core/src/shared/classes/BlockStore.ts`

- [ ] **Step 1: Replace the `defineState` call with direct signals**

Change imports:

```typescript
// FROM:
import {defineState, type StateObject} from '../signals'
// TO:
import {signal} from '../signals'
import type {Signal} from '../signals'
```

Replace the `state` declaration. Change:

```typescript
readonly state: StateObject<BlockState>
```

to:

```typescript
readonly state: {
	isHovered: Signal<boolean>
	isDragging: Signal<boolean>
	dropPosition: Signal<DropPosition>
	menuOpen: Signal<boolean>
	menuPosition: Signal<{top: number; left: number}>
}
```

Replace constructor body from `this.state = defineState<BlockState>({...})` to:

```typescript
this.state = {
    isHovered: signal(false),
    isDragging: signal(false),
    dropPosition: signal<DropPosition>(null),
    menuOpen: signal(false),
    menuPosition: signal<{top: number; left: number}>({top: 0, left: 0}),
}
```

Remove the `BlockState` interface if no other code references it (check first — it's only used locally). Keep it if you prefer, or inline.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run`
Expected: PASS

---

### Task 3: Remove `defineState` utility and clean up exports

**Files:**

- Delete: `packages/core/src/shared/signals/defineState.ts`
- Delete: `packages/core/src/shared/signals/defineState.spec.ts`
- Modify: `packages/core/src/shared/signals/index.ts`
- Modify: `packages/core/src/shared/classes/index.ts`
- Modify: `packages/core/index.ts`
- Modify: `packages/core/src/shared/signals/signals.spec.ts` (remove `defineState()` block, lines 414-495)

- [ ] **Step 1: Update `packages/core/src/shared/signals/index.ts`**

Remove these two lines:

```typescript
export {defineState} from './defineState'
export type {StateObject} from './defineState'
```

- [ ] **Step 2: Update `packages/core/src/shared/classes/index.ts`**

Remove `defineState` from the re-export block and `StateObject` from the type re-export:

```typescript
// Remove defineState from this block:
export {
    setUseHookFactory,
    getUseHookFactory,
    effect,
    voidEvent,
    payloadEvent,
    defineState, // <-- remove this line
    defineEvents,
    watch,
} from '../signals'
export type {Signal, VoidEvent, PayloadEvent, UseHookFactory, StateObject} from '../signals'
// Remove StateObject from this line
```

- [ ] **Step 3: Update `packages/core/index.ts`**

Remove `defineState` from the value export and `StateObject` from the type export:

```typescript
// FROM:
export type {Signal, VoidEvent, PayloadEvent, UseHookFactory, StateObject} from './src/shared/signals'
export {
    setUseHookFactory,
    getUseHookFactory,
    effect,
    voidEvent,
    payloadEvent,
    defineState,
    defineEvents,
    watch,
} from './src/shared/signals'

// TO:
export type {Signal, VoidEvent, PayloadEvent, UseHookFactory} from './src/shared/signals'
export {
    setUseHookFactory,
    getUseHookFactory,
    effect,
    voidEvent,
    payloadEvent,
    defineEvents,
    watch,
} from './src/shared/signals'
```

- [ ] **Step 4: Delete `defineState.ts` and `defineState.spec.ts`**

```bash
rm packages/core/src/shared/signals/defineState.ts
rm packages/core/src/shared/signals/defineState.spec.ts
```

- [ ] **Step 5: Remove the `defineState()` describe block from `signals.spec.ts`**

Remove lines 414-495 (the `describe('defineState()', ...)` block) and the preceding comment block separator from `packages/core/src/shared/signals/signals.spec.ts`.

Also remove the `defineState` import on line 5:

```typescript
// FROM:
import {defineState} from './defineState'
// Remove this line entirely
```

- [ ] **Step 6: Run full verification**

Run:

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm run lint
pnpm run format
```

Expected: All pass with no errors.

---

## Self-Review

### Spec coverage

- Store `defineState` removal → Task 1 ✓
- BlockStore `defineState` removal → Task 2 ✓
- `defineState` utility deletion → Task 3 ✓
- Export cleanup → Task 3 ✓
- Test cleanup → Task 3 ✓

### Placeholder scan

No TBD, TODO, or "implement later" patterns. All code is concrete.

### Type consistency

- `Signal<T>` type used consistently across both Store and BlockStore
- `state.key.get()` / `state.key.set()` / `state.key.use()` / `state.key()` call patterns are preserved — `Signal<T>` already provides these methods, so no consumer changes needed
- The `equals: shallow` on `style` is passed directly to `signal()` which accepts the same `SignalOptions` shape
- `BlockState` interface in `BlockStore.ts` — kept as-is (only the `StateObject<BlockState>` wrapper is removed)

### Note on `state.set()` batch method

The batched `state.set({...})` is only used in test files for `defineState` itself (which we're deleting). No production code uses it. If batch updates are needed in the future, use `startBatch()`/`endBatch()` from alien-signals directly at the call site.
