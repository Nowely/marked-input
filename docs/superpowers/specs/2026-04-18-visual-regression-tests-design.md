# Visual Regression Tests for Every Storybook Story

## Problem

The monorepo has 18 Storybook story files split across React and Vue, covering every public configuration of `MarkedInput`. Today the automated coverage for these stories is a shallow smoke check (`stories.react.spec.tsx`, `stories.vue.spec.ts`) that only asserts `container.textContent.length > 0`. Purely visual regressions — broken layout, overlay positioning bugs, CSS drift from dependency bumps, rendering differences between React and Vue adapters — cannot be caught by the current suite.

A partial stub (`createVisualTests.react.ts`) already hints at `expect(container).toMatchScreenshot()`, but it is not wired into any spec and has no Vue counterpart.

## Goal

Automatically produce a screenshot-based regression test for **every Storybook story** in both framework projects, with zero manual maintenance as stories are added, renamed, or deleted. The tests run as part of the existing `pnpm test` invocation — no new runner, no extra CI service.

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
| Loki / reg-suit | Older, less active, would still need to be layered onto Playwright. |

Vitest 4's matcher natively understands Playwright's screenshot options, embeds environment metadata (OS, browser, viewport) in the PNG header, and refuses to compare across mismatched environments — exactly the behavior required to make "commit baselines locally" safe.

## Architecture

### Flow

```
pnpm test
  └─ packages/storybook: pnpm run test
       ├─ vitest run --project react
       │    └─ stories.react.spec.tsx
       │         └─ import.meta.glob('./**/*.react.stories.tsx')
       │              └─ for each story → composeStories → render → toMatchScreenshot()
       └─ vitest run --project vue
            └─ stories.vue.spec.ts  (mirror, via createVisualTests.vue.ts)
```

### Files that change or are created

| File | Change |
|---|---|
| `packages/storybook/src/shared/lib/createVisualTests.ts` | **New.** Framework-agnostic test factory: takes `{ stories, render, kind }` and emits a `describe` containing one `it` per story that renders and calls `toMatchScreenshot()`. |
| `packages/storybook/src/shared/lib/createVisualTests.react.ts` | **Rewritten.** Thin adapter; provides the React render function from `vitest-browser-react`. |
| `packages/storybook/src/shared/lib/createVisualTests.vue.ts` | **New.** Vue counterpart; provides the Vue render function from `vitest-browser-vue`. |
| `packages/storybook/src/pages/stories.react.spec.tsx` | **Rewritten.** Auto-discover every `*.react.stories.tsx`, call the helper per file, iterate composed stories, emit one visual test per story. |
| `packages/storybook/src/pages/stories.vue.spec.ts` | **Rewritten.** Same pattern for Vue. |
| `packages/storybook/vitest.setup.ts` | **Extended.** Add anti-flake global setup (see below). |
| `packages/storybook/package.json` | **Extended.** Add `test:update` scripts. |
| Root `package.json` | **Extended.** Add `update-screenshots` alias: `pnpm -F @markput/storybook run test:update`. |
| `packages/storybook/.gitignore` | **Extended.** Ignore diff artifacts (`failure-*.png`) but keep baselines tracked. |
| `packages/storybook/README.md` | **New.** Document the visual-test workflow: how to update, where baselines live, known OS constraints. |

### Baseline layout

Baselines live co-located next to the spec, using Vitest 4's default directory naming. Each framework project writes into its own subtree because the spec files differ:

```
packages/storybook/src/pages/
  __screenshots__/
    stories.react.spec.tsx/
      chromium/
        BaseDefault.png
        BaseConfigured.png
        BaseAutocomplete.png
        AntDefault.png
        ...
    stories.vue.spec.ts/
      chromium/
        BaseDefault.png
        ...
```

Story names follow the pattern `<CategoryFolder><StoryExport>` (derived during discovery — see "Naming" below).

### Auto-discovery

The two spec files each use `import.meta.glob` eagerly to pull in every story module. For each module:

1. Derive `category` from the file path (`./Base/Base.react.stories.tsx` → `Base`).
2. `composeStories(module)` to get a map of `{ exportName: StoryComponent }`.
3. For each `(exportName, Story)`, emit `it(\`Story \${category}/\${exportName}\`, ...)` that renders the story and calls `toMatchScreenshot(\`\${category}\${exportName}\`)`.

Opt-out: if `Story.parameters?.screenshot === false`, skip the visual assertion but still keep a trivial render assertion (so the smoke coverage is preserved for excluded stories).

### Anti-flake setup (`vitest.setup.ts`)

The component under test is a contenteditable input, and several stories (`Material`, `Overlay`, `Dynamic`) render animated overlays, random faker-driven data, or time-sensitive content. To make snapshots reproducible we install four global guards before any test runs:

1. **Determinism**
   - `faker.seed(123)` — fixes every faker-sourced story.
   - `vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))` — freezes clock-based stories.
2. **Style normalisation**
   Inject a stylesheet into the browser page with:
   ```css
   *, *::before, *::after {
     animation: none !important;
     transition: none !important;
     caret-color: transparent !important;
     scroll-behavior: auto !important;
   }
   ```
   This kills the blinking caret (the single biggest source of contenteditable flake) and any CSS animations on Ant/Material/Rsuite wrappers.
3. **Font readiness**
   In the helper, before each screenshot: `await document.fonts.ready` and one `requestAnimationFrame` tick to flush layout.
4. **Matcher defaults**
   Pass a shared `{ screenshotOptions, comparatorOptions }` object to `toMatchScreenshot`:
   - `screenshotOptions.timeout: 5_000`
   - `screenshotOptions.animations: 'disabled'`
   - `comparatorOptions.allowedMismatchedPixelRatio: 0.002` (0.2% — tolerates sub-pixel antialiasing drift but catches real regressions)

### Integration with `pnpm test`

Nothing changes at the root. `pnpm test` already calls `pnpm -r run test`, which already calls the storybook package's `test` script, which already runs both `react` and `vue` projects. The new tests simply replace the existing shallow assertions inside the discovered spec files. First run after this change will produce all baselines; subsequent runs compare.

### Update workflow

Contributor changes a story or a style, runs `pnpm test`, sees a failure with a diff PNG written alongside the baseline. Two resolutions:

- If the diff is intentional: `pnpm update-screenshots` regenerates baselines; contributor reviews the resulting PNGs and commits them.
- If the diff is an unintended regression: fix the code, rerun `pnpm test`.

Diff artifacts (`failure-*.png`, `diff-*.png`) are gitignored so only canonical baselines are tracked.

## Data / interfaces

### `createVisualTests` (framework-agnostic core)

```ts
interface CreateVisualTestsArgs<M, C> {
  category: string                          // e.g. "Base"
  stories: Record<string, C>                // from composeStories(module)
  render: (Story: C) => Promise<{ container: HTMLElement }>
  shouldSkip?: (Story: C) => boolean        // parameters.screenshot === false
}

export function createVisualTests<M, C>(args: CreateVisualTestsArgs<M, C>): void
```

The React and Vue adapters are one-line bindings that pre-fill `render`.

### Naming convention

Test IDs and screenshot filenames use `<Category><StoryName>` (PascalCase, no separator) so baselines are filesystem-friendly and collisions between two categories with the same story export name are impossible. The visible `it` description uses the human-readable form: `Story Base / Default`.

### Story opt-out

```ts
export const FlakyStory: Story = {
  args: { /* ... */ },
  parameters: { screenshot: false },
}
```

## Error handling

- **No baseline yet** — first run in a fresh checkout. Vitest creates the baseline and reports it as created, not failed, provided the runner is invoked with `--update` (documented in README for bootstrapping). On normal runs, a missing baseline is a failure with a clear message telling the contributor to run `pnpm update-screenshots`.
- **Environment mismatch** — Vitest 4 refuses to compare PNGs whose embedded metadata (OS, browser, DPR) does not match the current run. The matcher reports an explicit "env mismatch" error; contributor regenerates baselines on the correct OS.
- **Story throws during render** — already handled by Vitest; test fails before the screenshot assertion.
- **Over-tight tolerance catching real antialiasing drift** — `allowedMismatchedPixelRatio: 0.002` starts conservative; if a specific story is legitimately flakier (e.g. emoji rendering) we raise it per-story via story-level parameters passed to the helper.

## Testing

The visual tests **are** the test coverage. To verify the setup itself works:

1. Manual: run `pnpm update-screenshots`, inspect a few generated PNGs, commit.
2. Manual: temporarily change a CSS rule in `packages/react/markput/src/components/Container.tsx`, run `pnpm test`, confirm the affected stories fail with diffs.
3. Manual: run `pnpm test` a second time with no changes, confirm all pass.
4. Manual: add `parameters: { screenshot: false }` to one story, run `pnpm test`, confirm it is skipped (but the smoke assertion still runs).

No new unit tests are added — the helper is exercised directly by the integration suite.

## Risks & follow-ups

- **OS baseline divergence**: contributors on different operating systems may produce different baselines. Documented in the README. If it becomes painful, fallback plan is a Dockerised baseline-generation target (`pnpm update-screenshots:docker`).
- **CI not yet defined**: there is no GitHub Actions workflow in the repo that runs `pnpm test` in a reproducible OS. This spec doesn't introduce one — that's a separate concern. When CI is added, baselines will need to match its OS.
- **Snapshot bloat**: ~50-80 PNGs at ~50 KB each → ~3-4 MB total. Acceptable in git; revisit if it grows past 20 MB.
- **Future work** (explicitly out of scope): multi-viewport snapshots, focus-state snapshots, overlay-open snapshots, Storybook `play` function integration for interactive states.

## Rollout

Single PR:

1. Land the helper refactor, spec rewrites, anti-flake setup, gitignore, scripts, and README.
2. Run `pnpm update-screenshots` locally to generate all baselines.
3. Commit baselines in the same PR.
4. CI (when it exists) or reviewers verify the baselines look correct.
