# VRT Structural Snapshot Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pixel-perfect VRT with a single normalized-innerHTML snapshot gate and tear down all pixel-determinism infrastructure in `packages/storybook`.

**Architecture:** Each story renders, `container.innerHTML` is normalized (strip React `useId` outputs, Vue scope hashes, inline style whitespace, inter-tag whitespace), then compared to a committed `.html` baseline via Vitest's `toMatchFileSnapshot`. Screenshots, font bundles, Chromium launch flags, and custom comparators are all removed.

**Tech Stack:** Vitest 4.1.2 browser mode (Playwright Chromium), `vitest-browser-react`, `vitest-browser-vue`, Storybook's `composeStories`.

---

### Task 1: HTML normalizer module + unit test

**Files:**
- Create: `packages/storybook/src/pages/_vrt/normalize-html.ts`
- Create: `packages/storybook/src/pages/_vrt/normalize-html.spec.ts`

- [ ] **Step 1.1: Write the failing test**

Create `packages/storybook/src/pages/_vrt/normalize-html.spec.ts`:

```ts
import {describe, expect, it} from 'vitest'

import {normalizeHtml} from './normalize-html'

describe('normalizeHtml', () => {
	it('strips React useId outputs of the :rXX: form', () => {
		const input = '<div id=":r0:" aria-labelledby=":r1:"><span id=":rab:">x</span></div>'
		expect(normalizeHtml(input)).toBe(
			'<div id="__ID__" aria-labelledby="__ID__"><span id="__ID__">x</span></div>',
		)
	})

	it('strips legacy React useId outputs of the «rXX» form', () => {
		const input = '<div id="«ra»">x</div>'
		expect(normalizeHtml(input)).toBe('<div id="__ID__">x</div>')
	})

	it('strips Vue scoped-style 8-hex hashes', () => {
		const input = '<div data-v-abc12345 class="foo" data-v-1234abcd>x</div>'
		expect(normalizeHtml(input)).toBe(
			'<div data-v-__HASH__ class="foo" data-v-__HASH__>x</div>',
		)
	})

	it('collapses whitespace inside inline style attributes', () => {
		const input = '<div style="  color:  red;\n  padding: 10px  ">x</div>'
		expect(normalizeHtml(input)).toBe('<div style="color: red; padding: 10px">x</div>')
	})

	it('collapses inter-tag whitespace', () => {
		const input = '<div>\n  <span>x</span>\n  <span>y</span>\n</div>'
		expect(normalizeHtml(input)).toBe('<div><span>x</span><span>y</span></div>')
	})

	it('preserves text content whitespace', () => {
		const input = '<p>hello  world</p>'
		expect(normalizeHtml(input)).toBe('<p>hello  world</p>')
	})

	it('preserves class names and non-id attributes', () => {
		const input = '<button class="MuiButton-root Mui-focused" type="button" aria-expanded="false">x</button>'
		expect(normalizeHtml(input)).toBe(
			'<button class="MuiButton-root Mui-focused" type="button" aria-expanded="false">x</button>',
		)
	})

	it('is idempotent', () => {
		const input = '<div id=":r0:" data-v-abcdef12>\n  <span style="  color: red  ">x</span>\n</div>'
		const once = normalizeHtml(input)
		expect(normalizeHtml(once)).toBe(once)
	})
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/_vrt/normalize-html.spec.ts`

Expected: FAIL with "Cannot find module './normalize-html'".

- [ ] **Step 1.3: Implement the normalizer**

Create `packages/storybook/src/pages/_vrt/normalize-html.ts`:

```ts
// Serialized-innerHTML normalization for cross-OS/cross-run structural snapshots.
// Each rule targets a specific source of non-determinism that appears in VRT
// baselines; see `normalize-html.spec.ts` for the full contract.
export function normalizeHtml(html: string): string {
	return html
		// React `useId()` outputs: `:r0:`, `:rab:`, legacy `«ra»`.
		// These are regenerated per render in document-creation order, so they
		// flip whenever any component upstream mounts a new hook.
		.replace(/:r[a-z0-9]+:/g, '__ID__')
		.replace(/«r[a-z0-9]+»/g, '__ID__')
		// Vue scoped-style hashes: `data-v-<8 hex>`. Recomputed on SFC recompile.
		.replace(/\bdata-v-[a-f0-9]{8}\b/g, 'data-v-__HASH__')
		// Collapse inline style whitespace. React/Vue emit inconsistent spacing
		// (`"color:red"` vs `"color: red"`) depending on prop shape.
		.replace(/style="([^"]*)"/g, (_, s: string) =>
			`style="${s.replace(/\s+/g, ' ').trim()}"`,
		)
		// Inter-tag whitespace is JSX-formatting leakage, semantically irrelevant.
		.replace(/>\s+</g, '><')
		.trim()
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/_vrt/normalize-html.spec.ts`

Expected: PASS, 7 tests.

- [ ] **Step 1.5: Commit**

```bash
git add packages/storybook/src/pages/_vrt/
git commit -m "feat(storybook): add normalizeHtml utility for structural VRT snapshots"
```

---

### Task 2: Strip pixel infrastructure from `vite.config.ts`

**Files:**
- Modify: `packages/storybook/vite.config.ts`

- [ ] **Step 2.1: Replace file contents**

Overwrite `packages/storybook/vite.config.ts` with:

```ts
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig, defineProject} from 'vitest/config'

const browser = {
	enabled: true,
	// oxlint-disable-next-line typescript-eslint/no-unsafe-call
	provider: playwright(),
	instances: [{browser: 'chromium' as const}],
	viewport: {width: 1280, height: 720},
	headless: true,
}

export default defineConfig({
	plugins: process.env.FRAMEWORK === 'react' ? [react()] : [vue()],
	define: {'process.env.FRAMEWORK': JSON.stringify(process.env.FRAMEWORK ?? '')},
	test: {
		coverage: {provider: 'v8', reporter: ['text', 'json', 'html']},
		projects: [
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			defineProject({
				plugins: [react()],
				resolve: {dedupe: ['react', 'react-dom']},
				define: {'process.env.FRAMEWORK': JSON.stringify('react')},
				test: {
					name: 'react',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.react.spec.tsx', 'src/pages/**/*.spec.ts'],
					browser,
				},
			}),
			// oxlint-disable-next-line typescript-eslint/no-unsafe-call
			defineProject({
				plugins: [vue()],
				resolve: {dedupe: ['vue']},
				define: {'process.env.FRAMEWORK': JSON.stringify('vue')},
				test: {
					name: 'vue',
					globals: true,
					setupFiles: ['./vitest.setup.ts'],
					include: ['src/pages/**/*.vue.spec.ts'],
					browser,
				},
			}),
		],
	},
})
```

**Changes:**
- Removed `chromiumLaunchOptions` const entirely.
- `playwright()` called with no arguments (was `playwright({launchOptions: chromiumLaunchOptions})`).
- Removed `screenshotFailures: true`.
- Removed entire `expect.toMatchScreenshot` block (`comparatorOptions.allowedMismatchedPixelRatio`, `resolveScreenshotPath`).
- Added `'src/pages/**/*.spec.ts'` to React project's include (to pick up `_vrt/normalize-html.spec.ts` which isn't framework-specific).

- [ ] **Step 2.2: Run tests to verify no regressions**

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/_vrt/normalize-html.spec.ts`

Expected: PASS.

Run: `pnpm --filter @markput/storybook exec vitest run src/pages/Selection/Selection.react.spec.tsx`

Expected: PASS (functional spec, unaffected by VRT changes).

- [ ] **Step 2.3: Commit**

```bash
git add packages/storybook/vite.config.ts
git commit -m "refactor(storybook): remove pixel-comparison VRT infrastructure from vite config"
```

---

### Task 3: Trim `vitest.setup.ts` to only what HTML snapshots need

**Files:**
- Modify: `packages/storybook/vitest.setup.ts`

- [ ] **Step 3.1: Replace file contents**

Overwrite `packages/storybook/vitest.setup.ts` with:

```ts
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

// Kill-switch for hover/focus-driven inline-style mutations and in-flight
// CSS transitions/animations during VRT specs. Scoped to `html[data-vrt]`
// so functional specs (Drag.*, Selection.*, Clipboard.*) keep real
// pointer-events, transitions, and animations — VRT specs opt in by
// setting the attribute in `beforeAll`.
//
// Why each rule is load-bearing:
// - `pointer-events: none` — Playwright's virtual cursor lands inside
//   components on some OSs, triggering `:hover` / `onMouseEnter` that
//   flip inline styles (e.g. `Nested/InteractiveNested` toggled
//   `style="border: 2px solid #2196f3"` on Linux but not macOS).
// - `transition: none`, `animation: none` — prevents capture during
//   mid-flight CSS state, which would otherwise produce non-idempotent
//   serialized HTML between runs.
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

**Changes:**
- Removed `@fontsource-variable/inter` and `@fontsource-variable/noto-sans` imports.
- Removed `font-family`, `line-height`, `text-rendering`, `vertical-align` CSS rules.
- Removed `:focus*` outline reset rules.
- Kept only the three kill-switches that affect serialized HTML.

- [ ] **Step 3.2: Commit**

```bash
git add packages/storybook/vitest.setup.ts
git commit -m "refactor(storybook): drop font pinning and metric CSS from VRT setup"
```

---

### Task 4: Remove font dependencies from `package.json`

**Files:**
- Modify: `packages/storybook/package.json`

- [ ] **Step 4.1: Remove font devDependencies**

Use a text edit (not package manager) to delete these two lines from `packages/storybook/package.json`:

```
    "@fontsource-variable/inter": "^5.2.8",
    "@fontsource-variable/noto-sans": "^5.2.10",
```

Result: the `devDependencies` block starts with `"@storybook/addon-docs": "catalog:",`.

- [ ] **Step 4.2: Reinstall to update lockfile**

Run: `pnpm install`

Expected: `pnpm-lock.yaml` updates, removing Inter/Noto entries.

- [ ] **Step 4.3: Verify nothing still imports the fonts**

Run: `rg -n "fontsource.*(inter|noto-sans)" packages/storybook`

Expected: no output.

- [ ] **Step 4.4: Commit**

```bash
git add packages/storybook/package.json pnpm-lock.yaml
git commit -m "chore(storybook): drop @fontsource-variable/inter and noto-sans deps"
```

---

### Task 5: Rewrite `screenshots.react.spec.tsx` to use HTML snapshot

**Files:**
- Modify: `packages/storybook/src/pages/screenshots.react.spec.tsx`

- [ ] **Step 5.1: Replace file contents**

Overwrite `packages/storybook/src/pages/screenshots.react.spec.tsx` with:

```tsx
// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/react-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {normalizeHtml} from './_vrt/normalize-html'

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

// Determinism scoped to this file. `data-vrt` activates the kill-switches in
// `vitest.setup.ts` (pointer-events, transitions, animations) so that hover
// and in-flight CSS state don't leak into the serialized innerHTML.
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
	document.documentElement.setAttribute('data-vrt', '')
})

afterAll(() => {
	vi.useRealTimers()
	document.documentElement.removeAttribute('data-vrt')
})

describe('Storybook visual regression (React)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(<Story />)

					// `document.fonts.ready` settles any late font load that may
					// still mutate inline styles (some components write em-based
					// dimensions into `style=""` after font metrics resolve).
					// One RAF flushes React's post-commit effects.
					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					// Blur any auto-focused element. Chromium on some platforms
					// sets `aria-activedescendant` / `[data-focus-visible]` on
					// programmatic focus; blurring to `<body>` produces stable DOM.
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur()
					}
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					const htmlPath = `./${category}/__screenshots__/${name}-react.html`
					await expect(normalizeHtml(container.innerHTML)).toMatchFileSnapshot(htmlPath)
				})
			}
		})
	}
})
```

**Changes:**
- Removed `page` import from `vitest/browser` (no longer screenshotting).
- Imported `normalizeHtml`.
- Dropped `parameters.screenshot === false` escape hatch.
- Replaced `toMatchScreenshot` with `toMatchFileSnapshot` at
  `<category>/__screenshots__/<name>-react.html`.

- [ ] **Step 5.2: Commit**

```bash
git add packages/storybook/src/pages/screenshots.react.spec.tsx
git commit -m "refactor(storybook): switch React VRT to innerHTML snapshot"
```

---

### Task 6: Rewrite `screenshots.vue.spec.ts` to use HTML snapshot

**Files:**
- Modify: `packages/storybook/src/pages/screenshots.vue.spec.ts`

- [ ] **Step 6.1: Replace file contents**

Overwrite `packages/storybook/src/pages/screenshots.vue.spec.ts` with:

```ts
// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion typescript-eslint/no-unsafe-type-assertion
import {faker} from '@faker-js/faker'
import {composeStories} from '@storybook/vue3-vite'
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest'
import {render} from 'vitest-browser-vue'

import {normalizeHtml} from './_vrt/normalize-html'

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

// Determinism scoped to this file. `data-vrt` activates the kill-switches in
// `vitest.setup.ts` (pointer-events, transitions, animations) so that hover
// and in-flight CSS state don't leak into the serialized innerHTML.
beforeAll(() => {
	faker.seed(123)
	vi.useFakeTimers({toFake: ['Date']})
	vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
	document.documentElement.setAttribute('data-vrt', '')
})

afterAll(() => {
	vi.useRealTimers()
	document.documentElement.removeAttribute('data-vrt')
})

describe('Storybook visual regression (Vue)', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(category, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(name, async () => {
					const {container} = await render(Story)

					await document.fonts.ready
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur()
					}
					await new Promise(resolve => requestAnimationFrame(() => resolve(null)))

					const htmlPath = `./${category}/__screenshots__/${name}-vue.html`
					await expect(normalizeHtml(container.innerHTML)).toMatchFileSnapshot(htmlPath)
				})
			}
		})
	}
})
```

**Changes:** mirror of Task 5 for Vue (uses `vitest-browser-vue`, `@storybook/vue3-vite`, `*-vue.html` suffix, no React-specific imports).

- [ ] **Step 6.2: Commit**

```bash
git add packages/storybook/src/pages/screenshots.vue.spec.ts
git commit -m "refactor(storybook): switch Vue VRT to innerHTML snapshot"
```

---

### Task 7: Delete all VRT PNG baselines

**Files:**
- Delete: every `packages/storybook/src/pages/*/__screenshots__/*.png` (directly in `__screenshots__/`, NOT nested under `<spec>.spec.tsx/` subdirs — those are functional-spec artifacts)

- [ ] **Step 7.1: Preview what will be deleted**

Run: `ls packages/storybook/src/pages/*/__screenshots__/*.png 2>/dev/null | wc -l`

Expected: `63` (the full VRT baseline set).

Run: `ls packages/storybook/src/pages/*/__screenshots__/*/*.png 2>/dev/null | wc -l`

Expected: non-zero (functional spec screenshots in nested dirs — must survive).

- [ ] **Step 7.2: Delete only direct-child PNGs**

Run: `rm packages/storybook/src/pages/*/__screenshots__/*.png`

- [ ] **Step 7.3: Verify nested PNGs survived**

Run: `ls packages/storybook/src/pages/*/__screenshots__/*/*.png 2>/dev/null | head -3`

Expected: still shows files under `Selection/__screenshots__/Selection.react.spec.tsx/…`.

- [ ] **Step 7.4: Commit**

```bash
git add -A packages/storybook/src/pages
git commit -m "chore(storybook): remove VRT pixel baselines (replaced by HTML snapshots)"
```

---

### Task 8: Generate fresh HTML baselines

**Files:**
- Create: `packages/storybook/src/pages/<Category>/__screenshots__/<Story>-react.html` (63 files)
- Create: `packages/storybook/src/pages/<Category>/__screenshots__/<Story>-vue.html` (63 files)

- [ ] **Step 8.1: Run test:update:react**

Run: `pnpm --filter @markput/storybook run test:update:react`

Expected: all React stories pass; new `*-react.html` files written under each `__screenshots__/`.

- [ ] **Step 8.2: Run test:update:vue**

Run: `pnpm --filter @markput/storybook run test:update:vue`

Expected: all Vue stories pass; new `*-vue.html` files written.

- [ ] **Step 8.3: Verify baseline count**

Run: `ls packages/storybook/src/pages/*/__screenshots__/*.html | wc -l`

Expected: `126` (63 React + 63 Vue).

- [ ] **Step 8.4: Spot-check one baseline for sanity**

Run: `head -20 packages/storybook/src/pages/Base/__screenshots__/Default-react.html`

Expected: normalized HTML, no `:r…:` ids, no `data-v-<hash>` values, no inter-tag whitespace.

- [ ] **Step 8.5: Run tests once more without `--update` to confirm stability**

Run: `pnpm --filter @markput/storybook run test`

Expected: all VRT tests pass (baselines match freshly rendered output).

- [ ] **Step 8.6: Commit**

```bash
git add packages/storybook/src/pages/*/__screenshots__/*.html
git commit -m "chore(storybook): add HTML structural baselines for all stories"
```

---

### Task 9: Remove `.vitest-attachments/` upload step from CI

**Files:**
- Modify: `.github/workflows/CI.yml`

- [ ] **Step 9.1: Delete the upload step**

Remove lines 37–48 from `.github/workflows/CI.yml`:

```yaml
            - name: Upload VRT diff artefacts
              if: failure()
              uses: actions/upload-artifact@v4
              with:
                  name: vrt-diffs
                  path: packages/storybook/.vitest-attachments/
                  # `.vitest-attachments` starts with a dot so upload-artifact
                  # treats its entire subtree as hidden and skips it unless
                  # this flag is flipped. Took one CI iteration to discover.
                  include-hidden-files: true
                  if-no-files-found: warn
                  retention-days: 14
```

After deletion, the `tests` job ends with the `Run Tests` step.

- [ ] **Step 9.2: Commit**

```bash
git add .github/workflows/CI.yml
git commit -m "ci: drop VRT diff-artefact upload step (no longer produced)"
```

---

### Task 10: Rewrite README.md VRT section

**Files:**
- Modify: `packages/storybook/README.md`

- [ ] **Step 10.1: Replace the "Visual regression tests" section**

Open `packages/storybook/README.md`. Replace the entire block from the `## Visual regression tests` heading through (and including) the `### Known limitations` subsection with:

```markdown
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

\```bash
pnpm --filter @markput/storybook run test:update
\```

This runs both frameworks with `vitest --update`, overwriting the `.html` baselines. Review the text diff in your PR — each change should be justified by a code change in the same commit/PR.

### Investigating failures

Snapshot mismatches appear as a standard Vitest text diff in the test output. Read the diff, decide whether the change is intentional, and either fix the source or run `test:update` to accept it.

### Known limitations

- **Structural only.** Pure styling regressions (color change, padding change on CSS classes) that don't alter the DOM are not caught. If you need visual regression coverage for those, see `docs/superpowers/todo/2026-04-20-vrt-two-layer-gate-design.md` for the deferred visual-snapshot-gate design.
- **Chromium only.** Firefox/WebKit are not currently configured.
```

*(Escape the fenced block marker in the first inner code block as `\```` — the actual README just uses three backticks.)*

- [ ] **Step 10.2: Commit**

```bash
git add packages/storybook/README.md
git commit -m "docs(storybook): document structural snapshot VRT (replaces pixel VRT)"
```

---

### Task 11: Verify locally + push to CI

- [ ] **Step 11.1: Full local test run**

Run: `pnpm --filter @markput/storybook run test`

Expected: all tests pass (VRT + functional).

- [ ] **Step 11.2: Typecheck**

Run: `pnpm run typecheck`

Expected: no errors.

- [ ] **Step 11.3: Lint**

Run: `pnpm run lint`

Expected: no errors.

- [ ] **Step 11.4: Format**

Run: `pnpm run format`

Expected: no errors.

- [ ] **Step 11.5: Push to remote**

Run: `git push`

- [ ] **Step 11.6: Watch CI**

Run: `gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')` (or open Actions tab in browser).

Expected: all jobs green. If Linux CI produces a diff in any `*.html` baseline that macOS did not, investigate the specific normalization rule that's missing and extend `normalize-html.ts` in a follow-up commit.

---

## Self-review

**Spec coverage:**
- Normalize innerHTML — Task 1. ✓
- Strip pixel infra from `vite.config.ts` — Task 2. ✓
- Trim `vitest.setup.ts` — Task 3. ✓
- Remove font deps — Task 4. ✓
- React VRT spec rewrite — Task 5. ✓
- Vue VRT spec rewrite — Task 6. ✓
- Delete PNG baselines — Task 7. ✓
- Generate HTML baselines — Task 8. ✓
- Drop CI upload step — Task 9. ✓
- README update — Task 10. ✓
- Verification/push — Task 11. ✓

**Placeholder scan:** no "TBD" / "TODO" / "fill in details" / "similar to Task N". Each code step shows the full content to write.

**Type consistency:** `normalizeHtml` signature is `(html: string) => string` in Task 1, used the same way in Tasks 5 and 6. Path format `./<category>/__screenshots__/<name>-<framework>.html` consistent between React and Vue specs. `data-vrt` attribute name consistent between setup CSS (Task 3) and spec `beforeAll` (Tasks 5, 6).
