# Remove `defineEvents` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `defineEvents` utility entirely — replace its single usage in Store with a plain object literal and delete the utility + tests + exports.

**Architecture:** `defineEvents` is a pure identity function providing only type inference. TypeScript already infers `VoidEvent` / `PayloadEvent<T>` from `voidEvent()` / `payloadEvent<T>()` return values, so the wrapper is unnecessary. The replacement is a plain object literal. No consumer code changes.

**Tech Stack:** TypeScript, alien-signals (existing reactive primitive)

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/core/src/features/store/Store.ts` | Replace `defineEvents` with plain object |
| Modify | `packages/core/src/shared/signals/index.ts` | Remove `defineEvents` export |
| Modify | `packages/core/src/shared/classes/index.ts` | Remove `defineEvents` re-export |
| Modify | `packages/core/index.ts` | Remove `defineEvents` from public API |
| Delete | `packages/core/src/shared/signals/defineEvents.ts` | Remove the utility |
| Delete | `packages/core/src/shared/signals/defineEvents.spec.ts` | Remove its tests |
| Modify | `packages/core/src/shared/signals/signals.spec.ts` | Remove `defineEvents()` block and import |
| Modify | `packages/website/src/content/docs/development/architecture.md` | Update event system docs |

---

### Task 1: Replace `defineEvents` in Store with plain object literal

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Update the import line in Store.ts**

In `Store.ts` line 2, change:

```typescript
// FROM:
import {defineState, defineEvents, voidEvent, payloadEvent, type StateObject} from '../../shared/signals'
// TO:
import {defineState, voidEvent, payloadEvent, type StateObject} from '../../shared/signals'
```

- [ ] **Step 2: Replace the `events` declaration**

In `Store.ts` lines 56-70, change:

```typescript
// FROM:
	readonly events = defineEvents<{
		change: void
		parse: void
		delete: {token: Token}
		select: {mark: Token; match: OverlayMatch}
		clearOverlay: void
		checkOverlay: void
	}>({
		change: voidEvent(),
		parse: voidEvent(),
		delete: payloadEvent<{token: Token}>(),
		select: payloadEvent<{mark: Token; match: OverlayMatch}>(),
		clearOverlay: voidEvent(),
		checkOverlay: voidEvent(),
	})

// TO:
	readonly events = {
		change: voidEvent(),
		parse: voidEvent(),
		delete: payloadEvent<{token: Token}>(),
		select: payloadEvent<{mark: Token; match: OverlayMatch}>(),
		clearOverlay: voidEvent(),
		checkOverlay: voidEvent(),
	}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 4: Run Store tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/features/store/Store.spec.ts`
Expected: PASS

- [ ] **Step 5: Run full tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/store/Store.ts
git commit -m "refactor(core): remove defineEvents from Store, use plain object"
```

---

### Task 2: Delete `defineEvents` utility and its dedicated tests

**Files:**
- Delete: `packages/core/src/shared/signals/defineEvents.ts`
- Delete: `packages/core/src/shared/signals/defineEvents.spec.ts`

- [ ] **Step 1: Delete the files**

```bash
rm packages/core/src/shared/signals/defineEvents.ts
rm packages/core/src/shared/signals/defineEvents.spec.ts
```

- [ ] **Step 2: Commit**

```bash
git add -u packages/core/src/shared/signals/defineEvents.ts packages/core/src/shared/signals/defineEvents.spec.ts
git commit -m "refactor(core): delete defineEvents utility and tests"
```

---

### Task 3: Clean up exports — signals, classes, core index

**Files:**
- Modify: `packages/core/src/shared/signals/index.ts`
- Modify: `packages/core/src/shared/classes/index.ts`
- Modify: `packages/core/index.ts`

- [ ] **Step 1: Update `packages/core/src/shared/signals/index.ts`**

Remove this line:

```typescript
export {defineEvents} from './defineEvents'
```

- [ ] **Step 2: Update `packages/core/src/shared/classes/index.ts`**

In the re-export block (lines 6-15), remove `defineEvents,`:

```typescript
// FROM:
export {
	setUseHookFactory,
	getUseHookFactory,
	effect,
	voidEvent,
	payloadEvent,
	defineState,
	defineEvents,
	watch,
} from '../signals'

// TO:
export {
	setUseHookFactory,
	getUseHookFactory,
	effect,
	voidEvent,
	payloadEvent,
	defineState,
	watch,
} from '../signals'
```

- [ ] **Step 3: Update `packages/core/index.ts`**

In the value export block (lines 21-30), remove `defineEvents,`:

```typescript
// FROM:
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
export {
	setUseHookFactory,
	getUseHookFactory,
	effect,
	voidEvent,
	payloadEvent,
	defineState,
	watch,
} from './src/shared/signals'
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 5: Run full tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/shared/signals/index.ts packages/core/src/shared/classes/index.ts packages/core/index.ts
git commit -m "refactor(core): remove defineEvents from all exports"
```

---

### Task 4: Remove `defineEvents()` integration tests from `signals.spec.ts`

**Files:**
- Modify: `packages/core/src/shared/signals/signals.spec.ts`

- [ ] **Step 1: Remove the `defineEvents` import on line 4**

```typescript
// REMOVE this line:
import {defineEvents} from './defineEvents'
```

- [ ] **Step 2: Remove the `defineEvents()` describe block (lines 497-546)**

Delete everything from the comment separator `// defineEvents() integration` through the end of the `describe('defineEvents()', ...)` block (lines 497-546).

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @markput/core exec vitest run packages/core/src/shared/signals/signals.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/signals/signals.spec.ts
git commit -m "test(core): remove defineEvents integration tests from signals.spec.ts"
```

---

### Task 5: Update architecture docs

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md`

- [ ] **Step 1: Update the Event System section**

In `architecture.md` line 214, change:

```markdown
<!-- FROM: -->
Events use `defineEvents()` which creates typed emitters using reactive signals:

<!-- TO: -->
Events are declared as plain object literals using `voidEvent()` and `payloadEvent<T>()`:
```

- [ ] **Step 2: Commit**

```bash
git add packages/website/src/content/docs/development/architecture.md
git commit -m "docs: update architecture docs to remove defineEvents reference"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run all checks**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass with no errors.
