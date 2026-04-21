# @markput/storybook

Storybook workspace for `@markput/react` and `@markput/vue`. Stories live under `src/pages/<Category>/*.{react,vue}.stories.{tsx,ts}`.

This package also owns the **visual regression suite**: every Storybook story is rendered in a headless Chromium browser by Vitest, its `container.innerHTML` is normalized, and the result is compared to a committed text baseline. Any unintended structural change fails CI.

## Running

```bash
pnpm --filter @markput/storybook run dev          # start both Storybooks (React :6006, Vue :6007)
pnpm --filter @markput/storybook run test         # run React + Vue tests sequentially
pnpm --filter @markput/storybook run test:react   # React only
pnpm --filter @markput/storybook run test:vue     # Vue only
pnpm --filter @markput/storybook run test:watch   # watch both frameworks in parallel
```

## Visual regression tests

One structural snapshot is generated **per story, per framework**. Discovery is automatic: add a new story file matching `src/pages/<Category>/*.{react,vue}.stories.{tsx,ts}`, export a story, and it will be snapshot-tested on the next run — no spec file edits required.

### How it works

- `src/pages/screenshots.react.spec.tsx` and `src/pages/screenshots.vue.spec.ts` use `import.meta.glob` + Storybook's `composeStories()` to enumerate every story at test time.
- Each story renders inside Vitest's browser mode (Playwright Chromium, viewport `1280×720`, headless).
- The rendered `container.innerHTML` is passed through a normalizer (`src/pages/_vrt/normalize-html.ts`) that strips non-deterministic content (React `useId` outputs, Vue scoped-style hashes, inline-style whitespace, inter-tag whitespace), then compared to a committed baseline at `src/pages/<Category>/__screenshots__/<Story>-<framework>.html`.
- No pixel comparison is performed. The snapshot is a text file, diff-friendly in PRs, identical across macOS / Linux / Windows by construction.

### Determinism

To keep snapshots stable across runs, the two VRT specs (and only them — functional specs keep real timers and unseeded faker) apply:

- `faker.seed(123)` — any `@faker-js/faker` call produces the same output.
- `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime('2026-01-01T00:00:00Z')` — frozen `new Date()` output.
- A `<style>` tag (from `vitest.setup.ts`) applies `pointer-events: none`, `transition: none`, `animation: none` under `html[data-vrt]` during VRT runs only. This prevents hover-driven inline-style changes (e.g. `Nested/InteractiveNested` toggling `border: 1px → 2px` on `onMouseEnter`) and mid-flight CSS transitions from leaking into the serialized HTML.

### Updating baselines

If a story's structure **should** change (intentional UI edit, new story, etc.):

```bash
pnpm --filter @markput/storybook run test:update
```

This runs both frameworks with `vitest --update`, overwriting the `.html` baselines. Review the text diff in your PR — each change should be justified by a code change in the same commit/PR.

Sub-commands exist if you only need one framework:

```bash
pnpm --filter @markput/storybook run test:update:react
pnpm --filter @markput/storybook run test:update:vue
```

### Investigating failures

Snapshot mismatches appear as a standard Vitest text diff in the test output. Read the diff, decide whether the change is intentional, and either fix the source or run `test:update` to accept it.

### Known limitations

- **Structural only.** Pure styling regressions (color change, padding change on CSS classes) that don't alter the DOM are not caught. If you need visual regression coverage for those, see `docs/superpowers/todo/2026-04-20-vrt-two-layer-gate-design.md` for the deferred visual-snapshot-gate design.
- **Chromium only.** Firefox/WebKit are not currently configured.
