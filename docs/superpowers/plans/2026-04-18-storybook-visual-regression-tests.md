# Storybook Visual Regression Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a Vitest 4 `toMatchScreenshot()` assertion for every Storybook story in both React and Vue, wired into the existing `pnpm test` with determinism and zero new dependencies.

**Architecture:** Two existing auto-discovery spec files (`stories.react.spec.tsx`, `stories.vue.spec.ts`) are rewritten to emit a screenshot test per composed story. Global `toMatchScreenshot` options live in `packages/storybook/vite.config.ts`. Determinism (faker seed, frozen `Date`) lives in `packages/storybook/vitest.setup.ts`. Playwright's built-in `animations: 'disabled'` + `caret: 'hide'` replace any custom CSS. Baselines are committed locally, one PNG per story per framework, under `packages/storybook/src/pages/__screenshots__/`.

**Tech Stack:** Vitest 4.1.2 (browser mode, Playwright Chromium), `vitest-browser-react` 2.1.0, `vitest-browser-vue` 2.1.0, `@storybook/react-vite` + `@storybook/vue3-vite` 10.x, `@faker-js/faker` (already in catalog), `pnpm` 9+.

**Spec:** `docs/superpowers/specs/2026-04-18-visual-regression-tests-design.md`

---

## Conventions applied to every task

- **Commits go through the husky/lint-staged pre-commit hook.** It auto-runs `oxfmt` + `oxlint --fix` on staged files. Formatter drift is silently fixed. If `oxlint` finds an issue it can't auto-fix, the commit is blocked — resolve with `pnpm run lint:fix` (and, if needed, `pnpm run lint:fix:suggest`) then retry.
- **Pass Vitest flags through pnpm with `--`.** `pnpm --filter @markput/storybook run test:react --update` will NOT forward `--update` to Vitest. Use either `pnpm --filter @markput/storybook run test:react -- --update` or `pnpm --filter @markput/storybook exec vitest run --project react --update`. The plan uses the `exec vitest` form where flags are needed.
- **Use the repo's file operations, not shell primitives.** `rm -rf` is used only in Task 8 where a clean wipe of the baseline directory is the explicit intent.

---

## Preflight (once per work session)

- [ ] **Preflight Step 1: Confirm working directory and branch**

Run from the repo root:

```bash
pwd
git status --short
git rev-parse --abbrev-ref HEAD
```

Expected: cwd ends in `/marked-input`, branch is a feature branch (or `next`), and any pending changes are limited to docs files (the spec at `docs/superpowers/specs/2026-04-18-visual-regression-tests-design.md`, this plan, any brainstorm/todo docs under `docs/superpowers/`). No unrelated source-code changes should be sitting in the working tree.

- [ ] **Preflight Step 2: Confirm dependencies are installed**

```bash
pnpm install --frozen-lockfile
```

Expected: no installs (dependencies already in place) or a quick install using the existing lockfile.

- [ ] **Preflight Step 3: Confirm the current test suite passes**

```bash
pnpm --filter @markput/storybook run test
```

Expected: exits 0. All existing React and Vue tests pass. If this fails before we start, stop and investigate — do not blame the visual-test work for a pre-existing failure.

---

## Task 1: Add determinism to vitest.setup.ts

**Files:**
- Modify: `packages/storybook/vitest.setup.ts`

Goal: seed `faker` and freeze `Date` globally so random/time-based stories produce identical DOM across runs.

- [ ] **Step 1: Replace the contents of `packages/storybook/vitest.setup.ts` with this exact content**

```ts
import {faker} from '@faker-js/faker'
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'
import {afterAll, beforeAll, vi} from 'vitest'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Freeze faker + Date so faker-driven and clock-driven stories are reproducible.
// We ONLY fake `Date` — NOT setTimeout / setInterval / performance — because the
// MarkedInput component uses real timers for debouncing, overlay animations, etc.
//
// This setupFile runs per-file for every browser spec in both React and Vue
// projects, so we MUST pair useFakeTimers with useRealTimers in afterAll —
// otherwise a fake Date leaks to other specs and breaks anything that compares
// timestamps to "now".
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterAll(() => {
	vi.useRealTimers()
})
```

- [ ] **Step 2: Run the existing React test suite to confirm nothing regresses**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: PASS. The determinism change must not break the existing non-VRT tests. If a test now fails because it relied on the real clock, note the failing test and revisit in the "Known flake" subsection of the README in Task 9 — do not fix it in this task.

- [ ] **Step 3: Run the existing Vue test suite**

```bash
pnpm --filter @markput/storybook run test:vue
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/vitest.setup.ts
git commit -m "test(storybook): seed faker and freeze Date for deterministic story rendering"
```

---

## Task 2: Add global `toMatchScreenshot` defaults to `vite.config.ts`

**Files:**
- Modify: `packages/storybook/vite.config.ts`

Goal: register screenshot + comparator defaults once so every call site inherits them.

- [ ] **Step 1: Replace the `browser` constant in `packages/storybook/vite.config.ts`**

The file currently defines a `browser` constant at lines 6–14. Replace that block (and only that block) with:

```ts
const browser = {
	enabled: true,
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call
	provider: playwright(),
	instances: [{browser: 'chromium' as const}],
	viewport: {width: 1280, height: 720},
	headless: true,
	screenshotFailures: false,
	expect: {
		toMatchScreenshot: {
			// `timeout` is a TOP-LEVEL matcher option, not a screenshotOptions key —
			// screenshotOptions only mirrors Playwright locator.screenshot() options.
			timeout: 5_000,
			screenshotOptions: {
				animations: 'disabled' as const,
				caret: 'hide' as const,
			},
			comparatorName: 'pixelmatch' as const,
			comparatorOptions: {
				allowedMismatchedPixelRatio: 0.002,
			},
		},
	},
}
```

The rest of the file (the `defineConfig` export, the two `defineProject` entries) stays unchanged.

- [ ] **Step 2: Type-check the config**

```bash
pnpm --filter @markput/storybook exec tsc --noEmit -p .
```

Expected: exits 0. If it reports that `expect.toMatchScreenshot` is not a valid key, the Vitest version is older than documented — stop and report the mismatch instead of guessing.

- [ ] **Step 3: Run the existing test suite to confirm the config still boots**

```bash
pnpm --filter @markput/storybook run test
```

Expected: PASS. The two projects still run; no VRT calls exist yet, so nothing changes functionally. This step validates that Vitest accepts the new config keys.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/vite.config.ts
git commit -m "test(storybook): configure global toMatchScreenshot defaults (Playwright animations/caret, 0.2% tolerance)"
```

---

## Task 3: Rewrite `stories.react.spec.tsx` to emit a VRT per story

> ⚠️ **Branch-state note:** from the moment Task 3 is committed until Task 8 commits the baselines, `pnpm test` at the repo root will **fail by design** — there are no reference images yet. This is expected and documented. Do not interrupt the task sequence to "fix" that failure.

**Files:**
- Modify: `packages/storybook/src/pages/stories.react.spec.tsx`

Goal: for every discovered story, render it and call `toMatchScreenshot()`. Honor `parameters.screenshot === false` as an opt-out that still runs a smoke assertion.

- [ ] **Step 1: Replace the entire contents of `packages/storybook/src/pages/stories.react.spec.tsx`**

```tsx
// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'
import {render} from 'vitest-browser-react'

const storyModules = import.meta.glob('./**/*.react.stories.tsx', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, mod] of Object.entries(storyModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	const stories = composeStories(mod as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	Object.assign(storiesByCategory.get(category)!, stories)
}

describe('Storybook visual regression (React)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(<Story />)
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (Story.parameters?.screenshot === false) {
						expect(container.textContent?.length).toBeTruthy()
						return
					}

					// Explicit short name so the baseline file is `<Category>-<Story>-<browser>-<platform>.png`
					// instead of the verbose nested-describe-path Vitest would auto-derive.
					await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}-${name}`)
				})
			}
		})
	}
})
```

- [ ] **Step 2: Run the React project — expect first-run screenshot creation to fail each test**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: the suite runs and **exits with a non-zero code**. Every VRT-enabled test fails with a "reference created, please verify and re-run" message from Vitest, and reference PNGs are written under `packages/storybook/src/pages/__screenshots__/stories.react.spec.tsx/`. This failure is **expected** — Vitest 4 always writes + fails on the very first reference. Do **not** stop here, do **not** commit yet. If you are an automated agent with an "exit-code-must-be-0" guard, suppress it for this single step.

- [ ] **Step 3: Re-run immediately to confirm the second run passes**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: PASS. Every story now has a baseline and compares cleanly against itself.

- [ ] **Step 4: Spot-check one generated PNG**

Open any file under `packages/storybook/src/pages/__screenshots__/stories.react.spec.tsx/` in a viewer and confirm:
- The PNG is non-empty.
- The rendered story is visible and centred (no cropped content, no caret visible, no animation mid-flight).
- The filename matches the pattern `<Category>-<Story>-chromium-<platform>.png`.

If anything looks wrong (e.g. caret visible, overlay half-open), fix it in Task 2's config before generating a full baseline set in Task 8 — don't commit bad baselines.

- [ ] **Step 5: Commit the spec rewrite (without baselines yet)**

```bash
git add packages/storybook/src/pages/stories.react.spec.tsx
git commit -m "test(storybook): replace React stories smoke test with per-story visual regression"
```

Note: the generated `__screenshots__/` baselines are deliberately NOT committed here — they are committed in Task 8 once both framework specs exist and both have been regenerated in the same run.

---

## Task 4: Rewrite `stories.vue.spec.ts` to emit a VRT per story

**Files:**
- Modify: `packages/storybook/src/pages/stories.vue.spec.ts`

Goal: the Vue mirror of Task 3. Structurally identical; imports and render helper differ.

- [ ] **Step 1: Replace the entire contents of `packages/storybook/src/pages/stories.vue.spec.ts`**

```ts
// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'
import {render} from 'vitest-browser-vue'

const storyModules = import.meta.glob('./**/*.vue.stories.ts', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, mod] of Object.entries(storyModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	const stories = composeStories(mod as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	Object.assign(storiesByCategory.get(category)!, stories)
}

describe('Storybook visual regression (Vue)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(Story)
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (Story.parameters?.screenshot === false) {
						expect(container.textContent?.length).toBeTruthy()
						return
					}

					// Explicit short name so the baseline file is `<Category>-<Story>-<browser>-<platform>.png`
					// instead of the verbose nested-describe-path Vitest would auto-derive.
					await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}-${name}`)
				})
			}
		})
	}
})
```

- [ ] **Step 2: Run the Vue project — expect first-run creation failures**

```bash
pnpm --filter @markput/storybook run test:vue
```

Expected: suite runs and **exits with a non-zero code** (same "reference created" failure as the React project). PNGs are written under `packages/storybook/src/pages/__screenshots__/stories.vue.spec.ts/`. Expected behaviour — do not stop. If you are an automated agent with an "exit-code-must-be-0" guard, suppress it for this step.

- [ ] **Step 3: Re-run to confirm second run passes**

```bash
pnpm --filter @markput/storybook run test:vue
```

Expected: PASS.

- [ ] **Step 4: Spot-check one Vue PNG**

Open any file under `packages/storybook/src/pages/__screenshots__/stories.vue.spec.ts/` in a viewer and confirm:
- The PNG is non-empty.
- The rendered story is visible and centred (no cropped content, no caret visible, no animation mid-flight).
- The filename matches the pattern `<Category>-<Story>-chromium-<platform>.png`.

Additionally, open the Vue `Base-Default-chromium-<platform>.png` and compare visually against the React `Base-Default-chromium-<platform>.png`. They should be close to pixel-identical — the story args are equivalent and the components render the same underlying DOM. Divergence between React and Vue visual output is a legitimate cross-framework regression we want to catch, but a Vue-only rendering bug at this stage is a red flag — stop and investigate before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/stories.vue.spec.ts
git commit -m "test(storybook): replace Vue stories smoke test with per-story visual regression"
```

---

## Task 5: Delete the stale `createVisualTests.react.ts` helper

**Files:**
- Delete: `packages/storybook/src/shared/lib/createVisualTests.react.ts`

Goal: the helper was a never-wired-up stub. With Tasks 3 and 4 in place, it is dead code. Removing it simplifies the file tree.

- [ ] **Step 1: Confirm nothing imports the stub**

```bash
grep -rn "createVisualTests" packages/ || echo "no references"
```

Expected: output is `no references`. If anything matches, stop and investigate — the deletion would break that caller.

- [ ] **Step 2: Delete the file**

Use the file deletion tool (not `rm` via terminal) on:

```
packages/storybook/src/shared/lib/createVisualTests.react.ts
```

- [ ] **Step 3: Run typecheck + tests to confirm nothing breaks**

```bash
pnpm --filter @markput/storybook run typecheck
pnpm --filter @markput/storybook run test
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A packages/storybook/src/shared/lib/
git commit -m "chore(storybook): remove unused createVisualTests.react.ts stub"
```

---

## Task 6: Add `test:update` script

**Files:**
- Modify: `packages/storybook/package.json`

Goal: a single command to regenerate every baseline.

- [ ] **Step 1: Add `test:update` to `packages/storybook/package.json`**

Find the `"scripts"` block. Insert a new line after `"test": "pnpm run test:react && pnpm run test:vue",` so the block reads:

```json
"test:react": "vitest run --project react",
"test:vue": "vitest run --project vue",
"test": "pnpm run test:react && pnpm run test:vue",
"test:update": "vitest run --project react --update && vitest run --project vue --update",
"test:watch:react": "vitest --project react",
```

Preserve trailing commas exactly as in the existing file. Don't change any other script.

- [ ] **Step 2: Sanity-check the script exists**

```bash
grep '"test:update"' packages/storybook/package.json
```

Expected: one match, showing the new line (e.g. `"test:update": "vitest run --project react --update && vitest run --project vue --update",`). If nothing matches, the JSON edit in Step 1 didn't land — re-check indentation and commas.

- [ ] **Step 3: Run `test:update` to confirm it executes successfully**

```bash
pnpm --filter @markput/storybook run test:update
```

Expected: both projects run with `--update`; all baselines are (re)written; the command exits 0. If it exits non-zero on the first invocation, that's Vitest's documented "first reference created" failure for any *new* story that didn't exist when Tasks 3/4 were run — rerun once more and confirm clean exit.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/package.json
git commit -m "chore(storybook): add test:update script for regenerating visual baselines"
```

---

## Task 7: Ignore Vitest attachment artifacts

**Files:**
- Modify: `packages/storybook/.gitignore`

Goal: keep canonical baselines tracked, but keep the per-failure `actual` + `diff` PNGs out of git.

- [ ] **Step 1: Replace the entire contents of `packages/storybook/.gitignore`**

The current file is exactly:

```
node_modules
dist-react
dist-vue
```

Replace it with:

```
node_modules
dist-react
dist-vue

# Vitest browser attachments: reference/actual/diff PNGs written on screenshot failures.
# Baselines in __screenshots__/ ARE tracked; only transient failure artifacts are ignored.
.vitest-attachments
```

- [ ] **Step 2: Verify git status is clean for this change alone**

```bash
git status --short packages/storybook/.gitignore
```

Expected: exactly one modified line showing the updated file.

- [ ] **Step 3: Commit**

```bash
git add packages/storybook/.gitignore
git commit -m "chore(storybook): gitignore Vitest attachment artifacts"
```

---

## Task 8: Generate and commit baselines

**Files:**
- Create: `packages/storybook/src/pages/__screenshots__/stories.react.spec.tsx/*.png`
- Create: `packages/storybook/src/pages/__screenshots__/stories.vue.spec.ts/*.png`

Goal: produce a full, known-clean set of baselines and commit them atomically.

- [ ] **Step 1: Wipe any partial baselines from earlier tasks**

```bash
rm -rf packages/storybook/src/pages/__screenshots__
```

This is deliberate: Tasks 3 and 4 may have left stale PNGs from intermediate runs (wrong caret state, wrong tolerance). A clean regeneration against the final config is the only safe baseline.

- [ ] **Step 2: Regenerate all baselines**

```bash
pnpm --filter @markput/storybook run test:update
```

Expected: first invocation writes everything and may fail with "reference created". Run it a second time:

```bash
pnpm --filter @markput/storybook run test:update
```

Expected: exits 0. Both runs combined should produce ~50–80 PNG files across the two directories.

- [ ] **Step 3: Sanity-scan the baselines**

Open 4–6 PNGs from different categories (e.g. `Base-Default`, `Ant-Default`, `Overlay-Default`, `Slots-Default`). For each:
- Content is the expected story, not a blank page or error state.
- No caret visible in the contenteditable.
- No half-rendered overlay / animation mid-flight.

If any PNG looks wrong, stop. Diagnose (probably in Tasks 1–2 config), wipe `__screenshots__`, and regenerate. Do **not** commit bad baselines.

- [ ] **Step 4: Confirm final `pnpm test` is green**

```bash
pnpm --filter @markput/storybook run test
```

Expected: exits 0. Every VRT test matches its baseline cleanly.

- [ ] **Step 5: Commit the baselines**

```bash
git add packages/storybook/src/pages/__screenshots__
git commit -m "test(storybook): add visual regression baselines for all React and Vue stories"
```

Expected commit size: 50–80 new PNG files, ~3–5 MB total.

---

## Task 9: Document the workflow

**Files:**
- Create: `packages/storybook/README.md`

Goal: a single page that tells any future contributor (a) what these tests do, (b) how to update them, (c) how to debug a failure.

- [ ] **Step 1: Create `packages/storybook/README.md` with this exact content**

````markdown
# @markput/storybook

Unified Storybook + Vitest browser-mode test harness for `@markput/react` and `@markput/vue`.

## Commands

| Command | What it does |
|---|---|
| `pnpm run dev` | Start both Storybook dev servers (React on 6006, Vue on 6007). |
| `pnpm run dev:react` / `pnpm run dev:vue` | Start one framework's Storybook dev server. |
| `pnpm run test` | Run every test in both projects (React then Vue). |
| `pnpm run test:react` / `pnpm run test:vue` | Run one project. |
| `pnpm run test:watch` | Watch mode for both projects in parallel. |
| `pnpm run test:update` | Regenerate visual regression baselines (see below). |

## Visual regression testing

Every Storybook story gets an automatic screenshot test. The tests live in two auto-discovery spec files and iterate over everything that matches:

- `src/pages/stories.react.spec.tsx` → every `*.react.stories.tsx`
- `src/pages/stories.vue.spec.ts` → every `*.vue.stories.ts`

No manual registration needed — add a new story, it's covered on next test run.

### How baselines work

- Baselines live next to the spec files under `src/pages/__screenshots__/stories.react.spec.tsx/` and `.../stories.vue.spec.ts/`.
- Filenames encode both browser and platform: `<Category>-<Story>-chromium-<platform>.png`.
- Baselines are **committed to the repo**. They are the source of truth.
- `.vitest-attachments/` holds transient `actual` / `diff` artifacts written when a test fails — that directory is gitignored.

### First run in a fresh checkout

If a story has no baseline yet, Vitest 4 writes the reference, then fails the test with a "reference created, review and re-run" message. This is normal — open the new PNG, confirm it looks right, and re-run `pnpm test`.

### Updating baselines after an intentional change

```bash
pnpm run test:update
```

This regenerates every baseline. Review the resulting PNGs (`git diff` on binaries, or any image viewer) before committing.

In watch mode, pressing `u` updates the currently failing baselines. Note: `pnpm run test:watch` runs two Vitest processes concurrently (React + Vue), so the `u` keypress only reaches the most recently focused process. If you only need to update one framework's baselines, run `pnpm run test:watch:react` or `pnpm run test:watch:vue` directly instead.

### Reading a failure

When `pnpm test` reports a screenshot mismatch, Vitest prints three paths under `.vitest-attachments/<test-id>/`:

- `reference.png` — what the baseline looks like.
- `actual.png` — what this run produced.
- `diff.png` — the pixel delta.

Open all three to decide whether the change is intentional (→ `test:update` + commit) or a regression (→ fix the code).

### Opting out of a specific story

```ts
export const FlakyStory: Story = {
  args: {},
  parameters: { screenshot: false },
}
```

The story still runs a smoke assertion (`container.textContent.length > 0`) but no screenshot comparison.

### What v1 does NOT catch

- **Initial render only.** We don't capture focused-state, overlay-open, or post-interaction snapshots yet.
- **Overlays that render outside `container`.** `MarkedInput` suggestion overlays can mount via portals or absolute positioning that extends beyond the immediate component DOM subtree. The baseline captures `container` only, so overlay-positioning regressions aren't caught here. Future work: screenshot `page` with `screenshotOptions.mask` for dynamic regions.
- **Multiple viewports.** One 1280×720 capture per story. Responsive breakpoints are not exercised.

### Known OS constraint

Vitest encodes the platform into the filename, so a macOS contributor's `*-chromium-darwin.png` baselines and a Linux CI runner's `*-chromium-linux.png` baselines can coexist. Today this repo only commits one platform's baselines at a time. If CI is later set up on an OS different from contributors, either:

1. Commit both OSes' baselines side-by-side, or
2. Pin a single reproducible OS (Docker) and regenerate locally against it.

This is a follow-up — tracked in the spec, not implemented here.
````

- [ ] **Step 2: Verify the Markdown renders reasonably**

```bash
head -n 20 packages/storybook/README.md
```

Expected: the heading and table render without mangled characters.

- [ ] **Step 3: Commit**

```bash
git add packages/storybook/README.md
git commit -m "docs(storybook): document visual regression workflow"
```

---

## Task 10: End-to-end verification

**Files:** none modified. This is a verification task with no commit at the end unless a fix is needed.

Goal: prove the new VRT setup actually catches regressions.

- [ ] **Step 1: Confirm a clean baseline run**

```bash
pnpm --filter @markput/storybook run test
```

Expected: exits 0.

- [ ] **Step 2: Introduce an intentional CSS regression**

Edit `packages/react/markput/src/components/Container.tsx`. Find any style/className the container applies and add an obvious visual change — e.g. add `style={{border: '3px solid red'}}` to the container div. Save the file.

- [ ] **Step 3: Run `pnpm test` and confirm the affected React stories fail**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: the suite FAILS. Multiple stories in the React project report screenshot mismatches with attachment paths under `.vitest-attachments/`. The Vue project is unaffected (`test:vue` still passes).

- [ ] **Step 4: Revert the intentional regression**

Undo the `Container.tsx` edit (`git checkout -- packages/react/markput/src/components/Container.tsx` or via the editor).

- [ ] **Step 5: Confirm the suite goes green again**

```bash
pnpm --filter @markput/storybook run test
```

Expected: exits 0.

- [ ] **Step 6: Test the opt-out mechanism actually fires**

A test passing alone is not proof the opt-out worked — a screenshot comparison against a present baseline would also pass. To prove the smoke branch ran, we temporarily delete the `Base-Default` baseline and verify that the test still passes WHEN opt-out is set (it can't match a missing baseline, so passing means the screenshot branch was skipped).

(a) Delete the single baseline for `Base > Default` (both framework-platform variants if present):

```bash
rm -f packages/storybook/src/pages/__screenshots__/stories.react.spec.tsx/Base-Default-chromium-*.png
```

(b) Edit `packages/storybook/src/pages/Base/Base.react.stories.tsx` and add `parameters: { screenshot: false },` to the `Default` story's top-level object.

(c) Run the Base/Default test only. `exec vitest` forwards flags to Vitest directly (no `--` separator needed — that's only for `pnpm run <script>` indirection). Vitest's `-t` matches a substring of the full test name `Storybook visual regression (React) > Base > Default`, so we use a specific substring:

```bash
pnpm --filter @markput/storybook exec vitest run --project react -t "Base > Default"
```

Expected: the test passes. Because the baseline is deleted, the only way to pass is via the smoke branch — which proves the opt-out is wired correctly.

(d) Revert the `parameters: { screenshot: false }` edit. Re-run the same command:

```bash
pnpm --filter @markput/storybook exec vitest run --project react -t "Base > Default"
```

Expected: now the test fails with a "reference created" message AND writes a fresh `Base-Default-chromium-<platform>.png`. This confirms the screenshot branch is reached when opt-out is absent.

(e) Verify the recreated PNG is identical to what we deleted in (a) — step (d) already recreated it:

```bash
git status packages/storybook/src/pages/__screenshots__/stories.react.spec.tsx/Base-Default-chromium-*.png
```

Expected: either `git status` reports "nothing to commit" (Vitest recreated the same bytes and git detected no change), or the file appears modified but opening it in an image viewer shows identical content. If a real pixel diff has appeared, something drifted during this verification — regenerate cleanly via `pnpm --filter @markput/storybook run test:update`, visually confirm the new PNG still looks right, and commit if needed.

- [ ] **Step 7: Run all repo-wide checks one last time**

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run format
pnpm run build
```

Expected: every command exits 0. If `format` or `lint` reports issues introduced by this work, fix them with `pnpm run format:fix` / `pnpm run lint:fix` and amend the most recent commit touching the affected file.

- [ ] **Step 8: No commit here — this task is verification only**

If every previous step passed, the rollout is complete. If anything failed and required a fix, that fix should land in a small follow-up commit referencing the task, e.g.:

```bash
git commit -m "fix(storybook): address lint finding after VRT rollout"
```

---

## Appendix: DRY / YAGNI notes

- The React and Vue spec files are intentionally **not DRY-ed into a shared helper**. The duplication is ~15 lines of obvious glue; extracting a helper would require generic-over-two-render-functions typing gymnastics. The earlier spec draft that proposed three helper files was reviewed and dropped for this reason.
- No new dependencies. Everything needed (Vitest 4, Playwright, `@faker-js/faker`, Storybook 10) is already in the pnpm catalog.
- Multi-viewport and interaction-state snapshots are deliberately **out of scope** for v1. If the first batch of baselines proves stable, they can be added per-story later.
