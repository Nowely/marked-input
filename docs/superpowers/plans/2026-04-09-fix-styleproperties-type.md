# Fix StyleProperties Type — Use csstype Instead of Record

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `StyleProperties = Record<string, string | number>` with `CSS.Properties<string | number>` from `csstype` so framework `CSSProperties` types are directly assignable — eliminating all `as StyleProperties` casts and their `oxlint-disable` comments.

**Architecture:** Add `csstype` as a type-only dependency to `@markput/core`. Change the `StyleProperties` type alias. Remove the two unsafe casts in React and Vue entry points. No behavioral change — purely a type-level fix.

**Tech Stack:** TypeScript, csstype (type-only dep), pnpm catalog

---

### Task 1: Add csstype dependency

**Files:**

- Modify: `pnpm-workspace.yaml` (catalog entry)
- Modify: `packages/core/package.json` (devDependencies)

- [ ] **Step 1: Add csstype to pnpm catalog**

In `pnpm-workspace.yaml`, add to the `catalog:` block:

```yaml
csstype: ^3.1.3
```

- [ ] **Step 2: Add csstype to core's package.json**

In `packages/core/package.json`, add to `devDependencies`:

```json
    "csstype": "catalog:",
```

- [ ] **Step 3: Install**

Run: `pnpm install`

Expected: installs `csstype@3.1.3` into `packages/core/node_modules/`.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add csstype type-only dependency"
```

---

### Task 2: Update StyleProperties type in core

**Files:**

- Modify: `packages/core/src/shared/types.ts:113`

- [ ] **Step 1: Replace StyleProperties definition**

In `packages/core/src/shared/types.ts`, replace:

```ts
export type StyleProperties = Record<string, string | number>
```

with:

```ts
import type {Properties} from 'csstype'

export type StyleProperties = Properties<string | number>
```

Note: the `import type` from `csstype` goes at the top of the file with the other imports.

- [ ] **Step 2: Verify core builds**

Run: `pnpm --filter @markput/core run typecheck`

Expected: PASS — `Properties<string | number>` is a superset of the old `Record` shape; all existing internal consumers (`Store.ts`, `merge.ts`, `CoreSlotProps`) only read/iterate the object and remain compatible.

- [ ] **Step 3: Run core tests**

Run: `pnpm --filter @markput/core test`

Expected: all tests pass (style is used as plain objects like `{color: 'red'}`, which satisfy `Properties<string | number>`).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/shared/types.ts
git commit -m "refactor(core): use csstype Properties for StyleProperties"
```

---

### Task 3: Remove style cast in React MarkedInput

**Files:**

- Modify: `packages/react/markput/src/components/MarkedInput.tsx:1,88-89,92,97`

- [ ] **Step 1: Remove StyleProperties import and style variable**

In `packages/react/markput/src/components/MarkedInput.tsx`:

Remove `StyleProperties` from the import on line 1:

```ts
import type {CoreSlotProps, MarkputHandler, OverlayTrigger} from '@markput/core'
```

Delete lines 88-89 (the `oxlint-disable` comment and `const style = rest.style as StyleProperties | undefined`).

Update line 92 (`setState` in `useState`) to pass `rest.style` directly:

```ts
nextStore.setState({...rest, style: rest.style, baseClassName: styles.Container, slotProps})
```

Update line 97 (`setState` in `useLayoutEffect`) to match:

```ts
store.setState({...rest, style: rest.style, baseClassName: styles.Container, slotProps})
```

- [ ] **Step 2: Verify React typecheck**

Run: `pnpm --filter @markput/react run typecheck`

Expected: PASS — `CSSProperties extends Properties<string | number>` is now assignable to `StyleProperties` without cast.

- [ ] **Step 3: Commit**

```bash
git add packages/react/markput/src/components/MarkedInput.tsx
git commit -m "refactor(react): remove unsafe StyleProperties cast"
```

---

### Task 4: Remove style cast in Vue MarkedInput

**Files:**

- Modify: `packages/vue/markput/src/components/MarkedInput.vue:2,39`

- [ ] **Step 1: Remove StyleProperties import and cast**

In `packages/vue/markput/src/components/MarkedInput.vue`:

Remove `StyleProperties` from the import on line 2:

```ts
import type {CoreSlotProps, CoreSlots} from '@markput/core'
```

Change line 39 from:

```ts
		style: props.style as StyleProperties | undefined,
```

to:

```ts
		style: props.style,
```

- [ ] **Step 2: Verify Vue typecheck**

Run: `pnpm --filter @markput/vue run typecheck`

Expected: PASS — Vue's `CSSProperties` extends `CSS.Properties<string | number>`, assignable to `StyleProperties` without cast.

- [ ] **Step 3: Commit**

```bash
git add packages/vue/markput/src/components/MarkedInput.vue
git commit -m "refactor(vue): remove unsafe StyleProperties cast"
```

---

### Task 5: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run all checks**

Run all five commands. Every one must pass with zero errors:

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: all green. No `no-unsafe-type-assertion` errors related to style. The two removed `oxlint-disable` comments are no longer needed.

- [ ] **Step 2: Verify no remaining style-related suppressions**

Run: `grep -n "CSSProperties is structurally compatible" packages/react/markput/ packages/vue/markput/`

Expected: no matches (the suppression comments are gone).

---

## Files changed summary

| File                                                    | Change                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------- |
| `pnpm-workspace.yaml`                                   | Add `csstype: ^3.1.3` to catalog                                                  |
| `packages/core/package.json`                            | Add `"csstype": "catalog:"` to devDependencies                                    |
| `packages/core/src/shared/types.ts`                     | `StyleProperties` → `Properties<string                                            | number>` from csstype |
| `packages/react/markput/src/components/MarkedInput.tsx` | Remove `StyleProperties` import, delete cast variable, pass `rest.style` directly |
| `packages/vue/markput/src/components/MarkedInput.vue`   | Remove `StyleProperties` import, remove `as StyleProperties \| undefined` cast    |
