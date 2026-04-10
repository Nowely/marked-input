# Remove `.get()` / `.set()` from Signal & Computed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `.get()` and `.set()` from `Signal<T>` and `.get()` from `Computed<T>`, migrating all call sites to the callable form.

**Architecture:** The callable form `signal()` / `signal(value)` already exists and is functionally identical to `.get()` / `.set()`. We remove the methods from the interfaces and implementations, then mechanically replace all call sites.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Update signal interfaces and implementation

**Files:**
- Modify: `packages/core/src/shared/signals/signal.ts`

This is the foundation — after this change, TypeScript will flag every remaining `.get()` / `.set()` call as a type error.

- [ ] **Step 1: Remove `.get()` and `.set()` from `Signal<T>` interface**

In `signal.ts`, change the `Signal<T>` interface from:

```typescript
export interface Signal<T> {
	(): T
	(value: T | undefined): void
	get(): T
	set(value: T | undefined): void
	use(): T
}
```

to:

```typescript
export interface Signal<T> {
	(): T
	(value: T | undefined): void
	use(): T
}
```

- [ ] **Step 2: Remove `.get()` from `Computed<T>` interface**

Change the `Computed<T>` interface from:

```typescript
export interface Computed<T> {
	(): T
	get(): T
	use(): T
}
```

to:

```typescript
export interface Computed<T> {
	(): T
	use(): T
}
```

- [ ] **Step 3: Remove `.get` and `.set` assignments from the `signal()` factory**

In the **`equals: false` branch** (boxed value, ~lines 60-84), remove:

```typescript
callable.get = () => read()
callable.set = (v: T | undefined) => {
	if (v === undefined) {
		if (hasDefault && inner() === undefined) return
		inner(undefined)
	} else {
		inner({v, seq: seq++})
	}
}
```

In the **custom equals branch** (~lines 100-129), remove:

```typescript
callable.get = () => read()
callable.set = (v: T | undefined) => {
	if (v === undefined) {
		if (hasDefault && inner() === undefined) return
		inner(undefined)
	} else {
		if (!equalsFn(read(), v)) {
			inner(v)
		}
	}
}
```

In the **default branch** (~lines 144-177), remove:

```typescript
callable.get = () => read()
callable.set = (v: T | undefined) => {
	if (v === undefined && hasDefault) {
		if (inner() === undefined) return
		inner(undefined)
	} else {
		const current = inner()
		const effectiveCurrent = current === undefined && hasDefault ? _default : current
		if (effectiveCurrent !== v) {
			inner(v)
		}
	}
}
```

- [ ] **Step 4: Remove `.get` assignment from `computed()` factory**

In the `computed()` function (~line 198), remove:

```typescript
callable.get = () => inner()
```

- [ ] **Step 5: Run typecheck to confirm interface change is picked up**

Run: `pnpm run typecheck`
Expected: Type errors across all files that still use `.get()` / `.set()` — this is expected and confirms the interface change worked.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shared/signals/signal.ts
git commit -m "refactor(core): remove .get()/.set() from Signal and Computed interfaces"
```

---

### Task 2: Migrate signal test files

**Files:**
- Modify: `packages/core/src/shared/signals/signals.spec.ts`
- Modify: `packages/core/src/shared/signals/computed.spec.ts`

Migrate all `.get()` → `()` and `.set(v)` → `(v)` in the signal unit tests. These are self-contained and should pass independently.

- [ ] **Step 1: Migrate `signals.spec.ts`**

Replace all `s.get()` → `s()` and `s.set(value)` → `s(value)` throughout the file. Specific replacements:

| Line | Before | After |
|------|--------|-------|
| 46 | `expect(s.get()).toBe('hello')` | `expect(s()).toBe('hello')` |
| 51 | `s.set('world')` | `s('world')` |
| 52 | `expect(s.get()).toBe('world')` | `expect(s()).toBe('world')` |
| 157 | `s.set(undefined)` | `s(undefined)` |
| 159 | `expect(s.get()).toBe('change')` | `expect(s()).toBe('change')` |
| 173 | `s.set(undefined)` | `s(undefined)` |
| 188 | `s.set(undefined)` | `s(undefined)` |
| 196 | `s.set(undefined)` | `s(undefined)` |
| 198 | `s.set(true)` | `s(true)` |
| 204 | `s.set(undefined)` | `s(undefined)` |
| 210 | `s.set(true)` | `s(true)` |
| 217 | `s.set(undefined)` | `s(undefined)` |
| 230 | `s.set(undefined)` | `s(undefined)` |
| 236 | `s.set(undefined)` | `s(undefined)` |
| 238 | `s.set([4, 5])` | `s([4, 5])` |

- [ ] **Step 2: Migrate `computed.spec.ts`**

| Line | Before | After |
|------|--------|-------|
| 21 | `expect(doubled.get()).toBe(2)` | `expect(doubled()).toBe(2)` |
| 34 | `count.set(5)` | `count(5)` |
| 60 | `count.set(2)` | `count(2)` |
| 74 | `count.set(3)` | `count(3)` |
| 83 | `count.set(5)` | `count(5)` |
| 106 | `a.set(10)` | `a(10)` |
| 107 | `b.set(20)` | `b(20)` |

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/signals/signals.spec.ts packages/core/src/shared/signals/computed.spec.ts
git commit -m "refactor(core): migrate signal tests to callable form"
```

---

### Task 3: Migrate Store

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`
- Modify: `packages/core/src/features/store/Store.spec.ts`

- [ ] **Step 1: Migrate `Store.ts`**

Replace all `.get()` → `()` and `.set(v)` → `(v)`:

| Line | Before | After |
|------|--------|-------|
| 88 | `this.state.Mark.get()` | `this.state.Mark()` |
| 90 | `this.state.options.get().some(...)` | `this.state.options().some(...)` |
| 93 | `this.computed.hasMark.get()` | `this.computed.hasMark()` |
| 95 | `this.state.options.get().map(...)` | `this.state.options().map(...)` |
| 98 | `this.state.drag.get()` | `this.state.drag()` |
| 163 | `state[key].set(values[key] as never)` | `state[key](values[key] as never)` |

- [ ] **Step 2: Migrate `Store.spec.ts`**

Replace all 27 `.get()` → `()` and 16 `.set(v)` → `(v)` throughout the file. Every occurrence follows the same pattern: `store.state.X.get()` → `store.state.X()`, `store.computed.X.get()` → `store.computed.X()`, `store.state.X.set(v)` → `store.state.X(v)`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/store/Store.ts packages/core/src/features/store/Store.spec.ts
git commit -m "refactor(core): migrate Store to callable signal form"
```

---

### Task 4: Migrate Lifecycle

**Files:**
- Modify: `packages/core/src/features/lifecycle/Lifecycle.ts`
- Modify: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`

- [ ] **Step 1: Migrate `Lifecycle.ts`**

Replace all `.get()` → `()` and `.set(v)` → `(v)`:

| Line | Before | After |
|------|--------|-------|
| 28 | `this.store.state.value.get()` | `this.store.state.value()` |
| 29 | `this.store.computed.parser.get()` | `this.store.computed.parser()` |
| 33 | `this.store.state.recovery.get()` | `this.store.state.recovery()` |
| 57 | `store.state.overlayTrigger.set(...)` | `store.state.overlayTrigger(...)` |
| 70 | `this.store.state.overlayTrigger.set(undefined)` | `this.store.state.overlayTrigger(undefined)` |
| 76 | `store.state.value.get()` | `store.state.value()` |
| 76 | `store.state.defaultValue.get()` | `store.state.defaultValue()` |
| 77 | `store.state.tokens.set(...)` | `store.state.tokens(...)` |
| 78 | `store.state.previousValue.set(...)` | `store.state.previousValue(...)` |
| 79 | `store.state.value.get()` | `store.state.value()` |
| 80 | `store.computed.parser.get()` | `store.computed.parser()` |
| 86 | `this.store.state.Mark.get()` | `this.store.state.Mark()` |
| 94 | `store.state.recovery.get()` | `store.state.recovery()` |
| 95 | `store.state.tokens.get()` | `store.state.tokens()` |
| 96 | `store.state.tokens.set(...)` | `store.state.tokens(...)` |
| 97 | `store.state.previousValue.set(...)` | `store.state.previousValue(...)` |
| 100 | `store.state.tokens.set(...)` | `store.state.tokens(...)` |

- [ ] **Step 2: Migrate `Lifecycle.spec.ts`**

Replace all 20 `.get()` → `()` and 34 `.set(v)` → `(v)`. Every occurrence follows the same pattern.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/lifecycle/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/lifecycle/
git commit -m "refactor(core): migrate Lifecycle to callable signal form"
```

---

### Task 5: Migrate InputFeature

**Files:**
- Modify: `packages/core/src/features/input/InputFeature.ts`

- [ ] **Step 1: Migrate `InputFeature.ts`**

Replace all `.get()` → `()` and `.set(v)` → `(v)`:

| Line | Before | After |
|------|--------|-------|
| 23 | `this.store.state.drag.get()` | `this.store.state.drag()` |
| 109 | `store.state.selecting.get()` | `store.state.selecting()` |
| 120 | `store.state.selecting.set(undefined)` | `store.state.selecting(undefined)` |
| 122 | `store.state.drag.get()` | `store.state.drag()` |
| 147 | `store.state.tokens.get()` | `store.state.tokens()` |
| 150 | `store.state.previousValue.get()` | `store.state.previousValue()` |
| 150 | `store.state.value.get()` | `store.state.value()` |
| 168 | `store.state.innerValue.set(newValue)` | `store.state.innerValue(newValue)` |
| 170 | `store.state.tokens.get()` | `store.state.tokens()` |
| 177 | `store.state.recovery.set({...})` | `store.state.recovery({...})` |
| 249 | `store.state.selecting.get()` | `store.state.selecting()` |
| 251 | `store.state.selecting.set(undefined)` | `store.state.selecting(undefined)` |
| 263 | `store.state.selecting.set(undefined)` | `store.state.selecting(undefined)` |
| 265 | `store.state.onChange.get()?.(...)` | `store.state.onChange()?.(...)` |
| 267 | `store.state.value.get()` | `store.state.value()` |
| 268 | `store.state.tokens.set(...)` | `store.state.tokens(...)` |
| 269 | `store.computed.parser.get()?.parse(...)` | `store.computed.parser()?.parse(...)` |
| 283 | `store.state.recovery.set({...})` | `store.state.recovery({...})` |

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: InputFeature compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/input/InputFeature.ts
git commit -m "refactor(core): migrate InputFeature to callable signal form"
```

---

### Task 6: Migrate OverlayFeature

**Files:**
- Modify: `packages/core/src/features/overlay/OverlayFeature.ts`
- Modify: `packages/core/src/features/overlay/OverlayFeature.spec.ts`

- [ ] **Step 1: Migrate `OverlayFeature.ts`**

| Line | Before | After |
|------|--------|-------|
| 22 | `this.store.state.overlayMatch.set(undefined)` | `this.store.state.overlayMatch(undefined)` |
| 26 | `this.store.state.overlayTrigger.get()` | `this.store.state.overlayTrigger()` |
| 28 | `this.store.state.options.get()` | `this.store.state.options()` |
| 29 | `this.store.state.overlayMatch.set(match)` | `this.store.state.overlayMatch(match)` |
| 33 | `this.store.state.showOverlayOn.get()` | `this.store.state.showOverlayOn()` |
| 52 | `this.store.state.showOverlayOn.get()` | `this.store.state.showOverlayOn()` |

- [ ] **Step 2: Migrate `OverlayFeature.spec.ts`**

Replace all 7 `.get()` → `()` and 15 `.set(v)` → `(v)`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/overlay/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/overlay/
git commit -m "refactor(core): migrate OverlayFeature to callable signal form"
```

---

### Task 7: Migrate DragFeature

**Files:**
- Modify: `packages/core/src/features/drag/DragFeature.ts`

- [ ] **Step 1: Migrate `DragFeature.ts`**

Replace all 13 `.get()` → `()` and 4 `.set(v)` → `(v)`. Every `this.store.state.X.get()` → `this.store.state.X()`, every `this.store.state.innerValue.set(v)` → `this.store.state.innerValue(v)`.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: DragFeature compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/drag/DragFeature.ts
git commit -m "refactor(core): migrate DragFeature to callable signal form"
```

---

### Task 8: Migrate BlockEditFeature

**Files:**
- Modify: `packages/core/src/features/block-editing/BlockEditFeature.ts`

- [ ] **Step 1: Migrate `BlockEditFeature.ts`**

Replace all 15 `.get()` → `()` and 9 `.set(v)` → `(v)`.

Key patterns:
- `this.store.state.tokens.get()` → `this.store.state.tokens()`
- `this.store.state.previousValue.get()` → `this.store.state.previousValue()`
- `this.store.state.value.get()` → `this.store.state.value()`
- `this.store.state.onChange.get()` → `this.store.state.onChange()`
- `this.store.state.innerValue.set(v)` → `this.store.state.innerValue(v)`
- `this.store.state.options.get()` → `this.store.state.options()`
- `this.store.state.drag.get()` → `this.store.state.drag()`

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: BlockEditFeature compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/features/block-editing/BlockEditFeature.ts
git commit -m "refactor(core): migrate BlockEditFeature to callable signal form"
```

---

### Task 9: Migrate remaining feature files

**Files:**
- Modify: `packages/core/src/features/focus/FocusFeature.ts`
- Modify: `packages/core/src/features/selection/TextSelectionFeature.ts`
- Modify: `packages/core/src/features/selection/TextSelectionFeature.spec.ts`
- Modify: `packages/core/src/features/selection/selectionHelpers.ts`
- Modify: `packages/core/src/features/editable/ContentEditableFeature.ts`
- Modify: `packages/core/src/features/editable/ContentEditableFeature.spec.ts`
- Modify: `packages/core/src/features/arrownav/ArrowNavFeature.ts`
- Modify: `packages/core/src/features/clipboard/CopyFeature.ts`
- Modify: `packages/core/src/features/clipboard/selectionToTokens.ts`
- Modify: `packages/core/src/features/events/SystemListenerFeature.ts`
- Modify: `packages/core/src/features/events/SystemListenerFeature.spec.ts`
- Modify: `packages/core/src/features/parsing/utils/valueParser.ts`
- Modify: `packages/core/src/features/mark/MarkHandler.ts`

- [ ] **Step 1: Migrate FocusFeature.ts** (2 `.get()`, 1 `.set()`)

- [ ] **Step 2: Migrate TextSelectionFeature.ts** (5 `.get()`, 4 `.set()`)

- [ ] **Step 3: Migrate TextSelectionFeature.spec.ts** (1 `.get()`, 3 `.set()`)

- [ ] **Step 4: Migrate selectionHelpers.ts** (1 `.get()`, 1 `.set()`)

- [ ] **Step 5: Migrate ContentEditableFeature.ts** (4 `.get()`)

- [ ] **Step 6: Migrate ContentEditableFeature.spec.ts** (5 `.set()`)

- [ ] **Step 7: Migrate ArrowNavFeature.ts** (1 `.get()`)

- [ ] **Step 8: Migrate CopyFeature.ts** (3 `.get()`, 2 `.set()`)

- [ ] **Step 9: Migrate selectionToTokens.ts** (1 `.get()`)

- [ ] **Step 10: Migrate SystemListenerFeature.ts** (8 `.get()`, 6 `.set()`)

- [ ] **Step 11: Migrate SystemListenerFeature.spec.ts** (2 `.get()`, 16 `.set()`)

- [ ] **Step 12: Migrate valueParser.ts** (9 `.get()`, 2 `.set()`)

- [ ] **Step 13: Migrate MarkHandler.ts** (2 `.get()`)

- [ ] **Step 14: Run tests for all migrated features**

Run: `pnpm --filter @markput/core exec vitest run`
Expected: All tests pass.

- [ ] **Step 15: Commit**

```bash
git add packages/core/src/features/
git commit -m "refactor(core): migrate remaining features to callable signal form"
```

---

### Task 10: Migrate BlockStore and slots

**Files:**
- Modify: `packages/core/src/shared/classes/BlockStore.ts`
- Modify: `packages/core/src/features/slots/createSlots.ts`
- Modify: `packages/core/src/features/slots/createSlots.spec.ts`

- [ ] **Step 1: Migrate `BlockStore.ts`** (1 `.get()`, 11 `.set()`)

Replace all `this.state.X.get()` → `this.state.X()` and `this.state.X.set(v)` → `this.state.X(v)`.

- [ ] **Step 2: Migrate `createSlots.ts`**

Here the slot `.get()` method is part of the Slot API (not signal `.get()`), so it stays. But internally it calls signal `.get()` which must change to callable form:

| Line | Before | After |
|------|--------|-------|
| 16 | `slots.get()` | `slots()` |
| 16 | `slotProps.get()` | `slotProps()` |
| 25 | `overlay.get()` | `overlay()` |
| 37 | `options.get()` | `options()` |
| 38 | `options.get()` | `options()` |
| 38 | `mark.get()` | `mark()` |
| 38 | `span.get()` | `span()` |

Note: `mark.use()` and `span.use()` stay unchanged.

- [ ] **Step 3: Migrate `createSlots.spec.ts`**

The slot `.get()` calls are on the slot API (not signals), so they stay. But `slots.set(...)` and `slotProps.set(...)` are signal `.set()` calls that need migration:

| Line | Before | After |
|------|--------|-------|
| 50 | `slots.set({container: 'section'})` | `slots({container: 'section'})` |
| 65 | `slots.set({span: 'strong'})` | `slots({span: 'strong'})` |
| 66 | `slotProps.set({span: {className: 'bold'}})` | `slotProps({span: {className: 'bold'}})` |

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/shared/ packages/core/src/features/slots/`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/shared/classes/BlockStore.ts packages/core/src/features/slots/
git commit -m "refactor(core): migrate BlockStore and slots to callable signal form"
```

---

### Task 11: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`
Expected: Zero type errors. Any remaining `.get()` / `.set()` on signals would be caught here.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 4: Run lint**

Run: `pnpm run lint`
Expected: No lint errors.

- [ ] **Step 5: Run format check**

Run: `pnpm run format`
Expected: No formatting issues.

- [ ] **Step 6: Verify no remaining signal `.get()` / `.set()` calls**

Run: `rg '\.get\(\)|\.set\(' packages/core/src/ packages/react/markput/src/ packages/vue/markput/src/ --type ts -g '!alien-signals' -g '!*.d.ts'`
Expected: No signal `.get()` / `.set()` calls remain. Only legitimate calls (Map, WeakMap, Reflect, slot `.get()`, BlockRegistry, KeyGenerator) should appear.
