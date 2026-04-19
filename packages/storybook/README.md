# @markput/storybook

Storybook workspace for `@markput/react` and `@markput/vue`. Stories live under `src/pages/<Category>/*.{react,vue}.stories.{tsx,ts}`.

This package also owns the **visual regression suite**: every Storybook story is rendered in a headless Chromium browser by Vitest and its rendered DOM is compared to a committed baseline PNG. Any unintended visual change fails CI.

## Running

```bash
pnpm --filter @markput/storybook run dev          # start both Storybooks (React :6006, Vue :6007)
pnpm --filter @markput/storybook run test         # run React + Vue tests sequentially
pnpm --filter @markput/storybook run test:react   # React only
pnpm --filter @markput/storybook run test:vue     # Vue only
pnpm --filter @markput/storybook run test:watch   # watch both frameworks in parallel
```

## Visual regression tests

One screenshot assertion is generated **per story, per framework**. Discovery is automatic: add a new story file matching `src/pages/<Category>/*.{react,vue}.stories.{tsx,ts}`, export a story, and it will be screenshot-tested on the next run — no spec file edits required.

### How it works

- `src/pages/screenshots.react.spec.tsx` and `src/pages/screenshots.vue.spec.ts` use `import.meta.glob` + Storybook's `composeStories()` to enumerate every story at test time.
- Each story renders inside Vitest's browser mode (Playwright Chromium, viewport `1280×720`, headless).
- The rendered container is compared with `toMatchScreenshot()` against a PNG at `src/pages/<Category>/__screenshots__/<Story>-<framework>-chromium.png` — co-located with the story source. Routing is done via a global `resolveScreenshotPath` in `vite.config.ts` that applies only to `screenshots.*.spec.*` files (other browser-mode tests fall through to Vitest's default path). The `<framework>` segment is **not optional**: without it, same-named stories (e.g. `Base-Default`) collide between React and Vue at one shared path. The `-<platform>` suffix that Vitest normally appends is intentionally dropped — one baseline is expected to serve macOS, Linux, and Windows (see "Cross-OS rendering" below).

### Determinism

To keep screenshots stable across runs, the two VRT specs (and only them — functional specs keep real timers + unseeded faker) apply:

- `faker.seed(123)` — any `@faker-js/faker` call produces the same output.
- `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime('2026-01-01T00:00:00Z')` — `Date.now()` / `new Date()` are frozen, but `setTimeout`/`setInterval`/`performance` are left real so `MarkedInput` internals (debouncing, overlay animations) still work.
- Playwright's native `animations: 'disabled'` and `caret: 'hide'` options remove CSS animation and caret-blink noise (provider defaults, nothing to configure).

### Updating baselines

If a story's visual output **should** change (intentional UI edit, new story, etc.):

```bash
pnpm --filter @markput/storybook run test:update
```

This runs both frameworks with `vitest --update`, overwriting the baseline PNGs. Review the diff in your PR — each PNG change should be justified by a code change in the same commit/PR.

Sub-commands exist if you only need one framework:

```bash
pnpm --filter @markput/storybook run test:update:react
pnpm --filter @markput/storybook run test:update:vue
```

### Opting a story out of screenshotting

Some stories are inherently unstable (random animation seeds, live network data, etc.). Opt out by setting `parameters.screenshot: false` in the story:

```ts
export const MyStory = {
    args: {
        /* … */
    },
    parameters: {screenshot: false},
}
```

The test still renders the story (asserting non-empty `textContent`), so broken stories are caught — but no pixel comparison is performed.

### Investigating failures

When a screenshot assertion fails, Vitest writes three PNGs to `.vitest-attachments/`:

- `*-actual.png` — what the test just rendered
- `*-reference.png` — the committed baseline it was compared against
- `*-diff.png` — pixel diff (red = mismatch)

Open all three to decide: did the UI genuinely change (→ regenerate baselines and commit) or did an intentional change leak visual noise (→ fix the source)? The `.vitest-attachments/` directory is `.gitignore`d — never commit these.

### Cross-OS rendering

Baselines do **not** include the OS in their filename — the committed `…-chromium.png` is meant to be the single source of truth on every machine (macOS dev, Linux CI, Windows). Chromium's own font rendering is largely deterministic across OSes when using the same font stack, but small sub-pixel drift is still possible.

If CI on Linux reports mismatches that reviewers agree are not real UI regressions (e.g. 1–2 px of antialiasing drift), the mitigation is to relax pixel strictness in `vite.config.ts`:

```ts
expect: {
    toMatchScreenshot: {
        comparatorOptions: {allowedMismatchedPixelRatio: 0.01},
        resolveScreenshotPath: /* … */,
    },
},
```

Start with the smallest ratio that passes CI and bump only when genuinely needed — the higher it goes, the more real regressions slip through. Do not regenerate Linux-specific baselines; the goal is one baseline per story+framework, period.

### Known limitations

- **Chromium only.** Firefox/WebKit are not currently configured. If added, each story will produce an additional baseline per browser.
