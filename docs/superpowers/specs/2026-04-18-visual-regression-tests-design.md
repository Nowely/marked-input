# Visual Regression Tests for Every Storybook Story

> Revised 2026-04-18 after DX-focused subagent review (see Appendix A at the bottom of this file).

## Problem

The monorepo has 18 Storybook story files split across React and Vue, covering every public configuration of `MarkedInput`. Today the automated coverage for these stories is a shallow smoke check (`stories.react.spec.tsx`, `stories.vue.spec.ts`) that only asserts `container.textContent.length > 0`. Purely visual regressions — broken layout, overlay positioning bugs, CSS drift from dependency bumps, rendering differences between React and Vue adapters — cannot be caught by the current suite.

A partial stub (`createVisualTests.react.ts`) already hints at `toMatchScreenshot()`, but it is not wired into any spec and has no Vue counterpart.

## Goal

Automatically produce a screenshot-based regression test for **every Storybook story** in both framework projects, with zero manual maintenance as stories are added, renamed, or deleted. The tests run as part of the existing `pnpm test` invocation — no new runner, no extra CI service, no new dependencies.

## Non-goals

- Running visual tests in a SaaS service (Chromatic, Percy, Applitools).
- Multi-viewport / multi-browser coverage at launch (can be added per-story later).
- Interaction-state snapshots — only the **initial render** of each story is captured in v1.
- Modifying framework package sources (`@markput/core|react|vue`). This work lives entirely inside `packages/storybook/`.

## Approach

Use **Vitest 4's built-in `toMatchScreenshot()`** matcher inside the existing Browser Mode configuration (Playwright + Chromium, two `defineProject` entries for `react` / `vue`). This reuses every piece of infrastructure already in the repo: project splitting, story composition, framework-specific preview annotations, and the `pnpm test` entry point.

### Why not the alternatives

| Option | Why rejected |
|---|---|
| Storybook Test Runner | Requires a running Storybook server, introduces a second runner, duplicates story composition. |
| Playwright Test directly | Duplicates the runner + config and the story-mounting layer we already built on Vitest Browser Mode. |
| Chromatic / Percy | Out of scope — the user wants local, committed baselines; no SaaS. |
| Third-party helpers (`storybook-addon-vis`, `@storycap-testrun/browser`) | Add dependencies and opinions for marginal benefit over the ~40 lines of glob+compose already in the repo. AGENTS.md forbids new deps without explicit approval. |

## Architecture

### Flow

```
pnpm test
  └─ packages/storybook: pnpm run test
       ├─ vitest run --project react
       │    └─ stories.react.spec.tsx
       │         └─ import.meta.glob('./**/*.react.stories.tsx')
       │              └─ for each story → composeStories → render
       │                   → await expect.element(container).toMatchScreenshot()
       └─ vitest run --project vue
            └─ stories.vue.spec.ts  (same pattern, framework-swapped)
```

### Files that change or are created

| File | Change |
|---|---|
| `packages/storybook/src/pages/stories.react.spec.tsx` | **Rewritten.** Existing auto-discovery stays; each generated `it` now calls `await expect.element(container).toMatchScreenshot()` with a story-aware test title. |
| `packages/storybook/src/pages/stories.vue.spec.ts` | **Rewritten.** Same change for Vue. |
| `packages/storybook/src/shared/lib/createVisualTests.react.ts` | **Deleted.** The stub helper is redundant once the two spec files are the single source of truth. Removing it reduces file count and indirection. |
| `packages/storybook/vitest.setup.ts` | **Extended.** Seed faker and freeze system time so random/clock-driven stories stabilise. |
| `packages/storybook/vite.config.ts` | **Extended.** Set global `test.browser.expect.toMatchScreenshot` defaults (screenshot options + comparator tolerance) so every call site inherits them. |
| `packages/storybook/package.json` | **Extended.** Add a `test:update` script that runs `vitest run --update` across both projects. |
| `packages/storybook/.gitignore` | **Extended.** Ignore Vitest's attachment artifacts (`.vitest-attachments/`) so only canonical baselines are tracked. |
| `packages/storybook/README.md` | **New.** Document the visual-test workflow: how to update baselines, where they live, how to interpret diffs, known OS constraints. |

Notably, **no new helper files are added**. The helper split that an earlier draft proposed (`createVisualTests.ts` + `.react.ts` + `.vue.ts`) added three files of indirection for ~5 lines of shared code. Inlining `toMatchScreenshot` into the existing two auto-discovery specs is simpler, discoverable, and easier to debug.

### Baseline layout

Vitest 4's default screenshot path resolution is:

```
<testFileDirectory>/__screenshots__/<testFileName>/<testName>-<browser>-<platform>.png
```

Concretely in this repo:

```
packages/storybook/src/pages/
  __screenshots__/
    stories.react.spec.tsx/
      Base-Default-chromium-darwin.png
      Base-Configured-chromium-darwin.png
      Ant-Default-chromium-darwin.png
      ...
    stories.vue.spec.ts/
      Base-Default-chromium-darwin.png
      ...
```

- Browser and platform are encoded in the **filename**, not in a subdirectory. Two different OSes can commit their baselines side-by-side if we ever need to.
- Each call site passes an explicit short name `\`${category}-${storyExport}\`` to `toMatchScreenshot()`. Without it, Vitest would derive the filename from the full nested `currentTestName` (`"Storybook visual regression (React) > Base > Default"`) which produces ugly, noisy filenames and makes `git diff` on baselines painful. The short explicit name gives clean diffs while still matching the test hierarchy 1:1.

### Auto-discovery

The two spec files each use `import.meta.glob` eagerly to pull in every story module. For each module:

1. Derive `category` from the file path (`./Base/Base.react.stories.tsx` → `Base`).
2. `composeStories(module)` to get a map of `{ exportName: StoryComponent }`.
3. For each `(exportName, Story)`, emit `it(\`\${category} > \${exportName}\`, …)` that renders the story and calls `await expect.element(container).toMatchScreenshot()`.

Opt-out: if `Story.parameters?.screenshot === false`, swap the visual assertion for a trivial `expect(container.textContent.length).toBeTruthy()` smoke check.

### Anti-flake setup

Three layers, in order of priority:

1. **Determinism** (`vitest.setup.ts`)
   - `faker.seed(123)` — fixes every faker-sourced story.
   - `vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))` — freezes clock-based stories.
   - No CSS injection. Playwright already handles the noisy pieces via defaults (see next layer).
2. **Playwright-native stabilisation** (global config in `vite.config.ts`)
   ```ts
   test: {
     browser: {
       expect: {
         toMatchScreenshot: {
           // timeout is a top-level matcher option, NOT a screenshotOptions key
           timeout: 5_000,
           screenshotOptions: {
             animations: 'disabled',   // default for Playwright provider but set explicitly for clarity
             caret: 'hide',            // kills blinking contenteditable caret
           },
           comparatorName: 'pixelmatch',
           comparatorOptions: {
             allowedMismatchedPixelRatio: 0.002,  // 0.2% — tolerates sub-pixel antialiasing drift
           },
         },
       },
     },
   }
   ```
   Every `toMatchScreenshot()` call inherits these defaults; individual tests can override if needed.
3. **Layout flush** (inline in each auto-generated test, just before the assertion)
   ```ts
   await document.fonts.ready
   await new Promise(r => requestAnimationFrame(r))
   ```
   Ensures fonts are loaded and one paint has flushed.

### Integration with `pnpm test`

Nothing changes at the root. `pnpm test` already calls `pnpm -r run test`, which already calls the storybook package's `test` script, which already runs both `react` and `vue` projects. The new tests simply replace the existing shallow assertions inside the discovered spec files. First run after this change will produce all baselines; subsequent runs compare.

### Update workflow

Two invocation styles, both documented in the README:

- **Batch update:** `pnpm --filter @markput/storybook run test:update` (or from inside that package, `pnpm run test:update`). Script definition: `"test:update": "vitest run --project react --update && vitest run --project vue --update"`.
- **Interactive update:** contributors already using `pnpm test:watch` can press `u` to update baselines (Vitest's built-in watch-mode shortcut).

We deliberately do **not** add a root-level `pnpm update-screenshots` alias — it adds a naming-convention burden and discoverability is already handled by the README.

### How diffs are surfaced

The current `packages/storybook/vite.config.ts` sets `screenshotFailures: false`, which suppresses Vitest Browser's automatic "capture on failure" for interaction tests. This is **fine** for VRT — on a `toMatchScreenshot` mismatch Vitest 4 writes three attachments (`reference`, `actual`, `diff`) to `.vitest-attachments/<testId>/` and lists their paths in the terminal error output. Contributors click / open those files to inspect diffs. The README documents this path.

## Data / interfaces

### Test shape (reference implementation)

```ts
// packages/storybook/src/pages/stories.react.spec.tsx (illustrative — see plan for final code)
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {page} from 'vitest/browser'
import {render} from 'vitest-browser-react'

const storyModules = import.meta.glob('./**/*.react.stories.tsx', {eager: true})

// ... group by category path (see plan) ...

describe('Storybook visual regression (React)', () => {
  for (const [category, stories] of /* discovered */ []) {
    describe(category, () => {
      for (const [name, Story] of Object.entries(stories)) {
        it(name, async () => {
          const {container} = await render(<Story />)
          await document.fonts.ready
          await new Promise(r => requestAnimationFrame(() => r(null)))

          if (Story.parameters?.screenshot === false) {
            expect(container.textContent?.length).toBeTruthy()
            return
          }

          await expect.element(page.elementLocator(container)).toMatchScreenshot(`${category}-${name}`)
        })
      }
    })
  }
})
```

The Vue variant is structurally identical, importing from `@storybook/vue3-vite` and `vitest-browser-vue`.

### Story opt-out

```ts
export const FlakyStory: Story = {
  args: { /* ... */ },
  parameters: { screenshot: false },  // VRT skipped; smoke assertion still runs
}
```

## Error handling

- **No baseline yet (first run in a fresh checkout or after a new story is added).** Vitest 4 writes the reference automatically, then marks the test as failed with a message instructing the contributor to review the new PNG and re-run. Second invocation passes (assuming the reference was sound). This matches Vitest's documented behaviour: there is no `--update` flag needed for *initial* baseline creation. The README explains this so the first-run failure isn't confusing.
- **Story throws during render.** Already handled by Vitest; test fails before the screenshot assertion.
- **Over-tight tolerance catching real antialiasing drift.** `allowedMismatchedPixelRatio: 0.002` starts conservative; raise per-test via a second argument to `toMatchScreenshot` if a specific story is legitimately flakier (e.g. emoji rendering).
- **Overlay / portal clipping.** `MarkedInput`'s suggestion overlays can render outside the `container` element. In v1 we assert on `container` only, which means overlay positioning regressions are not caught for the initial-render-only stories. If a future story needs overlay coverage, it should use `page` as the locator (full-viewport screenshot) plus `screenshotOptions.mask` to hide any dynamic regions. Documented in the README for future reference.
- **React 19 strict-mode double rendering.** Our setup doesn't wrap stories in `<StrictMode>`, so this isn't active today. If a future change adds it, animations would run twice during mount — Playwright's `animations: 'disabled'` already handles this, so no extra mitigation is needed.

## Testing

The visual tests **are** the test coverage. To verify the setup itself works, a human verifies these four scenarios manually during the rollout PR:

1. Run `pnpm --filter @markput/storybook run test:update` on a fresh checkout, inspect a representative sample of generated PNGs, commit.
2. Temporarily change a CSS rule in `packages/react/markput/src/components/Container.tsx`, run `pnpm test`, confirm the affected stories fail with diffs written to `.vitest-attachments/`.
3. Run `pnpm test` a second time with no changes, confirm all pass.
4. Add `parameters: { screenshot: false }` to one story, run `pnpm test`, confirm it is skipped but still runs the smoke assertion.

No new unit tests are added — the helper is exercised directly by the integration suite.

## Risks & follow-ups

- **OS baseline divergence.** Contributors on different operating systems may produce different baselines; Vitest's filename suffix (`-chromium-darwin`, `-chromium-linux`) keeps them from overwriting each other. Documented in the README. Fallback plan if it becomes painful: a Dockerised baseline-generation target.
- **CI not yet defined.** No GitHub Actions workflow runs `pnpm test` in a reproducible OS today. This spec doesn't introduce one — that's a separate concern. When CI is added, baselines for that OS will need to be committed.
- **Snapshot size.** ~50–80 PNGs at ~50 KB each → ~3–4 MB in git. Acceptable; revisit if it grows past 20 MB.
- **Future work** (explicitly out of scope): multi-viewport snapshots, focus-state snapshots, overlay-open snapshots, Storybook `play` function integration for interactive states.

## Rollout

Single PR:

1. Land the spec rewrites (inline `toMatchScreenshot` in both spec files, delete the stale stub), the global `toMatchScreenshot` config in `vite.config.ts`, the determinism setup in `vitest.setup.ts`, the `test:update` script, the gitignore update, and the README.
2. Run `pnpm --filter @markput/storybook run test:update` locally to generate all baselines.
3. Commit baselines in the same PR.
4. Reviewers scan the generated PNGs for sanity (no obviously wrong-looking story).

---

## Appendix A — Review log

**Round 1 review (DX / simplicity lens, 2026-04-18):**
- Corrected baseline path format (Vitest encodes browser+platform in filename, not in a subdirectory).
- Corrected first-run semantics (Vitest writes + fails on missing baseline; no `--update` bootstrap).
- Switched matcher API to `await expect.element(locator).toMatchScreenshot()` — the documented form with retry semantics.
- Dropped global CSS injection — Playwright's `animations: 'disabled'` + `caret: 'hide'` already cover it.
- Dropped the `createVisualTests` helper split entirely — the two auto-discovery spec files are simpler inlined.
- Dropped custom `<Category><Export>` PascalCase screenshot naming. Now passes a simple hyphenated `${category}-${storyExport}` arg to keep filenames clean without relying on Vitest's verbose auto-derived name.
- Dropped the root-level `pnpm update-screenshots` alias — a package-scoped `test:update` is more conventional.
- Added note on `screenshotFailures: false` interaction with VRT and where diffs are written (`.vitest-attachments/`).
- Added portal/overlay clipping caveat.
- Reframed Storybook references to v10 (the actual version in the pnpm catalog).
