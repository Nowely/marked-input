# BlockStore Field Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BlockStore's `state` initialization from the constructor to a class field, matching Store's pattern.

**Architecture:** Single-file refactor — remove constructor, inline state as a class field with signal initializers.

**Tech Stack:** TypeScript, existing signal system

---

### Task 1: Refactor BlockStore state initialization

**Files:**
- Modify: `packages/core/src/shared/classes/BlockStore.ts`

- [ ] **Step 1: Replace state declaration and constructor with class field**

In `packages/core/src/shared/classes/BlockStore.ts`, replace lines 14–36 (the `state` type declaration and constructor) with:

```ts
readonly state = {
	isHovered: signal(false),
	isDragging: signal(false),
	dropPosition: signal<DropPosition>(null),
	menuOpen: signal(false),
	menuPosition: signal({top: 0, left: 0}),
}
```

- [ ] **Step 2: Remove unused `Signal` import**

If `import type {Signal} from '../signals'` (line 4) is no longer referenced elsewhere in the file, remove it.

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS (all tests pass)

- [ ] **Step 5: Run build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 6: Run lint and format**

Run: `pnpm run lint && pnpm run format`
Expected: PASS (no errors)

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/shared/classes/BlockStore.ts
git commit -m "refactor(core): move BlockStore state init to class field"
```
