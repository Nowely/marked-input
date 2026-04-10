# Remove Lifecycle: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Lifecycle class by inlining its watches into Store and introducing a dedicated `mounted` event.

**Architecture:** Add `mounted` event to Store, inline two `watch` calls (mounted → enable features, unmounted → disable features) as a private IIFE field, update React/Vue to emit `mounted()` on mount, delete Lifecycle folder.

**Tech Stack:** TypeScript, React 19, Vue 3, Vitest

---

### Task 1: Add `mounted` event to Store and inline lifecycle watches

**Files:**
- Modify: `packages/core/src/features/store/Store.ts`

- [ ] **Step 1: Add `mounted` event**

In `Store.ts`, add `mounted: event()` to the `event` object (after line 131, before `unmounted`):

```typescript
readonly event = {
    change: event(),
    parse: event(),
    delete: event<{token: Token}>(),
    select: event<{mark: Token; match: OverlayMatch}>(),
    clearOverlay: event(),
    checkOverlay: event(),
    sync: event(),
    recoverFocus: event(),
    dragAction: event<DragAction>(),
    updated: event(),
    afterTokensRendered: event(),
    mounted: event(),
    unmounted: event(),
}
```

- [ ] **Step 2: Inline lifecycle watches**

Remove the Lifecycle import (line 26):

```typescript
// DELETE this line:
import {Lifecycle} from '../lifecycle'
```

Replace `readonly lifecycle = new Lifecycle(this)` (line 155) with:

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

- [ ] **Step 3: Verify Store compiles**

Run: `pnpm run typecheck`
Expected: PASS (no type errors in Store.ts)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/store/Store.ts
git commit -m "refactor(core): add mounted event, inline lifecycle watches into Store"
```

---

### Task 2: Update React to emit `mounted()`

**Files:**
- Modify: `packages/react/markput/src/components/MarkedInput.tsx`

- [ ] **Step 1: Add `mounted()` emission**

Change line 85-86 from:

```typescript
useLayoutEffect(() => store.event.updated())
useEffect(() => () => store.event.unmounted(), [store])
```

To:

```typescript
useLayoutEffect(() => store.event.mounted())
useLayoutEffect(() => store.event.updated())
useEffect(() => () => store.event.unmounted(), [store])
```

This emits `mounted()` once in the first layout effect, then `updated()` on every render (including the first). The `mounted()` call triggers feature enable, `updated()` triggers parse sync.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/MarkedInput.tsx
git commit -m "feat(react): emit mounted event on component mount"
```

---

### Task 3: Update Vue to emit `mounted()`

**Files:**
- Modify: `packages/vue/markput/src/components/MarkedInput.vue`

- [ ] **Step 1: Add `mounted()` emission**

Change lines 62-64 from:

```typescript
onMounted(() => store.value.event.updated())
onUpdated(() => store.value.event.updated())
onUnmounted(() => store.value.event.unmounted())
```

To:

```typescript
onMounted(() => {
    store.value.event.mounted()
    store.value.event.updated()
})
onUpdated(() => store.value.event.updated())
onUnmounted(() => store.value.event.unmounted())
```

Vue's `onMounted` fires once on initial mount — both `mounted()` and `updated()` are emitted there. `onUpdated` fires only on re-renders.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/MarkedInput.vue
git commit -m "feat(vue): emit mounted event on component mount"
```

---

### Task 4: Delete Lifecycle feature folder

**Files:**
- Delete: `packages/core/src/features/lifecycle/Lifecycle.ts`
- Delete: `packages/core/src/features/lifecycle/Lifecycle.spec.ts`
- Delete: `packages/core/src/features/lifecycle/index.ts`

- [ ] **Step 1: Delete the folder**

```bash
rm -rf packages/core/src/features/lifecycle
```

- [ ] **Step 2: Check for any remaining imports**

Search codebase for `lifecycle` references that might break:
```bash
rg -i 'lifecycle' packages/core/src/ packages/react/ packages/vue/ packages/storybook/ --type ts --type tsx --type vue
```

Expected: No remaining imports or references (the search may find comments in docs, which are updated in Task 6).

- [ ] **Step 3: Verify typecheck and tests**

Run: `pnpm run typecheck && pnpm test`
Expected: PASS (no compile errors, no failing tests referencing deleted files)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(core): remove Lifecycle class"
```

---

### Task 5: Update architecture documentation

**Files:**
- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update Store Structure in architecture.md**

In `architecture.md`, remove `readonly lifecycle: Lifecycle` from the Store structure code block (line 346). Also add `mounted` to the event list. The Store `event` section (around line 313-326) should include:

```typescript
readonly event: {
    change: Event<void>
    parse: Event<void>
    delete: Event<{ token: Token }>
    select: Event<{ mark: Token; match: OverlayMatch }>
    clearOverlay: Event<void>
    checkOverlay: Event<void>
    sync: Event<void>
    recoverFocus: Event<void>
    dragAction: Event<{ type: string; token: Token }>
    updated: Event<void>
    afterTokensRendered: Event<void>
    mounted: Event<void>
    unmounted: Event<void>
}
```

- [ ] **Step 2: Update Store Events table**

Add `mounted` to the events table (around line 220-233):

```markdown
| `mounted`       | Framework initial mount      | `void`                           |
```

Insert it between `afterTokensRendered` and `unmounted`.

- [ ] **Step 3: Replace Lifecycle Timing section**

Replace the "Lifecycle Timing" section (lines 387-405) with:

```markdown
## Lifecycle Timing

React/Vue render asynchronously, so initialization order matters:

```typescript
// 1. Framework emits store.event.mounted() on initial mount
//    → Store enables all features (DOM listeners, reactive subscriptions)

// 2. Framework emits store.event.updated() on mount/update
//    → ParseFeature syncs value/options, triggers parse if changed

// 3. Sync contenteditable attributes (layout effect)
//    → ContentEditableFeature.sync()

// 4. Framework emits store.event.afterTokensRendered() after tokens render

// 5. Framework emits store.event.unmounted() on unmount
//    → Store disables all features (cleanup DOM listeners, dispose scopes)
```

- [ ] **Step 4: Update Features section**

In the Features section (around line 366-385), remove the last two lines:

```markdown
Managed by `Lifecycle`, which enables/disables all features as a unit.
```

Also update the feature count in the section header from "10 features" to "11 features" (to account for ParseFeature which was extracted but not removed — verify count). Actually, check the current features list — it already lists 10 + ParseFeature exists. Keep the count as-is if it already lists the right number. Remove only the `Lifecycle` reference.

- [ ] **Step 5: Update MarkedInput component responsibility**

In the Component Responsibilities table (line 67), change:

```markdown
| **MarkedInput**      | Entry point, store initialization, lifecycle management      |
```

To:

```markdown
| **MarkedInput**      | Entry point, store initialization, mount/unmount signaling    |
```

- [ ] **Step 6: Commit**

```bash
git add packages/website/src/content/docs/development/architecture.md
git commit -m "docs: update architecture docs for mounted/unmounted lifecycle"
```

---

### Task 6: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Remove Lifecycle references**

Search AGENTS.md for any mention of "Lifecycle" and remove or update it. Specifically:
- If the architecture summary mentions Lifecycle, remove that line
- If feature list includes Lifecycle, remove it

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: remove Lifecycle references from AGENTS.md"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all checks**

```bash
pnpm test && pnpm run build && pnpm run typecheck && pnpm run lint && pnpm run format
```

Expected: All pass.

- [ ] **Step 2: Fix any issues**

If any check fails, fix and re-run until all pass.
