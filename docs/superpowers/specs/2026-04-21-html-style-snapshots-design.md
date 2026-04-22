# HTML + Computed Style Snapshots Design

Iteration: v5 (final — post deep-review #3)

## Goal

Replace the current smoke tests (`stories.react.spec.tsx`, `stories.vue.spec.ts`) with snapshot tests that capture rendered HTML and a tightly scoped subset of computed styles for every Storybook story. Tests must be **stable across Windows, Linux, and macOS CI runners** and survive routine dependency updates with predictable churn.

## Pinned environment (single source of truth)

The spec is tied to the versions currently in `packages/storybook/package.json` and `pnpm-workspace.yaml`:

- React 19 (`react ^19.2.4`), Vue 3.5 (`vue ^3.5.31`)
- Playwright `^1.59.1`, Vitest `^4.1.2`, `@vitest/browser-playwright ^4.1.2`
- Ant Design 6.x (`antd ^6.3.4`), MUI 7.x (`@mui/material ^7.3.7`), RSuite 6.x (`rsuite ^6.1.2`)
- Emotion 11 (`@emotion/react ^11.14.0`, `@emotion/styled ^11.14.1`)
- Browser: Chromium (Playwright bundle), headless, viewport `1280x720`

Any bump to these will be treated as a versioned snapshot migration (see §CI / snapshot lifecycle).

## Non-goals

- Pixel-level visual regression (covered by `toMatchScreenshot` where needed)
- Interactive states (`:hover`, `:focus-visible`, `:active`)
- Portal, Shadow-DOM, `<iframe>`, `<canvas>`, `<video>` content outside the story render root (Phase 3, deferred)
- Cross-browser comparison
- Any regression that manifests only in length-valued CSS properties (colors, sizes, spacing) — screenshots own that

## Hard constraints

Computed values that drift across OS, theme, or Chromium version are **out of scope**:

1. Font metrics: text shaping, glyph substitution, subpixel rounding
2. Color scheme & forced colors: `prefers-color-scheme`, `forced-colors`
3. Chromium minor version: new CSS properties, new keyword values, enumeration order

The allow-list (§Phase 2) only contains properties whose resolved computed value is a **keyword** or a small fixed enumeration.

## Context

- Storybook tests run via Vitest Browser Mode + Playwright Chromium (`packages/storybook/vite.config.ts`).
- Current smoke tests only assert `container.textContent.length > 0`.
- The unused `createVisualTests.react.ts` helper will be removed.
- Stories exercise CSS-in-JS component libraries (Ant, Material, RSuite, overlays) that emit hashed class names and scoped-style attributes — the HTML snapshot must normalize these.

## Phased rollout

| Phase | Scope | Goal | Ship independently? |
|-------|-------|------|---------------------|
| 1 | HTML snapshot (normalized) | Structural regression net | **Yes** — does not depend on the Phase 2 sandbox |
| 2 | Keyword-only computed-style diff | Mode / state regression net | Only after Phase 1 is stable in CI |
| 3 | Opt-in portal capture | MUI/Ant/Radix overlays | Deferred; design when a story needs it |

## Files

- **Create** `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts` — deterministic DOM→string serializer (explicitly not `innerHTML`) + attribute scrubber
- **Create** `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts` — fixture tests, one per table row
- **Create** `packages/storybook/src/shared/lib/snapshot/captureStyles.ts` — keyword-only computed-style capture (Phase 2)
- **Create** `packages/storybook/src/shared/lib/snapshot/captureStyles.spec.ts` — browser-mode tests for the helper
- **Create** `packages/storybook/src/shared/lib/snapshot/stableProps.ts` — keyword-only allow-list + deny-list knobs
- **Create** `packages/storybook/src/shared/lib/snapshot/stableKey.ts` — element identity key (path + local anchor + index, see §Stable identity)
- **Create** `packages/storybook/src/shared/lib/snapshot/sandbox.ts` — iframe sandbox with fixture-subtree defaults per tag
- **Create** `packages/storybook/src/shared/lib/snapshot/settle.common.ts` — shared settle primitives (microtask drain, dual-rAF, `vi.waitFor` wrapper)
- **Create** `packages/storybook/src/shared/lib/snapshot/settle.react.ts` — React settling helper (imports `settle.common`)
- **Create** `packages/storybook/src/shared/lib/snapshot/settle.vue.ts` — Vue settling helper (imports `settle.common`)
- **Modify** `packages/storybook/vite.config.ts` — extend `include` to cover `src/shared/lib/**/*.spec.ts(x)` in both the `react` and `vue` projects (see §Test inclusion)
- **Modify** `packages/storybook/vitest.setup.ts` — inject determinism preamble
- **Modify** `packages/storybook/src/pages/stories.react.spec.tsx` — replace smoke assertion with HTML snapshot (Phase 1); later add styles (Phase 2)
- **Modify** `packages/storybook/src/pages/stories.vue.spec.ts` — same, calling `settle.vue.ts`
- **Add** `.gitattributes` — enforce LF for `*.snap`
- **Remove** `packages/storybook/src/shared/lib/createVisualTests.react.ts`

### Test inclusion (blocker from review #2)

The current `vite.config.ts` only includes `src/pages/**/*.{react,vue}.spec.{tsx,ts}`. Helper specs under `src/shared/lib/snapshot/` must be added:

```ts
// in each defineProject()
include: [
  'src/pages/**/*.<framework>.spec.<ext>',
  'src/shared/lib/snapshot/*.spec.ts',     // framework-agnostic browser DOM tests
  'src/shared/lib/snapshot/*.<framework>.spec.ts', // settle.<framework>.spec.ts
]
```

Framework-agnostic helper specs run in **both** projects so the helpers are verified under both bundling setups. `settle.react.spec.ts` / `settle.vue.spec.ts` are project-scoped.

## Determinism preamble (global, applied by `vitest.setup.ts`)

### Document-level
- `document.documentElement.lang = 'en'`
- `document.documentElement.dir = 'ltr'`
- `<meta name="color-scheme" content="light">` added to `<head>`
- Playwright: `page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', forcedColors: 'none' })` invoked once per test context

### Global CSS (single `<style>` in `<head>`)

```css
:root {
  color-scheme: light only;
  forced-color-adjust: none;
}
html, body { margin: 0; padding: 0; }
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}
```

Rationale for each rule is documented inline in `vitest.setup.ts`. No webfont is bundled — the allow-list excludes all font-metric-sensitive properties, so font fallbacks do not affect snapshots.

### React production mode

React's `useId` format differs between `development` and `production` (`«r7»` vs `:r7:`). To avoid normalizing both forms, Storybook tests run against the **production** React bundle:

```ts
// vite.config.ts, inside the react defineProject()
define: { 'process.env.NODE_ENV': JSON.stringify('production') }
resolve: { conditions: ['production', 'default'] }
```

Two mechanisms — `resolve.conditions` selects the production bundle; `define` covers any dependency that still branches on `NODE_ENV` at runtime. The pin is verified by a dedicated browser test in `normalizeHtml.spec.ts`:

```ts
it('React useId emits production format', () => {
  render(<ProbeComponent />) // calls useId() and writes to data-probe-id
  expect(probe.getAttribute('data-probe-id')).toMatch(/^:r[0-9a-z]+:?$/)
})
```

If React later changes the prod format, this test fails loudly and the normalization table row #10 is updated.

### Settling

Story-specific gate: if a story exposes `[data-test-snapshot-ready]` on any rendered element, `settle` waits for it. Otherwise it uses the default chain:

- **React** (`settle.react.ts`): `queueMicrotask` → 2×`requestAnimationFrame` → `await act(async () => {})` → `vi.waitFor(() => !container.querySelector('[aria-busy="true"], [data-loading]'), { timeout: 1000 })`
- **Vue** (`settle.vue.ts`): `queueMicrotask` → `await nextTick()` → 2×`requestAnimationFrame` → same `vi.waitFor`

Each helper is imported **only** by its framework's spec file — no cross-framework import graph. Shared primitives (microtask drain, dual-rAF, `vi.waitFor` call) live in a pure helper `settle.common.ts`.

Stories that gate visible state on CSS transitions (neutralized to 0s by the preamble) must expose `[data-test-snapshot-ready]`. This is a **hard requirement** — documented in:

- JSDoc of `settle.react.ts` and `settle.vue.ts`
- A checklist item in `packages/storybook/README.md` (new section "Writing a snapshot-safe story")
- Runtime: `settle` throws with a diagnostic message when `vi.waitFor` exceeds 1 s, pointing the author to the checklist

Dev-time signal beyond the runtime timeout is out of scope for this spec (no ESLint rule is added). Authors learn at test-write time via the checklist and at test-run time via the timeout.

## Phase 1: HTML snapshot

### API

```ts
function normalizeHtml(root: Element): string
```

### Serializer (walks the DOM, does not use `innerHTML`/`outerHTML`)

Output is pretty-printed pseudo-XML: one element per line, 2-space indent, text nodes on their own line. Explicit rules for every edge case raised in review:

1. **Root inclusion**: visit `root` itself first, then descendants.
2. **Element name casing**: `localName` lowercased for HTML. For SVG/MathML namespaces, preserve the original case from `tagName` (so `viewBox`, `clipPathUnits` survive).
3. **Namespace prefix**: prepend `svg:` / `math:` to elements whose `namespaceURI` is the SVG or MathML namespace, so HTML `<a>` and SVG `<a>` never collide.
4. **Attributes**:
   - Collect via `Element.attributes`.
   - Apply the attribute normalization table (below).
   - **Sort by full attribute name** (including any namespace prefix like `xlink:href`, `xml:lang`, `xmlns`, `xmlns:xlink`) using **UTF-16 code-unit lexicographic order** (plain `Array.prototype.sort` on attribute-name strings). `String.prototype.localeCompare` must not be used — locale-aware sorts drift across OS ICU versions.
   - Emit in the form `name="value"`. Escape `&`, `"`, `<`, and `>` in values via named entities (`&amp;`, `&quot;`, `&lt;`, `&gt;`). `>` escaping is added so the pseudo-XML output parses under strict XML tooling.
   - Boolean HTML attributes (`disabled`, `checked`, `readonly`, `selected`, `hidden`, `required`, `autofocus`, `multiple`, `open`, `defer`, `async`, `nomodule`, `playsinline`, `controls`, `loop`, `muted`, `reversed`) emit without a value: `<button disabled>`.
5. **Void elements** (per HTML spec): `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr` — emit self-closing `<img … />`. SVG leaf elements (`path`, `circle`, etc.) emit self-closing if they have no children, otherwise open/close.
6. **Reflected form state**: for `<input>`, `<textarea>`, `<select>`, emit synthetic attributes `data-rt-value` (reflecting `.value`), `data-rt-checked` (for checkboxes/radios), and `data-rt-selected` (on `<option>` elements). These survive the attribute-normalization pipeline so test state regressions are caught without `innerHTML`.
7. **Text nodes**: emit on their own line; trim leading/trailing whitespace; preserve internal whitespace; omit if empty after trim. **Exception**: inside `<pre>`, `<textarea>`, `<script>`, `<style>`, and elements with computed `white-space: pre*`, preserve original whitespace byte-for-byte (the `<pre>` leading-newline hack is respected).
8. **Character references**: in text, escape `<`, `>`, `&` as entities. In attribute values, escape `&`, `"`, `<`. Non-BMP characters pass through as UTF-16 surrogate pairs — the host test runner writes UTF-8, diffing is safe.
9. **Skipped elements**: `<script>`, `<style>`, HTML `<!-- comments -->`, CDATA sections (not present in HTML DOM but possible in XHTML/SVG — skipped). Rationale: `<script>` is library-injected; `<style>` is library-injected CSS churn; comments are dev-only.
10. **`<template>`**: traverse `template.content` (a `DocumentFragment`) as children.
11. **`<noscript>`**: emit its content as plain text (no element recursion) — matches browser behavior when JS is enabled.
12. **`<!DOCTYPE>`**: not expected inside a story container; ignored if encountered.
13. **Custom elements**: serialize like any HTML element, respecting their lowercase name.

### Attribute normalization table (exported array, tested row-by-row)

Each row is `{ pattern: RegExp, replacement: string | ((match: string, ids: Map) => string), appliesTo: 'class-token' | 'id' | 'attr-value' | 'attr-name', fixtureFile: string }`. `normalizeHtml.spec.ts` asserts each row against its fixture.

| # | Applies to | Pattern | Example (from pinned versions) | Replacement |
|---|------------|---------|-------------------------------|-------------|
| 1 | attr-name  | `/^data-v-[0-9a-f]{8}$/` (Vue SFC scoped) | `data-v-7ba5bd90=""` | remove attribute |
| 2 | attr-name  | `/^data-astro-cid-[0-9a-z]+$/` | `data-astro-cid-abc123de` | remove attribute |
| 3 | class-token| `/^css-[0-9a-z]+$/` (Emotion 11, MUI 7) | `css-1pvrydq` | `css-H` |
| 4 | class-token| `/^css-dev-only-do-not-override-[0-9a-z]+$/` (Ant 6 dev) | `css-dev-only-do-not-override-1xyz` | `css-dev-only-do-not-override-H` |
| 5 | class-token| `/^sc-[a-zA-Z0-9]+$/` (styled-components, no displayName) | `sc-bdVaJa` | `sc-H` |
| 6 | class-token| `/^([A-Z][A-Za-z0-9]*)__([A-Za-z0-9]+)-sc-[0-9a-z]+$/` (styled-components, displayName) | `Button__StyledButton-sc-1abc2de` | `$1__$2-sc-H` |
| 7 | class-token| `/^MuiBox-root-[0-9]+$/` (legacy MUI JSS; rare in v7 but possible via interop) | `MuiBox-root-42` | `MuiBox-root-N` |
| 8 | class-token| `/^jss[0-9]+$/` | `jss42` | `jssN` |
| 9 | class-token| `/^([A-Za-z][A-Za-z0-9_]*)__([A-Za-z][A-Za-z0-9_-]*)___[0-9a-zA-Z_-]{5,8}$/` (Vite CSS Modules) | `TodoMark__wrapper___a1B2c` | `$1__$2___H` |
| 10| id         | `/^:r[0-9a-z]+:?$/` (React useId, production) | `:r7:` | `:rN:` |
| 11| id         | `/^(mui|ant|rc|rsuite|rs|radix)[-_:][0-9a-f-]+$/i` | `radix-:r3:-trigger` | `<prefix>-N` |
| 12| attr-value | `for`, `htmlFor`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant` — values matched by #10 or #11 | - | rewrite using per-invocation alias map so cross-references stay consistent |
| 13| attr-value | `name` UUID: `/(.*-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` | `field-550e...` | `$1UUID` |

**Id alias map** is per-`normalizeHtml` invocation and ensures `id="x"` referenced by `aria-labelledby="x"` both become the same replacement token (`:rN:`, `rs-N`, etc.).

Tailwind arbitrary-value classes (`[&:hover]:bg-red-500`) pass through unchanged — they are content-deterministic. The serializer never splits class strings on anything other than ASCII whitespace.

Radix `data-*` attributes (`data-state`, `data-orientation`, `data-side`) pass through unchanged — they are deterministic. If a future library adds a hashed `data-*` attribute, add a row.

### Fixture strategy

`normalizeHtml.spec.ts` contains one fixture per row. Fixtures are **real HTML strings** minimally extracted from the current pinned libraries.

The version-lock assert checks **both**:

1. **Direct declared ranges** in `packages/storybook/package.json` (catches explicit bumps).
2. **Resolved versions** for `react`, `react-dom`, `vue`, `antd`, `@mui/material`, `rsuite`, `@emotion/react`, `@emotion/styled`, `playwright`, and `@vitest/browser-playwright` read from `pnpm-lock.yaml` (catches transitive range bumps).

```ts
// normalizeHtml.spec.ts
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const lock = parse(readFileSync('../../pnpm-lock.yaml', 'utf8'))
const pinned = JSON.parse(readFileSync('./fixtures/pinned-versions.json', 'utf8'))

it('fixtures match declared ranges', () => {
  expect(pkg.dependencies).toMatchObject(pinned.ranges)
})

it('fixtures match resolved versions', () => {
  for (const [name, expected] of Object.entries(pinned.resolved)) {
    expect(resolvedFromLock(lock, name)).toBe(expected)
  }
})
```

If either diverges, this test fails fast and the developer must run the "refresh fixtures" script (also provided in `packages/storybook/scripts/refresh-snapshot-fixtures.ts`) before re-running `vitest -u` on story snapshots.

### Story-name collision guard

```ts
for (const [path, module] of Object.entries(storiesModules)) {
  // ...
  for (const [name, story] of Object.entries(stories)) {
    if (name in categoryStories) {
      throw new Error(`Duplicate story name: ${category}/${name} (in ${path})`)
    }
    categoryStories[name] = story
  }
}
```

Fails fast; prevents silent coverage loss from the existing `Object.assign` pattern.

## Phase 2: Computed-style snapshot (keyword-only)

### API

```ts
type StyleEntry = { key: string; styles: Record<string, string> }
type StyleMap = StyleEntry[]

function captureStyles(root: Element): StyleMap
```

### Stable identity key (replaces the v3 ordinal cascade)

The key is constructed to **narrow blast radius** when the tree changes:

```
<path>::<anchor>::<localIndex>
```

- `path`: joined ancestor local names from `root` down to the element, with `:nth-of-type(N)` appended **per segment** only when that ancestor has same-tag siblings in its parent. Example key for the second `<span>` inside the only `<li>` of the first `<ul>`:
  ```
  div / ul / li / span:nth-of-type(2) :: Item :: 0
  ```
- `anchor`: a short structural anchor captured at the element itself. Chosen in this order (first match wins):
  1. `data-testid` attribute value
  2. `role` attribute, **only if** it matches the explicit allow-list of stable semantic roles: `{ button, dialog, menu, menuitem, menuitemcheckbox, menuitemradio, tab, tabpanel, tablist, textbox, link, listitem, list, navigation, region, banner, main, complementary, contentinfo, heading, checkbox, radio, combobox, option, searchbox, separator, slider, switch, table, row, rowgroup, cell, columnheader, rowheader, tree, treeitem, grid, gridcell }`. Any other value (including library-generated roles like `radix-tooltip`) is ignored.
  3. `name` attribute on form controls (`<input>`, `<select>`, `<textarea>`, `<button>`)
  4. First 32 chars of the element's **shallow trimmed text** — only direct `Node.TEXT_NODE` children concatenated, not nested text. This prevents a wrapper `<div>` from inheriting anchor text from its descendants.
  5. `element.localName` (fallback)
- `localIndex`: 0-based index among **siblings that share the same `(path, anchor)`** only. An insertion/removal **outside** the sibling group does not shift `localIndex` for this group.

**Honest trade-off**: when many same-tag siblings share the same `(path, anchor)` — e.g. ten `<li>` with identical text `"Item"` — identity reduces to `localIndex` within that group, and an insertion inside the group reorders all subsequent siblings. This is no better than a pure ordinal for that subtree. The win is that edits **outside** the group do not cascade through the entire snapshot. Story authors who need stable keys for repeated items should add `data-testid` to those items.

A node **moved** across the tree changes its key → the snapshot diff shows one removal at the old key and one addition at the new key. This is treated as the intended diff.

### Sandbox defaults (replaces the v3 bare-body approach)

Defaults are measured in an iframe that is booted **once per Vitest worker** (not per file — sharing across files inside a worker amortizes startup while keeping worker-level isolation). The sandbox exposes a singleton `getDefaults(localName, namespaceURI, variant)` API backed by a `Map` cache.

- The iframe receives the **same determinism preamble** as the top-level page, applied by writing to `iframe.contentDocument.documentElement`:
  - `lang = 'en'`, `dir = 'ltr'`
  - `<meta name="color-scheme" content="light">` inserted into the iframe's `<head>`
  - Same global `<style>` inserted into the iframe's `<head>`
  - A stylesheet sets `color-scheme: light only` on `:root` of the iframe to match `page.emulateMedia({ colorScheme: 'light' })` (which applies only to the top-level page, not child frames, in Playwright).
- For each encountered `(localName, namespaceURI, variant)`, the sandbox constructs the **minimal valid ancestor chain** using this static table:

| Tag | Fixture subtree |
|-----|-----------------|
| `li` | `<ul><li></li></ul>` and separately `<ol><li></li></ol>` (keyed by `(li, list-type)` via reading `el.closest('ol,ul')`) |
| `dt`, `dd` | `<dl><dt></dt><dd></dd></dl>` |
| `td`, `th` | `<table><tbody><tr><td></td></tr></tbody></table>` (same for `th`) |
| `tr` | `<table><tbody><tr></tr></tbody></table>` |
| `thead`, `tbody`, `tfoot`, `caption`, `colgroup`, `col` | `<table>...</table>` |
| `option`, `optgroup` | `<select><option></option></select>` |
| `legend` | `<fieldset><legend></legend></fieldset>` |
| `summary` | `<details><summary></summary></details>` |
| `figcaption` | `<figure><figcaption></figcaption></figure>` |
| `rb`, `rt`, `rp`, `rtc` | `<ruby><rb></rb><rt></rt></ruby>` |
| SVG children (`path`, `circle`, `rect`, `g`, `text`, `tspan`, `use`, `defs`, `symbol`, ...) | inside an `<svg>` element in the iframe |
| MathML children | inside a `<math>` element |
| `input` | `<form><input type="…"></form>` — **variant per `type`**: `text`, `checkbox`, `radio`, `button`, `submit`, `reset`, `email`, `password`, `number`, `search`, `tel`, `url`, `date`, `time`, `color`, `range`, `file`, `hidden`. UA styles differ materially across these. |
| `button` | `<form><button type="…"></button></form>` — **variant per `type`**: `button`, `submit`, `reset`. |
| `select` | `<form><select [multiple] [size=N]></select></form>` — **variants**: plain, `multiple`, `size>1`. |
| `textarea` | `<form><textarea [wrap]></textarea></form>` — **variants**: plain, `wrap="hard"`, `wrap="off"`. |
| `a` | **variant per presence of `href`**: `<a href="#"></a>` vs `<a></a>` (browsers may render the latter without link defaults). |
| `source`, `track` | inside `<picture>`, `<audio>`, `<video>` as appropriate — variants by parent element. |
| `slot` | not measured in Phase 2 (requires shadow root). Elements assigned to slots fall back to their own rules; elements inside closed shadow roots are skipped. |
| Custom elements (tag contains `-`) | measured as an unknown element in `<body>` — browsers treat them as `display: inline` by default. The spec does not attempt to replicate each custom element's behavior; if a library defines many custom elements, add deny-list entries. |
| Any other HTML | directly in `<body>` |

When reading, the sandbox selects the right fixture based on the real element's ancestor chain and attributes (e.g., `li` inside `ol` uses the `ol>li` fixture; `input[type=checkbox]` uses the checkbox fixture). The variant discriminator is encoded in the cache key as `(localName, namespaceURI, variantString)`.

**No insertions are made into the story tree.** This eliminates the v2 bug where temp siblings break `:nth-child`, `:last-child`, `:empty`, `:only-child`, and adjacent-sibling selectors.

### Diff capture

For each real element, read `getComputedStyle(el)` for the allow-listed properties, compare against the cached default for its `(localName, namespaceURI, fixture-variant)`, emit only differing entries.

### Property allow-list (keyword-only, length-free)

`stableProps.ts`:

- **Layout mode**: `display`, `position`, `float`, `clear`, `box-sizing`, `visibility`, `isolation`
- **Overflow behavior**: `overflow-x`, `overflow-y`, `overscroll-behavior-x`, `overscroll-behavior-y`, `overflow-wrap`
- **Flex/Grid mode**: `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `align-content`, `justify-self`, `align-self`, `place-content`, `grid-auto-flow`
- **Typography mode** (no metrics): `font-weight` (keyword-normalized via deny-list of numeric values; see below), `font-style`, `font-variant-caps`, `text-align`, `text-transform`, `text-decoration-line`, `text-decoration-style`, `white-space`, `word-break`, `hyphens`, `direction`, `unicode-bidi`, `writing-mode`
- **Interaction**: `cursor`, `pointer-events`, `user-select`, `touch-action`
- **Border style (no width, no color)**: `border-top-style`, `border-right-style`, `border-bottom-style`, `border-left-style`
- **Misc enumerated**: `contain`, `content-visibility`, `mix-blend-mode`, `background-blend-mode`, `resize`, `scroll-behavior`

`font-weight` normalization: computed values return numeric (`400`, `700`) but map 1:1 to keywords (`normal`, `bold`). We keep them numeric as returned — the value set is small and stable.

### Deny-list (configurable)

`stableProps.ts` also exports `KNOWN_INHERITED_NOISE = ['cursor', 'direction', 'unicode-bidi', 'visibility']`. A story may opt-out of specific properties via `parameters.snapshotStyles = { deny: ['cursor'] }` in its meta, consumed by the test harness. The deny-list is applied **after** diffing, suppressing only properties that a human has already decided are noise for that story.

### Acceptance bar (quantitative, manual governance)

This is a **one-time offline audit**, not a per-CI-run enforcement. After the initial Phase 2 snapshot run, a helper script `packages/storybook/scripts/audit-inherited-noise.ts` parses all generated `*.styles.snap` files and computes, **per story**, the fraction of `StyleEntry` items where the only differing properties belong to `KNOWN_INHERITED_NOISE` (`cursor`, `direction`, `unicode-bidi`, `visibility`).

**Decision rule** (applied once, outcome recorded in `stableProps.ts` with a dated comment):

- If >**30%** of stories cross the threshold → move the offending properties from allow-list to deny-list globally.
- Otherwise → keep the allow-list as is; per-story `parameters.snapshotStyles.deny` handles outliers.

The audit script is re-run whenever new stories are added, but the spec does **not** mandate running it in CI. The 30% rule is governance, not enforcement.

### Snapshot size budget

Per-story snapshot is capped at **400 lines** (soft) / **800 lines** (hard) for HTML and **600 lines** for styles. The check is applied inside `normalizeHtml` / `captureStyles`:

- **Hard-cap violation** → `throw new Error(...)` before `toMatchSnapshot`, failing the test with a message to split the story, narrow scope, or add deny-list entries.
- **Soft-cap violation** → attached as a property on the returned string/array and surfaced via a custom Vitest **reporter** (`packages/storybook/reporters/snapshot-budget.ts`) that prints a summary at end-of-run. Using a reporter instead of `console.warn` ensures visibility regardless of Vitest log level.

## Integration in spec files

```ts
// stories.react.spec.tsx
import { settleReact } from '../../shared/lib/snapshot/settle.react'
import { normalizeHtml } from '../../shared/lib/snapshot/normalizeHtml'
// Phase 2: import { captureStyles } from '../../shared/lib/snapshot/captureStyles'

for (const [category, stories] of storiesByCategory.entries()) {
  describe(`${category} stories`, () => {
    for (const [name, Story] of Object.entries(stories)) {
      it(`Story ${name}`, async () => {
        const { container } = await render(<Story />)
        await settleReact(container)
        expect(normalizeHtml(container)).toMatchSnapshot('html')
        // Phase 2:
        // const params = (Story as any).parameters?.snapshotStyles ?? {}
        // expect(captureStyles(container, params)).toMatchSnapshot('styles')
      })
    }
  })
}
```

The `textContent.length > 0` assertion is **removed**. The HTML snapshot already encodes structural emptiness; a duplicate assertion adds no signal.

### Accessing `parameters.snapshotStyles`

Storybook merges parameters hierarchically: **global → component meta → story**. After `composeStories`, each exported story exposes the merged parameters on `<Story>.parameters`. The test harness reads `Story.parameters?.snapshotStyles` (TypeScript: typed via a module augmentation in `packages/storybook/src/shared/lib/snapshot/types.ts`). The exact Storybook export shape is locked to `@storybook/*@10.3.3` (pinned in the catalog); when bumping Storybook, re-verify this path.

## CI / snapshot lifecycle

### `.gitattributes`

```
*.snap text eol=lf
```

Prevents Windows CRLF from corrupting snapshots.

### Conflict recovery

Documented in the helper JSDoc and in `packages/storybook/README.md`: if a snapshot has merge conflict markers, regenerate with `pnpm --filter @markput/storybook exec vitest run -u`. The normalizer's determinism means a regeneration on any OS produces the same output.

### Playwright / Chromium bumps

Acknowledged as the primary residual churn source. The CI checklist adds one step: when `pnpm-lock.yaml` changes `playwright` or `@vitest/browser-playwright`, run the test suite twice to confirm stability; expected migration: `vitest -u` + a single commit scoped `chore(storybook): refresh snapshots for playwright X.Y`.

### Determinism CI gate

A `test:determinism` script runs the storybook suite **twice** sequentially in the same workflow, both without `-u`. Scope and limits:

- **Catches**: snapshot nondeterminism that depends on time-of-day, hash iteration order, Storybook story-module load order, or first-vs-second React render after module evaluation.
- **Does not catch**: intra-run ordering bugs, cold-start vs warm differences that reset per Node process, or nondeterminism gated on external network/time.

Added to the "Before submitting" checklist in `AGENTS.md` with this scoping note.

## Phase 2 entry criterion

Phase 2 is implemented only after **all** of the following hold:

1. Phase 1 is merged to `next`.
2. `main` (via release-please promotion) has had **10 consecutive green** `pnpm test` runs of the storybook suite without any snapshot-related flakes or required re-records.
3. At least **7 calendar days** have passed since Phase 1 reached `main`.
4. No open issues tagged `snapshot-stability`.

This gates the investment in Phase 2 on the infrastructure actually being stable.

## Performance budget

- Phase 1: one tree walk per story. Negligible.
- Phase 2: one iframe per test file (amortized), one default read per unique `(localName, namespaceURI, fixture-variant)`, ~35 property reads per real element, no live-DOM mutation.
- Target: p95 added <300 ms per story. If exceeded, measure via `vi.fn` timing wrappers and shrink the allow-list before expanding.

## Limitations (explicit)

1. **Inheritance noise** — The sandbox uses canonical ancestor fixtures, not the story's actual ancestor chain. Properties that libraries set on wrappers (e.g., `cursor: pointer`, `user-select: none`) will appear on descendants as "non-default". Mitigations: `KNOWN_INHERITED_NOISE` deny-list, per-story `parameters.snapshotStyles.deny`. Hard acceptance bar is the 30% rule above.
2. **`display: contents`** — Treated as a plain element; box-tree inheritance skip is not modeled.
3. **Portals / Teleport / Shadow DOM** — Not captured (Phase 3).
4. **Inline vs class same-computed-value** — Phase 1 catches `style` attribute change; Phase 2 does not distinguish source.
5. **Canvas / video / iframe content** — Not captured.
6. **`@container` queries / `container-name`** — Resolved via the story's actual container; sandbox defaults may differ. Document in `captureStyles.spec.ts`.
7. **Library major-version bumps** — Fixture tests fail explicitly, forcing a review. Not silent.

## Trade-offs

- **Pro:** Phase 1 is shippable alone, fully cross-OS, catches structural regressions
- **Pro:** Phase 2 keyword-only allow-list is resistant to font/theme/OS drift
- **Pro:** Sandbox iframe + fixture subtrees preserve UA defaults correctly for list/table/form/SVG elements; no live-tree mutation
- **Pro:** Stable-key strategy narrows blast radius for common edits
- **Pro:** Normalization table is explicit, fixture-tested, and tied to pinned library versions
- **Con:** Phase 2 misses regressions that manifest only in colors, sizes, spacing
- **Con:** Normalization table needs updates when new CSS-in-JS patterns appear (enforced by fixture-version test)
- **Con:** Initial Phase 1 PR is large (one `vitest -u` pass)

## Out of scope

- Pixel-level visual regression (`toMatchScreenshot`)
- Cross-browser comparison
- Interactive states
- Phase 3 portal/shadow capture
- Automated normalization regex discovery

## Open questions (resolved empirically during implementation)

1. Do any stories use Vue Teleport or React portals in their default render? (Inspect: RSuite `Popover`, MUI `Menu`, Ant `Tooltip`.) If yes, pull Phase 3 forward for the affected stories.
2. Does the 1 s `vi.waitFor` in `settle` comfortably fit the slowest story? Measure on first CI pass; extend per-story if needed.
3. Does forcing `process.env.NODE_ENV=production` break any story that relies on React dev-only features (e.g., dev-only warnings visible in output)? If so, fall back to normalizing both `:r7:` and `«r7»` forms.
