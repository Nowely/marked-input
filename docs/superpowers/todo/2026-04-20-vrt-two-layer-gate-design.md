# VRT Structural Snapshot Gate (HTML-only)

## Summary

Replace the entire pixel-comparison VRT suite with a **single structural
gate**: each story renders, its `container.innerHTML` is normalized and
compared to a committed `.html` baseline via Vitest's
`toMatchFileSnapshot`.

All pixel-perfect infrastructure (custom Chromium launch flags, bundled
variable fonts, CSS font/line-height pinning, `toMatchScreenshot` config,
`resolveScreenshotPath`, `allowedMismatchedPixelRatio`, PNG baselines,
`.vitest-attachments/` artifact upload) is **removed**. Visual snapshots
may return later; the door is left open but no infrastructure for them
remains.

## Motivation

Stated acceptance criterion: *"catch system problems like button not
rendered; not pixel-perfect; one baseline per story across macOS/Linux/
Windows."*

After 11 iterations of cross-OS pixel-determinism work (font pinning,
Skia flags, scoped CSS, pointer-events suppression) three Linux CI
failures remain — all sub-pixel dimension drift, none of which represent
real regressions. The pixel path has diminishing returns; the DOM path
fully satisfies the stated goal with a fraction of the infrastructure.

## Design

### Data flow

```
render(<Story />)
  │
  ├─► document.fonts.ready
  ├─► RAF
  ├─► activeElement.blur()
  ├─► RAF
  │
  └─► container.innerHTML
        │
        └─► normalizeHtml
              │
              └─► toMatchFileSnapshot(
                    `<Category>/__screenshots__/<Story>-<framework>.html`
                  )
```

### HTML normalization

New module `packages/storybook/src/pages/_vrt/normalize-html.ts`:

```ts
export function normalizeHtml(html: string): string {
    return html
        // React `useId()` outputs: `:r0:`, `:ra:`, legacy `«ra»`
        .replace(/:r[a-z0-9]+:/g, '__ID__')
        .replace(/«r[a-z0-9]+»/g, '__ID__')
        // Vue scoped-style hashes (8-hex suffix)
        .replace(/\bdata-v-[a-f0-9]{8}\b/g, 'data-v-__HASH__')
        // Collapse inline style whitespace
        .replace(/style="([^"]*)"/g, (_, s) =>
            `style="${s.replace(/\s+/g, ' ').trim()}"`,
        )
        // Collapse inter-tag whitespace
        .replace(/>\s+</g, '><')
        .trim()
}
```

### Spec structure

`screenshots.{react,vue}.spec.{tsx,ts}` keeps its current auto-discovery
(`import.meta.glob` + Storybook's `composeStories`). Per-story `it` body:

```ts
it(name, async () => {
    const {container} = await render(<Story />)

    await document.fonts.ready
    await new Promise(r => requestAnimationFrame(() => r(null)))
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
    }
    await new Promise(r => requestAnimationFrame(() => r(null)))

    const htmlPath =
        `./${category}/__screenshots__/${name}-react.html` // or -vue.html
    await expect(normalizeHtml(container.innerHTML))
        .toMatchFileSnapshot(htmlPath)
})
```

`parameters.screenshot` is dropped entirely — the HTML gate is
sufficiently cheap and deterministic that no opt-out is warranted. A
genuinely unstable story (live network, non-deterministic RNG outside
`faker`) should be fixed, not muted.

### Baseline layout

```
src/pages/<Category>/__screenshots__/
└── <Story>-<framework>.html
```

Same directory as the old PNGs (keeps `.gitignore` rules, editor
configurations, reviewer muscle memory). No `-chromium` segment (not
browser-specific). No `-platform` segment (not OS-specific by
construction).

### Determinism infrastructure (retained)

In `screenshots.{react,vue}.spec.{tsx,ts}` (scoped to VRT specs only,
unchanged from current):

```ts
beforeAll(() => {
    faker.seed(123)
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    document.documentElement.setAttribute('data-vrt', '')
})
```

In `vitest.setup.ts` (trimmed to the rules that still matter for DOM):

```ts
if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = `
        html[data-vrt], html[data-vrt] * {
            pointer-events: none !important;
            transition: none !important;
            animation: none !important;
        }
    `
    document.head.appendChild(style)
}
```

Rationale for what remains:

- `faker.seed(123)` — faker output appears in serialized HTML.
- `vi.setSystemTime` — `new Date()` values appear in HTML.
- `pointer-events: none` — prevents hover-driven inline-style mutations
  (the documented `Nested/InteractiveNested` case: `onMouseEnter` would
  set `style="border: 2px solid #2196f3"`, changing the HTML).
- `transition: none` + `animation: none` — prevents transitional classes
  / inline styles from flipping between render and assertion frames.
- `data-vrt` attribute — scopes the kill-switches to VRT specs; functional
  specs (`Drag`, `Selection`, `Clipboard`) must not inherit
  `pointer-events: none`.

### Infrastructure removed

From `vite.config.ts`:
- `chromiumLaunchOptions` (all four `--font-*` / `--force-color-profile`
  flags).
- `playwright({launchOptions})` — revert to `playwright()` default.
- `screenshotFailures: true`.
- Entire `expect.toMatchScreenshot` config block
  (`comparatorOptions.allowedMismatchedPixelRatio`,
  `resolveScreenshotPath`).
- `viewport`, `headless` can stay (they're Playwright defaults anyway
  but explicit is clearer).

From `vitest.setup.ts`:
- `@fontsource-variable/inter` import.
- `@fontsource-variable/noto-sans` import.
- `font-family`, `line-height: 1.5`, `text-rendering: geometricPrecision`
  CSS rules.
- `vertical-align: top` rule on replaced elements.
- `:focus*` outline reset rules (optional — see "Open choice" below).

From `package.json`:
- `@fontsource-variable/inter` dep.
- `@fontsource-variable/noto-sans` dep.

From `src/pages/**/__screenshots__/`:
- All `*.png` files (via `git rm`).

From `.github/workflows/CI.yml`:
- The "Upload VRT diff artefacts" step (nothing writes there anymore).

From `README.md`:
- "Cross-OS rendering" section — replaced with a brief "Structural
  snapshot" description.
- "Investigating failures" — updated to describe text-diff output.

### Open choice: focus-ring CSS reset

The `html[data-vrt] *:focus, *:focus-visible, *:focus-within { outline:
0 !important; box-shadow: none !important; }` block was there to kill
visible focus rings in rendered PNGs. With HTML-only it serves no
purpose (focus doesn't appear in serialized innerHTML; `aria-*` attrs
related to selection are real state we *do* want to test).

Recommendation: **remove** it for a clean teardown.

## Error handling

- **Baseline missing, no `--update`:** Vitest's default
  `toMatchFileSnapshot` error — "no such file, run with `--update`".
- **Baseline mismatch:** standard Vitest text diff in the test output.
  No artifacts to upload, no download step needed.

## Testing

- Both frameworks (`test:react`, `test:vue`) pass on macOS and Linux CI
  with freshly generated `.html` baselines.
- Sanity checks locally:
  - Delete a DOM node in a story → HTML gate fails with clear text diff.
  - Change story text → HTML gate fails showing the changed text.
  - Regenerate via `test:update` → `.html` rewritten, commit shows diff.

## Rejected alternatives

**A. Keep tolerant screenshot gate alongside HTML.** Two layers were
originally recommended but the user explicitly chose HTML-only,
prioritizing DX simplicity and elimination of pixel-related infra over
catastrophic-visual-regression coverage. Left the door open: the future
addition of a visual gate is a strictly-additive change.

**B. Debug-only screenshot on HTML failure.** Adds half the pixel
infrastructure back for marginal benefit. Declined.

**C. Switch to jsdom / happy-dom.** Tempting given we no longer need
pixel rendering. Deferred — some stories may use real browser APIs
(`getComputedStyle`, `ResizeObserver`, `IntersectionObserver`); migrating
to jsdom requires auditing every story. Can be done as a separate
follow-up if test speed becomes a concern.

**D. Inline `.snap` via `toMatchSnapshot`.** One big `.snap` file per
spec, less reviewable than discrete `.html` files. File-per-story wins.

## Migration

Single PR:

1. Add `_vrt/normalize-html.ts`.
2. Strip pixel infrastructure from `vite.config.ts` (revert to defaults).
3. Strip font + metric CSS from `vitest.setup.ts`; keep only
   `pointer-events / transition / animation` kill-switches.
4. Remove font deps from `packages/storybook/package.json`, run
   `pnpm install`.
5. Rewrite `screenshots.react.spec.tsx` and `screenshots.vue.spec.ts` to
   call `toMatchFileSnapshot` instead of `toMatchScreenshot`. Drop the
   `parameters.screenshot === false` escape hatch.
6. Run `pnpm --filter @markput/storybook test:update` on macOS to
   generate every `.html` baseline.
7. `git rm packages/storybook/src/pages/**/__screenshots__/*.png`.
8. Drop the "Upload VRT diff artefacts" step from `.github/workflows/CI.yml`.
9. Rewrite the "Visual regression" section of `README.md` to describe
   the new structural snapshot.
10. Commit, push, verify green on Linux CI.

## Follow-ups (not in this PR)

- **Visual gate v2** (if ever needed): reintroduce `toMatchScreenshot`
  with the padded custom comparator from the previous design doc
  revision; the `docs/superpowers/todo/2026-04-20-vrt-two-layer-gate-design.md`
  history has the full recipe.
- **jsdom migration**: audit stories for browser-only APIs, switch
  runner, measure speedup. Tracked separately.
- **Diff visualisation**: if text diffs become unwieldy (large HTML),
  ship a small formatter or use Vitest's built-in HTML pretty-print.
