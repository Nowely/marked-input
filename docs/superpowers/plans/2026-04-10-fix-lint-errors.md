# Fix All Lint Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 oxlint `typescript-eslint(no-unsafe-*)` errors in `packages/react/app/src/index.tsx:55` so all 5 checks pass cleanly.

**Architecture:** API Extractor's `untrimmedFilePath` mode preserves external `import { denote } from '@markput/core'` in the rolled-up `.d.ts`. But the pre-pack step strips `dependencies` from the published `package.json` — consumers (including E2E apps) never install `@markput/core`. Since `@markput/core` is unresolvable, all re-exported symbols (`denote`, `MarkToken`, `Markup`) degrade to error types, triggering `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`. The fix: add `bundledPackages: ['@markput/core']` to the API Extractor config so it inlines all core type declarations into the rolled-up `.d.ts`, making it self-contained. This mirrors what vite already does for the JS bundle.

**Tech Stack:** oxlint, pnpm, TypeScript, API Extractor

---

### Task 1: Add `bundledPackages` to React API Extractor config

**Files:**

- Modify: `packages/react/markput/prepack.js:90-102`

- [ ] **Step 1: Add `bundledPackages` to the config object**

In `packages/react/markput/prepack.js`, inside `getOptions()` → `configObject`, add `bundledPackages` right after `projectFolder`:

```js
/** @type api.IConfigFile */
const configObject = {
    projectFolder: path.resolve(__dirname),
    mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
    bundledPackages: ['@markput/core'],
    compiler: {tsconfigFilePath: '<projectFolder>/tsconfig.json'},
    dtsRollup: {
        enabled: true,
        untrimmedFilePath: '<projectFolder>/dist/index.d.ts',
    },
    // ... rest unchanged
}
```

The exact change at `packages/react/markput/prepack.js:91-93` — add one line between `projectFolder` and `mainEntryPointFilePath`:

Old (lines 91-93):

```js
			projectFolder: path.resolve(__dirname),
			mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
			compiler: {tsconfigFilePath: '<projectFolder>/tsconfig.json'},
```

New:

```js
			projectFolder: path.resolve(__dirname),
			mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
			bundledPackages: ['@markput/core'],
			compiler: {tsconfigFilePath: '<projectFolder>/tsconfig.json'},
```

- [ ] **Step 2: Rebuild `@markput/react`**

Run: `pnpm --filter @markput/react run build`

Expected: build succeeds. Check that the output `dist/index.d.ts` no longer contains `import ... from '@markput/core'`.

- [ ] **Step 3: Verify the rolled-up `.d.ts` is self-contained**

Run: `grep '@markput/core' packages/react/markput/dist/index.d.ts`
Expected: **no matches** (all core types inlined)

---

### Task 2: Add `bundledPackages` to Vue API Extractor config

**Files:**

- Modify: `packages/vue/markput/prepack.js:86-89`

- [ ] **Step 1: Add `bundledPackages` to the config object**

Same change as Task 1 but in `packages/vue/markput/prepack.js`. Inside `getOptions()` → `configObject`, add `bundledPackages` after `mainEntryPointFilePath`:

Old (lines 87-89):

```js
			projectFolder: path.resolve(__dirname),
			mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
			compiler: {tsconfigFilePath: '<projectFolder>/tsconfig.json'},
```

New:

```js
			projectFolder: path.resolve(__dirname),
			mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
			bundledPackages: ['@markput/core'],
			compiler: {tsconfigFilePath: '<projectFolder>/tsconfig.json'},
```

- [ ] **Step 2: Rebuild `@markput/vue`**

Run: `pnpm --filter @markput/vue run build`

Expected: build succeeds.

- [ ] **Step 3: Verify the rolled-up `.d.ts` is self-contained**

Run: `grep '@markput/core' packages/vue/markput/dist/index.d.ts`
Expected: **no matches**

---

### Task 3: Verify all checks pass

- [ ] **Step 1: Run all 5 checks**

Run each and verify all pass:

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint`
5. `pnpm run format`

- [ ] **Step 2: Commit**

```bash
git add packages/react/markput/prepack.js packages/vue/markput/prepack.js
git commit -m "fix(react,vue): bundle @markput/core types in rolled-up .d.ts via bundledPackages"
```
