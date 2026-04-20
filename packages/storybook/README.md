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

Baselines do **not** include the OS in their filename — the committed `…-chromium.png` is the single source of truth on every machine (macOS dev, Linux CI, Windows). Three independent pieces have to line up to make this work, and removing any one of them reintroduces drift:

1. **Pinned variable web fonts + fixed metrics**, applied **only during tests** via `vitest.setup.ts` (live `storybook dev` / `storybook build` are unaffected and keep the real system-font look). A `<style>` tag forces `font-family: 'Inter Variable', 'Noto Sans Variable' !important`, `line-height: 1.5 !important`, and `text-rendering: geometricPrecision !important` on `:root *`, plus `vertical-align: top !important` on `:root button, :root img, :root input, :root select, :root textarea, :root svg`. Six deliberate choices:
    - **`@fontsource-variable/inter`** (not `@fontsource/inter`) — one woff2 covers the full weight axis 100–900. A single-weight import lets Chromium synthesise "faux bold" for weights not loaded (AntD uses 600, Rsuite 500), and faux-bold is rasterised differently on each OS → drift returns. Variable font = zero synthesis = deterministic glyphs regardless of which `font-weight` any component asks for.
    - **`@fontsource-variable/noto-sans` as bundled fallback** — Inter covers only Latin / Latin-ext / Cyrillic / Greek / Vietnamese. If a story contains any character outside that range (symbols, box-drawing, arrows, emoji), Chromium falls back to an OS font — `Apple Symbols` on macOS, `DejaVu Sans` / `Symbola` on Linux — which have different metrics and reintroduce dimension drift. Bundling Noto Sans as the next step in the stack means the fallback is also identical per OS. Even if no current story triggers it, it's cheap insurance that prevents a brand-new story with a `✓` or `→` from silently breaking Linux CI.
    - **`:root *` selector (specificity `(0,1,1)`)** — stronger than bare `*` (`(0,0,0)`) so we beat any `.MuiTypography-root !important` or similar class-level `!important` rule that AntD / MUI / Rsuite ship in component CSS. Among `!important` rules the cascade is resolved by specificity first; with bare `*` we'd lose to any `.someClass !important`. Still cheaper than adding a JS-side class on every element.
    - **Universal `*` inside `:root *`** (not a whitelist like `.ant-tag, .rs-tag, …`) — a hand-picked list silently misses any new UI library added later (new AntD component, MUI Chip, custom wrapper). The test environment is isolated, so it's safe to blast everything and guarantee full coverage with zero maintenance.
    - **No generic fallback** (no `, sans-serif` at the end) — a generic fallback hides font-load failures: if both Inter Variable AND Noto Sans Variable fail to load, Chromium would silently fall back to `-apple-system` / `DejaVu Sans`, reintroducing the exact drift we're eliminating. Without a generic fallback, any load regression produces an immediately visible baseline mismatch. `await document.fonts.ready` in the specs guarantees fonts are actually loaded before each screenshot, so this is safe.
    - **`line-height: 1.5` (not `normal`)** — `normal` is resolved by Chromium from the font's OS/2 metrics, and Linux + macOS Chromium disagree on whether to use `sTypoAscender/Descender` or `sWinAscent/Descent`. The choice flips line-box height by 1–2 px, and nested inline-block buttons accumulate it (that's how `Nested/InteractiveNested` ends up +2 px taller on Linux).
    - **`vertical-align: top` on replaced/inline-replaced elements** — eliminates the font-descender whitespace below inline-block baselines (the classic "extra 4 px below img" quirk), which reintroduces drift on nested inline buttons even with `line-height` pinned.
    Every `!important` is load-bearing: AntD and Rsuite push their own font/line-height rules via component CSS that would otherwise win on their own nodes.
2. **Chromium launch flags** (passed to `playwright({launchOptions: {args: [...]}})` in `vite.config.ts` — note the correct API is `playwright()`'s own option, **not** `instances[n].launch`, which is silently ignored):
    - `--font-render-hinting=none` — disables hint-based pixel snapping (default differs per OS)
    - `--disable-font-subpixel-positioning` — forces integer glyph positioning, no ±0.5 px sub-pixel shifts
    - `--disable-lcd-text` — uses grayscale AA instead of RGB sub-pixel AA (sub-pixel AA differs by OS, grayscale is identical)
    - `--force-color-profile=srgb` — pins to sRGB instead of macOS's default display-P3
    Without these, Skia picks different rendering paths on macOS vs Linux and text edges drift 2–7% per story even with the same font. On macOS headless Chromium they're essentially no-ops (headless already uses grayscale AA by default); they exist to normalise Linux down to macOS behaviour.
3. **`comparatorOptions.allowedMismatchedPixelRatio: 0.05`** — soaks up residual CoreGraphics-vs-FreeType AA noise on text edges (macOS Skia uses CoreGraphics font-rasteriser, Linux uses FreeType; the two produce non-identical grayscale AA footprints even with identical metrics). Empirically caps at ~4% on text-heavy stories. Real regressions produce a concentrated 20%+ diff in the affected region, not an even 4% sprinkle, so this threshold does not hide them.

If CI still flakes after all three layers, gather evidence before changing numbers: download the `-diff.png` artefact from `.vitest-attachments/`. If it's a uniform sprinkle of isolated pixels across all text → Skia noise, bump tolerance incrementally. If it's a concentrated block → real layout shift, fix the source.

### Known limitations

- **Chromium only.** Firefox/WebKit are not currently configured. If added, each story will produce an additional baseline per browser.
