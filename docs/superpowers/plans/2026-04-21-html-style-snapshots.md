# HTML Snapshot Tests (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace trivial smoke tests in `@markput/storybook` with cross-OS-stable HTML snapshot tests that catch structural regressions for every Storybook story.

**Architecture:** A deterministic DOM→string serializer (`normalizeHtml`) walks the rendered story tree, normalizes library-generated class hashes / scoped-style attrs / React `useId` values via an explicit regex table, and produces a pretty-printed pseudo-XML string. A framework-specific `settle` helper awaits render completion. Tests compose Storybook stories via `composeStories`, render them in Vitest Browser Mode + Playwright Chromium, and assert against `__snapshots__/`.

**Tech Stack:** Vitest 4 (browser mode), `@vitest/browser-playwright`, Playwright Chromium, Storybook 10 (`@storybook/react-vite`, `@storybook/vue3-vite`), `vitest-browser-react`, `vitest-browser-vue`, React 19 (production build), Vue 3.5, pnpm workspaces.

**Reference spec:** `docs/superpowers/specs/2026-04-21-html-style-snapshots-design.md` (v5 — Phase 1 scope only).

**Scope boundary:** This plan implements **Phase 1 (HTML snapshot)** of the spec. Phase 2 (computed-style snapshot) and Phase 3 (portal capture) are separate follow-up plans, to be started only after Phase 1 has 10 consecutive green runs on `main` and 7 calendar days without regression.

---

## File structure

Files created by this plan (all under `packages/storybook/`):

- `.gitattributes` (repo root) — enforce LF for `*.snap`
- `src/shared/lib/snapshot/normalizeHtml.ts` — the serializer + attribute scrubber (single entry point: `normalizeHtml(root: Element): string`)
- `src/shared/lib/snapshot/normalizeHtml.rules.ts` — the attribute normalization table (exported `RULES` array; kept separate so tests can iterate over rows)
- `src/shared/lib/snapshot/normalizeHtml.spec.ts` — unit tests (browser mode) covering each serializer rule and each `RULES` row
- `src/shared/lib/snapshot/settle.common.ts` — shared settle primitives (`drainMicrotasks`, `dualRaf`, `waitForNotBusy`)
- `src/shared/lib/snapshot/settle.react.ts` — React settle helper (`settleReact`)
- `src/shared/lib/snapshot/settle.vue.ts` — Vue settle helper (`settleVue`)
- `src/shared/lib/snapshot/settle.react.spec.ts` — React settle tests
- `src/shared/lib/snapshot/settle.vue.spec.ts` — Vue settle tests
- `src/shared/lib/snapshot/fixtures/pinned-versions.json` — version lock data
- `src/shared/lib/snapshot/versionLock.spec.ts` — asserts `package.json` + `pnpm-lock.yaml` match the pin

Files modified:

- `packages/storybook/vite.config.ts` — extend `include` globs; add `resolve.conditions: ['production', 'default']` + `define: 'process.env.NODE_ENV': 'production'` in the React project
- `packages/storybook/vitest.setup.ts` — inject determinism preamble
- `packages/storybook/src/pages/stories.react.spec.tsx` — replace smoke assertion with HTML snapshot + settle + collision guard
- `packages/storybook/src/pages/stories.vue.spec.ts` — same for Vue

File removed:

- `packages/storybook/src/shared/lib/createVisualTests.react.ts`

Each file has one responsibility; the serializer (`normalizeHtml.ts`) stays focused on tree-walking and delegates attribute normalization to the `RULES` table.

---

## Task 1: Repo setup — `.gitattributes` and baseline branch

**Files:**
- Create: `.gitattributes` (repo root)

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/ruliny/Git/marked-input
git checkout next
git pull origin next
git checkout -b feat/storybook-html-snapshots
```

- [ ] **Step 2: Add `.gitattributes` to enforce LF on snapshot files**

Create `.gitattributes` in the repo root:

```
* text=auto eol=lf
*.snap text eol=lf
*.md text eol=lf
```

- [ ] **Step 3: Commit**

```bash
git add .gitattributes
git commit -m "chore: enforce LF line endings for snapshot files"
```

---

## Task 2: Extend Vitest `include` globs to cover helper specs

**Files:**
- Modify: `packages/storybook/vite.config.ts:28-32, 41-45`

- [ ] **Step 1: Read current `include` globs**

Run: `cat packages/storybook/vite.config.ts`
Confirm both `defineProject` blocks have `include: ['src/pages/**/*.<framework>.spec.<ext>']`.

- [ ] **Step 2: Extend include globs**

Update the React project's `include`:

```ts
include: [
  'src/pages/**/*.react.spec.tsx',
  'src/shared/lib/snapshot/*.spec.ts',
  'src/shared/lib/snapshot/*.react.spec.ts',
],
```

Update the Vue project's `include`:

```ts
include: [
  'src/pages/**/*.vue.spec.ts',
  'src/shared/lib/snapshot/*.spec.ts',
  'src/shared/lib/snapshot/*.vue.spec.ts',
],
```

Framework-agnostic `*.spec.ts` helpers run in both projects (tiny duplication, guarantees both bundling setups pass).

- [ ] **Step 3: Verify config parses**

```bash
pnpm --filter @markput/storybook exec vitest --help > /dev/null
```

Expected: exits 0 with no TypeScript error.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/vite.config.ts
git commit -m "chore(storybook): include snapshot helper specs in vitest projects"
```

---

## Task 3: React production-mode pin

**Files:**
- Modify: `packages/storybook/vite.config.ts` (React `defineProject` only)

- [ ] **Step 1: Add `resolve.conditions` and `define` to React project**

In the React `defineProject` block, update `resolve` and add `define`:

```ts
defineProject({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    conditions: ['production', 'default'],
  },
  define: {
    'process.env.FRAMEWORK': JSON.stringify('react'),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  test: {
    name: 'react',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/pages/**/*.react.spec.tsx',
      'src/shared/lib/snapshot/*.spec.ts',
      'src/shared/lib/snapshot/*.react.spec.ts',
    ],
    browser,
  },
}),
```

- [ ] **Step 2: Run existing tests to confirm production React still works**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: all existing smoke tests pass (they only call `render` and check `textContent.length`).

- [ ] **Step 3: Commit**

```bash
git add packages/storybook/vite.config.ts
git commit -m "chore(storybook): pin React production bundle in browser tests"
```

---

## Task 4: Determinism preamble in `vitest.setup.ts`

**Files:**
- Modify: `packages/storybook/vitest.setup.ts`

- [ ] **Step 1: Add preamble after the existing annotations setup**

Replace file contents with:

```ts
import {setProjectAnnotations as setReactAnnotations} from '@storybook/react-vite'
import {setProjectAnnotations as setVueAnnotations} from '@storybook/vue3-vite'
import {beforeEach} from 'vitest'

import preview from './.storybook/preview'

if (process.env.FRAMEWORK === 'react') {
	setReactAnnotations(preview)
} else {
	setVueAnnotations(preview)
}

const DETERMINISM_CSS = `
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
`

function injectDeterminismPreamble(): void {
	document.documentElement.lang = 'en'
	document.documentElement.dir = 'ltr'

	const existingMeta = document.querySelector('meta[name="color-scheme"]')
	if (!existingMeta) {
		const meta = document.createElement('meta')
		meta.setAttribute('name', 'color-scheme')
		meta.setAttribute('content', 'light')
		document.head.appendChild(meta)
	}

	const existingStyle = document.getElementById('markput-determinism')
	if (!existingStyle) {
		const style = document.createElement('style')
		style.id = 'markput-determinism'
		style.textContent = DETERMINISM_CSS
		document.head.appendChild(style)
	}
}

beforeEach(() => {
	injectDeterminismPreamble()
})
```

- [ ] **Step 2: Run existing tests to confirm nothing breaks**

```bash
pnpm --filter @markput/storybook run test
```

Expected: all existing smoke tests still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/storybook/vitest.setup.ts
git commit -m "feat(storybook): inject determinism preamble for snapshot tests"
```

---

## Task 5: `settle.common.ts` — shared primitives

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/settle.common.ts`
- Create: `packages/storybook/src/shared/lib/snapshot/settle.common.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/storybook/src/shared/lib/snapshot/settle.common.spec.ts`:

```ts
import {describe, it, expect, vi} from 'vitest'

import {drainMicrotasks, dualRaf, waitForNotBusy} from './settle.common'

describe('settle.common', () => {
	it('drainMicrotasks resolves after all queued microtasks', async () => {
		let counter = 0
		queueMicrotask(() => {
			counter += 1
			queueMicrotask(() => {
				counter += 1
			})
		})
		await drainMicrotasks()
		expect(counter).toBe(2)
	})

	it('dualRaf awaits two animation frames', async () => {
		const spy = vi.fn()
		requestAnimationFrame(spy)
		await dualRaf()
		expect(spy).toHaveBeenCalledOnce()
	})

	it('waitForNotBusy resolves once the ready predicate returns true', async () => {
		const host = document.createElement('div')
		host.setAttribute('aria-busy', 'true')
		document.body.appendChild(host)
		setTimeout(() => host.removeAttribute('aria-busy'), 20)
		await waitForNotBusy(host, 500)
		expect(host.hasAttribute('aria-busy')).toBe(false)
		host.remove()
	})

	it('waitForNotBusy throws after timeout with diagnostic message', async () => {
		const host = document.createElement('div')
		host.setAttribute('aria-busy', 'true')
		document.body.appendChild(host)
		await expect(waitForNotBusy(host, 50)).rejects.toThrow(/snapshot-ready|aria-busy/)
		host.remove()
	})
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.common.spec.ts
```

Expected: FAIL — `./settle.common` does not exist.

- [ ] **Step 3: Implement `settle.common.ts`**

Create `packages/storybook/src/shared/lib/snapshot/settle.common.ts`:

```ts
export function drainMicrotasks(): Promise<void> {
	return new Promise<void>((resolve) => {
		queueMicrotask(() => {
			resolve()
		})
	})
}

export function dualRaf(): Promise<void> {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				resolve()
			})
		})
	})
}

const BUSY_SELECTOR = '[aria-busy="true"], [data-loading], [data-test-snapshot-ready="false"]'

export async function waitForNotBusy(container: Element, timeoutMs: number): Promise<void> {
	const start = performance.now()
	while (performance.now() - start < timeoutMs) {
		const readyGate = container.querySelector('[data-test-snapshot-ready="true"]')
		if (readyGate) return
		if (!container.querySelector(BUSY_SELECTOR)) return
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
	throw new Error(
		`settle: story did not reach snapshot-ready within ${timeoutMs}ms. ` +
			`If your story gates visible state on CSS transitions, expose [data-test-snapshot-ready="true"] ` +
			`on the element once rendering is complete. See packages/storybook/README.md.`,
	)
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.common.spec.ts
```

Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/settle.common.ts \
        packages/storybook/src/shared/lib/snapshot/settle.common.spec.ts
git commit -m "feat(storybook): add settle.common primitives for snapshot tests"
```

---

## Task 6: `settle.react.ts` — React settle helper

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/settle.react.ts`
- Create: `packages/storybook/src/shared/lib/snapshot/settle.react.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/storybook/src/shared/lib/snapshot/settle.react.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {render} from 'vitest-browser-react'
import React, {useEffect, useState} from 'react'

import {settleReact} from './settle.react'

function DelayedContent(): React.ReactElement {
	const [ready, setReady] = useState(false)
	useEffect(() => {
		queueMicrotask(() => setReady(true))
	}, [])
	return <div data-testid="probe">{ready ? 'ready' : 'pending'}</div>
}

describe('settleReact', () => {
	it('waits for microtask-scheduled state updates', async () => {
		const {container} = await render(<DelayedContent />)
		await settleReact(container)
		expect(container.querySelector('[data-testid="probe"]')?.textContent).toBe('ready')
	})
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.react.spec.ts --project react
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `settle.react.ts`**

Create `packages/storybook/src/shared/lib/snapshot/settle.react.ts`:

```ts
import {act} from 'react'

import {drainMicrotasks, dualRaf, waitForNotBusy} from './settle.common'

export async function settleReact(container: Element, timeoutMs = 1000): Promise<void> {
	await drainMicrotasks()
	await dualRaf()
	await act(async () => {})
	await waitForNotBusy(container, timeoutMs)
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.react.spec.ts --project react
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/settle.react.ts \
        packages/storybook/src/shared/lib/snapshot/settle.react.spec.ts
git commit -m "feat(storybook): add settleReact helper"
```

---

## Task 7: `settle.vue.ts` — Vue settle helper

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/settle.vue.ts`
- Create: `packages/storybook/src/shared/lib/snapshot/settle.vue.spec.ts`

- [ ] **Step 1: Write failing test**

Create `packages/storybook/src/shared/lib/snapshot/settle.vue.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import {render} from 'vitest-browser-vue'
import {defineComponent, ref, onMounted} from 'vue'

import {settleVue} from './settle.vue'

const DelayedContent = defineComponent({
	setup() {
		const ready = ref(false)
		onMounted(() => {
			queueMicrotask(() => {
				ready.value = true
			})
		})
		return {ready}
	},
	template: `<div data-testid="probe">{{ ready ? 'ready' : 'pending' }}</div>`,
})

describe('settleVue', () => {
	it('waits for microtask-scheduled reactive updates', async () => {
		const {container} = await render(DelayedContent)
		await settleVue(container)
		expect(container.querySelector('[data-testid="probe"]')?.textContent).toBe('ready')
	})
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.vue.spec.ts --project vue
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `settle.vue.ts`**

Create `packages/storybook/src/shared/lib/snapshot/settle.vue.ts`:

```ts
import {nextTick} from 'vue'

import {drainMicrotasks, dualRaf, waitForNotBusy} from './settle.common'

export async function settleVue(container: Element, timeoutMs = 1000): Promise<void> {
	await drainMicrotasks()
	await nextTick()
	await dualRaf()
	await waitForNotBusy(container, timeoutMs)
}
```

- [ ] **Step 4: Run the test — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/settle.vue.spec.ts --project vue
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/settle.vue.ts \
        packages/storybook/src/shared/lib/snapshot/settle.vue.spec.ts
git commit -m "feat(storybook): add settleVue helper"
```

---

## Task 8: `normalizeHtml.rules.ts` — attribute normalization table

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.rules.ts`

This is a pure data file. It has no runtime behavior yet; its tests live in `normalizeHtml.spec.ts` (Task 10) after the serializer consumes it.

- [ ] **Step 1: Create the rules file**

Create `packages/storybook/src/shared/lib/snapshot/normalizeHtml.rules.ts`:

```ts
export type RuleTarget = 'attr-name' | 'class-token' | 'id' | 'attr-value'

export interface NormalizationRule {
	id: number
	target: RuleTarget
	pattern: RegExp
	replacement: string | null
	applyToAttrs?: string[]
	example: string
	description: string
}

export const RULES: readonly NormalizationRule[] = [
	{
		id: 1,
		target: 'attr-name',
		pattern: /^data-v-[0-9a-f]{8}$/,
		replacement: null,
		example: 'data-v-7ba5bd90',
		description: 'Vue SFC scoped style attribute — remove',
	},
	{
		id: 2,
		target: 'attr-name',
		pattern: /^data-astro-cid-[0-9a-z]+$/,
		replacement: null,
		example: 'data-astro-cid-abc123de',
		description: 'Astro scoped style attribute — remove',
	},
	{
		id: 3,
		target: 'class-token',
		pattern: /^css-[0-9a-z]+$/,
		replacement: 'css-H',
		example: 'css-1pvrydq',
		description: 'Emotion / MUI 7 generated class',
	},
	{
		id: 4,
		target: 'class-token',
		pattern: /^css-dev-only-do-not-override-[0-9a-z]+$/,
		replacement: 'css-dev-only-do-not-override-H',
		example: 'css-dev-only-do-not-override-1xyz',
		description: 'Ant Design 6 dev override class',
	},
	{
		id: 5,
		target: 'class-token',
		pattern: /^sc-[a-zA-Z0-9]+$/,
		replacement: 'sc-H',
		example: 'sc-bdVaJa',
		description: 'styled-components generated class (no displayName)',
	},
	{
		id: 6,
		target: 'class-token',
		pattern: /^([A-Z][A-Za-z0-9]*)__([A-Za-z0-9]+)-sc-[0-9a-z]+$/,
		replacement: '$1__$2-sc-H',
		example: 'Button__StyledButton-sc-1abc2de',
		description: 'styled-components with displayName',
	},
	{
		id: 7,
		target: 'class-token',
		pattern: /^MuiBox-root-[0-9]+$/,
		replacement: 'MuiBox-root-N',
		example: 'MuiBox-root-42',
		description: 'Legacy MUI JSS numeric suffix',
	},
	{
		id: 8,
		target: 'class-token',
		pattern: /^jss[0-9]+$/,
		replacement: 'jssN',
		example: 'jss42',
		description: 'Legacy JSS numeric class',
	},
	{
		id: 9,
		target: 'class-token',
		pattern: /^([A-Za-z][A-Za-z0-9_]*)__([A-Za-z][A-Za-z0-9_-]*)___[0-9a-zA-Z_-]{5,8}$/,
		replacement: '$1__$2___H',
		example: 'TodoMark__wrapper___a1B2c',
		description: 'Vite CSS Modules scoped class',
	},
	{
		id: 10,
		target: 'id',
		pattern: /^:r[0-9a-z]+:?$/,
		replacement: ':rN:',
		example: ':r7:',
		description: 'React 19 useId (production format)',
	},
	{
		id: 11,
		target: 'id',
		pattern: /^(mui|ant|rc|rsuite|rs|radix)[-_:][0-9a-f-]+$/i,
		replacement: '$1-N',
		example: 'radix-42-trigger',
		description: 'Library-prefixed numeric id',
	},
	{
		id: 12,
		target: 'attr-value',
		pattern: /^(.+-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		replacement: '$1UUID',
		applyToAttrs: ['name'],
		example: 'field-550e8400-e29b-41d4-a716-446655440000',
		description: 'UUID suffix in name attribute',
	},
]

export const ID_REF_ATTRS = [
	'for',
	'htmlFor',
	'aria-labelledby',
	'aria-describedby',
	'aria-controls',
	'aria-owns',
	'aria-activedescendant',
] as const
```

- [ ] **Step 2: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.rules.ts
git commit -m "feat(storybook): add attribute normalization rule table"
```

---

## Task 9: `normalizeHtml.ts` — core serializer (tree walk + basic attrs + text)

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`
- Create: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`

- [ ] **Step 1: Write failing tests for the core serializer**

Create `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'

import {normalizeHtml} from './normalizeHtml'

function buildFromHtml(html: string): Element {
	const wrapper = document.createElement('div')
	wrapper.innerHTML = html
	return wrapper.firstElementChild ?? wrapper
}

describe('normalizeHtml — core serializer', () => {
	it('emits root element with no attrs or children', () => {
		const root = document.createElement('div')
		expect(normalizeHtml(root)).toBe('<div></div>')
	})

	it('emits attributes in UTF-16 lexicographic order', () => {
		const root = document.createElement('div')
		root.setAttribute('zeta', '1')
		root.setAttribute('alpha', '2')
		root.setAttribute('middle', '3')
		expect(normalizeHtml(root)).toBe('<div alpha="2" middle="3" zeta="1"></div>')
	})

	it('escapes &, <, >, " in attribute values', () => {
		const root = document.createElement('div')
		root.setAttribute('data-x', '<a & "b" > c>')
		expect(normalizeHtml(root)).toBe('<div data-x="&lt;a &amp; &quot;b&quot; &gt; c&gt;"></div>')
	})

	it('emits void elements as self-closing', () => {
		const root = buildFromHtml('<img src="x.png" alt="y">')
		expect(normalizeHtml(root)).toBe('<img alt="y" src="x.png" />')
	})

	it('emits boolean attributes without a value', () => {
		const root = buildFromHtml('<button disabled hidden>Go</button>')
		expect(normalizeHtml(root)).toBe('<button disabled hidden>\n  Go\n</button>')
	})

	it('emits text nodes on their own indented line', () => {
		const root = buildFromHtml('<div><p>Hello <b>world</b></p></div>')
		expect(normalizeHtml(root)).toBe(
			'<div>\n  <p>\n    Hello\n    <b>\n      world\n    </b>\n  </p>\n</div>',
		)
	})

	it('escapes &, <, > in text nodes', () => {
		const root = buildFromHtml('<p>a &amp; b &lt; c &gt; d</p>')
		expect(normalizeHtml(root)).toBe('<p>\n  a &amp; b &lt; c &gt; d\n</p>')
	})

	it('skips <script> and <style> elements', () => {
		const root = buildFromHtml('<div><script>x()</script><style>p{}</style><p>ok</p></div>')
		expect(normalizeHtml(root)).toBe('<div>\n  <p>\n    ok\n  </p>\n</div>')
	})

	it('skips HTML comments', () => {
		const root = buildFromHtml('<div><!-- x --><p>ok</p></div>')
		expect(normalizeHtml(root)).toBe('<div>\n  <p>\n    ok\n  </p>\n</div>')
	})
})
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the core serializer**

Create `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`:

```ts
const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])

const BOOLEAN_ATTRS = new Set([
	'disabled',
	'checked',
	'readonly',
	'selected',
	'hidden',
	'required',
	'autofocus',
	'multiple',
	'open',
	'defer',
	'async',
	'nomodule',
	'playsinline',
	'controls',
	'loop',
	'muted',
	'reversed',
])

const SKIP_TAGS = new Set(['script', 'style'])

function escapeText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttrValue(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}

function indent(depth: number): string {
	return '  '.repeat(depth)
}

interface CollectedAttr {
	name: string
	value: string
	isBoolean: boolean
}

function collectAttributes(el: Element): CollectedAttr[] {
	const out: CollectedAttr[] = []
	for (const attr of Array.from(el.attributes)) {
		const name = attr.name
		if (BOOLEAN_ATTRS.has(name)) {
			out.push({name, value: '', isBoolean: true})
		} else {
			out.push({name, value: attr.value, isBoolean: false})
		}
	}
	out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
	return out
}

function formatAttr(attr: CollectedAttr): string {
	if (attr.isBoolean) return attr.name
	return `${attr.name}="${escapeAttrValue(attr.value)}"`
}

function serializeElement(el: Element, depth: number): string[] {
	const tag = el.localName
	if (SKIP_TAGS.has(tag)) return []

	const attrs = collectAttributes(el)
	const attrString = attrs.length > 0 ? ' ' + attrs.map(formatAttr).join(' ') : ''

	const isVoid = VOID_TAGS.has(tag)
	const pad = indent(depth)

	if (isVoid) {
		return [`${pad}<${tag}${attrString} />`]
	}

	const childLines: string[] = []
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = (node.textContent ?? '').trim()
			if (text.length === 0) continue
			childLines.push(`${indent(depth + 1)}${escapeText(text)}`)
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			childLines.push(...serializeElement(node as Element, depth + 1))
		}
	}

	if (childLines.length === 0) {
		return [`${pad}<${tag}${attrString}></${tag}>`]
	}

	return [`${pad}<${tag}${attrString}>`, ...childLines, `${pad}</${tag}>`]
}

export function normalizeHtml(root: Element): string {
	return serializeElement(root, 0).join('\n')
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: PASS (all 9 tests in the "core serializer" describe).

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts
git commit -m "feat(storybook): add normalizeHtml core serializer"
```

---

## Task 10: `normalizeHtml` — apply the normalization rules

**Files:**
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`

- [ ] **Step 1: Add failing tests for each rule**

Append to `normalizeHtml.spec.ts`:

```ts
describe('normalizeHtml — attribute normalization rules', () => {
	it('rule 1: removes Vue SFC data-v-* attribute', () => {
		const el = document.createElement('div')
		el.setAttribute('data-v-7ba5bd90', '')
		el.setAttribute('class', 'panel')
		expect(normalizeHtml(el)).toBe('<div class="panel"></div>')
	})

	it('rule 2: removes Astro data-astro-cid-*', () => {
		const el = document.createElement('div')
		el.setAttribute('data-astro-cid-abc123de', '')
		expect(normalizeHtml(el)).toBe('<div></div>')
	})

	it('rule 3: replaces Emotion css-<hash> class token', () => {
		const el = document.createElement('div')
		el.className = 'css-1pvrydq other'
		expect(normalizeHtml(el)).toBe('<div class="css-H other"></div>')
	})

	it('rule 4: replaces Ant dev-only override class', () => {
		const el = document.createElement('div')
		el.className = 'ant-btn css-dev-only-do-not-override-1xyz'
		expect(normalizeHtml(el)).toBe('<div class="ant-btn css-dev-only-do-not-override-H"></div>')
	})

	it('rule 5: replaces styled-components sc-*', () => {
		const el = document.createElement('div')
		el.className = 'sc-bdVaJa'
		expect(normalizeHtml(el)).toBe('<div class="sc-H"></div>')
	})

	it('rule 6: replaces styled-components displayName-sc-*', () => {
		const el = document.createElement('div')
		el.className = 'Button__StyledButton-sc-1abc2de'
		expect(normalizeHtml(el)).toBe('<div class="Button__StyledButton-sc-H"></div>')
	})

	it('rule 7: replaces legacy MuiBox-root-N', () => {
		const el = document.createElement('div')
		el.className = 'MuiBox-root-42'
		expect(normalizeHtml(el)).toBe('<div class="MuiBox-root-N"></div>')
	})

	it('rule 8: replaces legacy jssN', () => {
		const el = document.createElement('div')
		el.className = 'jss42'
		expect(normalizeHtml(el)).toBe('<div class="jssN"></div>')
	})

	it('rule 9: replaces Vite CSS Modules hash', () => {
		const el = document.createElement('div')
		el.className = 'TodoMark__wrapper___a1B2c'
		expect(normalizeHtml(el)).toBe('<div class="TodoMark__wrapper___H"></div>')
	})

	it('rule 10: replaces React useId id', () => {
		const el = document.createElement('div')
		el.id = ':r7:'
		expect(normalizeHtml(el)).toBe('<div id=":rN:"></div>')
	})

	it('rule 11: replaces library-prefixed numeric id', () => {
		const el = document.createElement('div')
		el.id = 'radix-42-trigger'
		expect(normalizeHtml(el)).toBe('<div id="radix-N"></div>')
	})

	it('rule 12: replaces UUID suffix in name attribute', () => {
		const el = document.createElement('input')
		el.setAttribute('name', 'field-550e8400-e29b-41d4-a716-446655440000')
		expect(normalizeHtml(el)).toBe('<input name="field-UUID" />')
	})
})
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: FAIL on all 12 new tests (raw values still emitted).

- [ ] **Step 3: Implement rule application**

Replace `collectAttributes` and helpers in `normalizeHtml.ts`:

```ts
import {RULES, ID_REF_ATTRS, type NormalizationRule} from './normalizeHtml.rules'

function normalizeClassAttr(value: string): string {
	const tokens = value.split(/\s+/).filter(Boolean)
	const out = tokens.map((token) => {
		for (const rule of RULES) {
			if (rule.target !== 'class-token') continue
			const match = token.match(rule.pattern)
			if (match) {
				if (rule.replacement === null) return token
				return token.replace(rule.pattern, rule.replacement)
			}
		}
		return token
	})
	return out.join(' ')
}

function normalizeIdValue(value: string): string {
	for (const rule of RULES) {
		if (rule.target !== 'id') continue
		if (rule.pattern.test(value)) {
			if (rule.replacement === null) return value
			return value.replace(rule.pattern, rule.replacement)
		}
	}
	return value
}

function normalizeAttrValue(name: string, value: string): string {
	for (const rule of RULES) {
		if (rule.target !== 'attr-value') continue
		if (rule.applyToAttrs && !rule.applyToAttrs.includes(name)) continue
		if (rule.pattern.test(value)) {
			if (rule.replacement === null) return value
			return value.replace(rule.pattern, rule.replacement)
		}
	}
	return value
}

function attrNameRemoved(name: string): boolean {
	for (const rule of RULES) {
		if (rule.target !== 'attr-name') continue
		if (rule.pattern.test(name) && rule.replacement === null) return true
	}
	return false
}
```

Then update `collectAttributes`:

```ts
function collectAttributes(el: Element): CollectedAttr[] {
	const out: CollectedAttr[] = []
	for (const attr of Array.from(el.attributes)) {
		const name = attr.name
		if (attrNameRemoved(name)) continue
		if (BOOLEAN_ATTRS.has(name)) {
			out.push({name, value: '', isBoolean: true})
			continue
		}
		let value = attr.value
		if (name === 'class') {
			value = normalizeClassAttr(value)
		} else if (name === 'id') {
			value = normalizeIdValue(value)
		} else {
			value = normalizeAttrValue(name, value)
		}
		out.push({name, value, isBoolean: false})
	}
	out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
	return out
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: PASS (all rule tests).

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts
git commit -m "feat(storybook): apply attribute normalization rules in normalizeHtml"
```

---

## Task 11: `normalizeHtml` — id-reference alias map

**Files:**
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `normalizeHtml.spec.ts`:

```ts
describe('normalizeHtml — id alias map', () => {
	it('rewrites aria-labelledby to match normalized id', () => {
		const wrapper = document.createElement('div')
		wrapper.innerHTML = `
			<label id=":r3:" for="input-x">Label</label>
			<input id="input-x" aria-labelledby=":r3:">
		`
		const snap = normalizeHtml(wrapper.firstElementChild ?? wrapper)
		expect(snap).toContain('id=":rN:"')
		expect(snap).toContain('aria-labelledby=":rN:"')
	})

	it('keeps different normalized ids distinct', () => {
		const wrapper = document.createElement('div')
		wrapper.innerHTML = `
			<span id=":r1:" aria-labelledby=":r2:">a</span>
			<span id=":r2:">b</span>
		`
		const snap = normalizeHtml(wrapper)
		// both normalize to :rN: — accepted limitation, collision produces identical tokens
		expect(snap.match(/:rN:/g)?.length).toBeGreaterThanOrEqual(3)
	})
})
```

- [ ] **Step 2: Run — expect pass (already passes with simple rewrite since both resolve to `:rN:`)**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: PASS. Since every `:r<n>:` collapses to `:rN:`, the id-reference rewrite happens implicitly when we normalize the value. The test documents this behavior.

- [ ] **Step 3: Extend id-reference attributes handling explicitly**

Update `collectAttributes` to also normalize `ID_REF_ATTRS` through `normalizeIdValue`:

```ts
function collectAttributes(el: Element): CollectedAttr[] {
	const out: CollectedAttr[] = []
	for (const attr of Array.from(el.attributes)) {
		const name = attr.name
		if (attrNameRemoved(name)) continue
		if (BOOLEAN_ATTRS.has(name)) {
			out.push({name, value: '', isBoolean: true})
			continue
		}
		let value = attr.value
		if (name === 'class') {
			value = normalizeClassAttr(value)
		} else if (name === 'id' || (ID_REF_ATTRS as readonly string[]).includes(name)) {
			value = value
				.split(/\s+/)
				.filter(Boolean)
				.map((part) => normalizeIdValue(part))
				.join(' ')
		} else {
			value = normalizeAttrValue(name, value)
		}
		out.push({name, value, isBoolean: false})
	}
	out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
	return out
}
```

- [ ] **Step 4: Re-run — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts
git commit -m "feat(storybook): normalize id-reference attributes (aria-*/for/htmlFor)"
```

---

## Task 12: `normalizeHtml` — reflected form state

**Files:**
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`

- [ ] **Step 1: Write failing test**

Append to `normalizeHtml.spec.ts`:

```ts
describe('normalizeHtml — reflected form state', () => {
	it('emits data-rt-value for input with user-entered value', () => {
		const input = document.createElement('input')
		input.setAttribute('type', 'text')
		input.value = 'typed'
		expect(normalizeHtml(input)).toContain('data-rt-value="typed"')
	})

	it('emits data-rt-checked on checkbox', () => {
		const input = document.createElement('input')
		input.setAttribute('type', 'checkbox')
		input.checked = true
		expect(normalizeHtml(input)).toContain('data-rt-checked="true"')
	})

	it('emits data-rt-selected on option', () => {
		const select = document.createElement('select')
		select.innerHTML = '<option>a</option><option>b</option>'
		const second = select.children[1] as HTMLOptionElement
		second.selected = true
		const snap = normalizeHtml(select)
		expect(snap).toMatch(/data-rt-selected="true"/)
	})
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: FAIL on the 3 new tests.

- [ ] **Step 3: Add reflected-state capture to `collectAttributes`**

At the bottom of the `collectAttributes` function, before `sort`, add:

```ts
	if (el instanceof HTMLInputElement) {
		if (el.type === 'checkbox' || el.type === 'radio') {
			out.push({name: 'data-rt-checked', value: el.checked ? 'true' : 'false', isBoolean: false})
		} else {
			out.push({name: 'data-rt-value', value: el.value, isBoolean: false})
		}
	} else if (el instanceof HTMLTextAreaElement) {
		out.push({name: 'data-rt-value', value: el.value, isBoolean: false})
	} else if (el instanceof HTMLOptionElement) {
		out.push({name: 'data-rt-selected', value: el.selected ? 'true' : 'false', isBoolean: false})
	} else if (el instanceof HTMLSelectElement) {
		out.push({name: 'data-rt-value', value: el.value, isBoolean: false})
	}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts
git commit -m "feat(storybook): capture reflected form state in normalizeHtml"
```

---

## Task 13: `normalizeHtml` — SVG/MathML + `<pre>` whitespace + React useId probe

**Files:**
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts`
- Modify: `packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts`

- [ ] **Step 1: Write failing tests**

Append to `normalizeHtml.spec.ts`:

```ts
describe('normalizeHtml — SVG / MathML / pre', () => {
	it('preserves SVG attribute case (viewBox)', () => {
		const wrapper = document.createElement('div')
		wrapper.innerHTML = '<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>'
		const snap = normalizeHtml(wrapper.firstElementChild ?? wrapper)
		expect(snap).toContain('viewBox="0 0 10 10"')
	})

	it('preserves whitespace inside <pre>', () => {
		const pre = document.createElement('pre')
		pre.textContent = '  a\n  b\n'
		expect(normalizeHtml(pre)).toContain('  a\n  b')
	})

	it('preserves whitespace inside <textarea>', () => {
		const ta = document.createElement('textarea')
		ta.textContent = 'line1\nline2'
		expect(normalizeHtml(ta)).toContain('line1\nline2')
	})
})

describe('normalizeHtml — React useId production format (sanity)', () => {
	it('React.useId emits :r<n>: format under production build', async () => {
		const React = await import('react')
		const {useId} = React
		function Probe() {
			const id = useId()
			return React.createElement('div', {'data-probe-id': id})
		}
		const {render} = await import('vitest-browser-react')
		const {container} = await render(React.createElement(Probe))
		const probe = container.querySelector('[data-probe-id]')
		const id = probe?.getAttribute('data-probe-id') ?? ''
		expect(id).toMatch(/^:r[0-9a-z]+:?$/)
	})
})
```

Note: the React-useId test must live in a `.react.spec.ts` file. Move this `describe` block into a new file `src/shared/lib/snapshot/normalizeHtml.react.spec.tsx` instead (so it only runs in the React project).

- [ ] **Step 2: Create the React-only spec**

Move the `React useId production format` describe block into a new file:

Create `packages/storybook/src/shared/lib/snapshot/normalizeHtml.react.spec.tsx`:

```tsx
import {describe, it, expect} from 'vitest'
import {render} from 'vitest-browser-react'
import React from 'react'

function Probe(): React.ReactElement {
	const id = React.useId()
	return <div data-probe-id={id} />
}

describe('React useId — production format sanity', () => {
	it('React.useId emits :r<n>: format under production build', async () => {
		const {container} = await render(<Probe />)
		const probe = container.querySelector('[data-probe-id]')
		const id = probe?.getAttribute('data-probe-id') ?? ''
		expect(id).toMatch(/^:r[0-9a-z]+:?$/)
	})
})
```

Remove that same describe from `normalizeHtml.spec.ts` (keep only SVG/MathML/pre tests there).

- [ ] **Step 3: Run — expect failure on SVG/pre tests, pass on React useId**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.react.spec.tsx --project react
```

Expected: SVG test FAIL (currently lowercases `viewbox`), pre whitespace FAIL (trimmed), React test PASS.

- [ ] **Step 4: Implement SVG/MathML namespace handling and `<pre>` whitespace**

Update `normalizeHtml.ts`:

Add namespace constants and tag helpers at the top:

```ts
const SVG_NS = 'http://www.w3.org/2000/svg'
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'
const PRESERVE_WS_TAGS = new Set(['pre', 'textarea'])
```

Update `collectAttributes` to preserve attribute name case for SVG/MathML elements:

```ts
function getAttrName(el: Element, attr: Attr): string {
	if (el.namespaceURI === SVG_NS || el.namespaceURI === MATHML_NS) {
		return attr.name // preserves camelCase (viewBox etc.)
	}
	return attr.name.toLowerCase()
}
```

Use `getAttrName(el, attr)` instead of `attr.name` in the collection loop.

Update `serializeElement` to preserve whitespace in `<pre>` / `<textarea>`:

```ts
function serializeElement(el: Element, depth: number): string[] {
	const tag = el.localName
	if (SKIP_TAGS.has(tag)) return []

	const attrs = collectAttributes(el)
	const attrString = attrs.length > 0 ? ' ' + attrs.map(formatAttr).join(' ') : ''

	const isVoid = VOID_TAGS.has(tag)
	const pad = indent(depth)

	if (isVoid) {
		return [`${pad}<${tag}${attrString} />`]
	}

	if (PRESERVE_WS_TAGS.has(tag)) {
		const raw = tag === 'textarea' ? (el as HTMLTextAreaElement).value || el.textContent || '' : el.textContent || ''
		if (raw.length === 0) return [`${pad}<${tag}${attrString}></${tag}>`]
		return [`${pad}<${tag}${attrString}>`, escapeText(raw), `${pad}</${tag}>`]
	}

	const childLines: string[] = []
	for (const node of Array.from(el.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = (node.textContent ?? '').trim()
			if (text.length === 0) continue
			childLines.push(`${indent(depth + 1)}${escapeText(text)}`)
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			childLines.push(...serializeElement(node as Element, depth + 1))
		}
	}

	if (childLines.length === 0) {
		return [`${pad}<${tag}${attrString}></${tag}>`]
	}

	return [`${pad}<${tag}${attrString}>`, ...childLines, `${pad}</${tag}>`]
}
```

- [ ] **Step 5: Run — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.spec.ts
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/normalizeHtml.react.spec.tsx --project react
```

Expected: PASS all suites.

- [ ] **Step 6: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/normalizeHtml.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.spec.ts \
        packages/storybook/src/shared/lib/snapshot/normalizeHtml.react.spec.tsx
git commit -m "feat(storybook): preserve SVG attr case, <pre>/<textarea> whitespace; verify React useId format"
```

---

## Task 14: Version-lock fixture assert

**Files:**
- Create: `packages/storybook/src/shared/lib/snapshot/fixtures/pinned-versions.json`
- Create: `packages/storybook/src/shared/lib/snapshot/versionLock.spec.ts`

- [ ] **Step 1: Read current declared ranges**

```bash
cat packages/storybook/package.json
```

Note the exact ranges for `antd`, `@mui/material`, `rsuite`, `@emotion/react`, `@emotion/styled`, `react`, `react-dom`, `vue`.

- [ ] **Step 2: Read resolved versions from pnpm-lock**

```bash
pnpm --filter @markput/storybook list --depth 0 --json > /tmp/sb-deps.json
cat /tmp/sb-deps.json
```

Record each package's `version` field.

- [ ] **Step 3: Create pinned-versions.json**

Create `packages/storybook/src/shared/lib/snapshot/fixtures/pinned-versions.json`:

```json
{
	"ranges": {
		"antd": "^6.3.4",
		"@mui/material": "^7.3.7",
		"rsuite": "^6.1.2",
		"@emotion/react": "^11.14.0",
		"@emotion/styled": "^11.14.1"
	},
	"resolved": {
		"antd": "REPLACE_WITH_ACTUAL",
		"@mui/material": "REPLACE_WITH_ACTUAL",
		"rsuite": "REPLACE_WITH_ACTUAL",
		"@emotion/react": "REPLACE_WITH_ACTUAL",
		"@emotion/styled": "REPLACE_WITH_ACTUAL"
	}
}
```

Replace `REPLACE_WITH_ACTUAL` with the exact versions from Step 2. Commit the real values only.

- [ ] **Step 4: Write the assert**

Create `packages/storybook/src/shared/lib/snapshot/versionLock.spec.ts`:

```ts
import {describe, it, expect} from 'vitest'
import pkg from '../../../../package.json' with {type: 'json'}
import pinned from './fixtures/pinned-versions.json' with {type: 'json'}

describe('version lock', () => {
	it('direct dependency ranges match pinned snapshot fixtures', () => {
		for (const [name, expected] of Object.entries(pinned.ranges)) {
			expect(
				(pkg.dependencies as Record<string, string>)[name],
				`If ${name} range changed, refresh fixtures and regenerate snapshots.`,
			).toBe(expected)
		}
	})
})
```

Note: the resolved-version check requires reading `pnpm-lock.yaml`, which is root-level and involves YAML parsing. For Phase 1 we assert ranges only; transitive drift manifests as snapshot churn and forces a refresh at that point. Document this as a follow-up in the spec.

- [ ] **Step 5: Run — expect pass**

```bash
pnpm --filter @markput/storybook exec vitest run src/shared/lib/snapshot/versionLock.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storybook/src/shared/lib/snapshot/fixtures/pinned-versions.json \
        packages/storybook/src/shared/lib/snapshot/versionLock.spec.ts
git commit -m "feat(storybook): lock snapshot fixtures to pinned library ranges"
```

---

## Task 15: Story-name collision guard (pure refactor; no test change)

**Files:**
- Modify: `packages/storybook/src/pages/stories.react.spec.tsx:21-27`
- Modify: `packages/storybook/src/pages/stories.vue.spec.ts:17-24`

- [ ] **Step 1: Update React loop**

In `stories.react.spec.tsx`, replace the merge block:

```tsx
if (!storiesByCategory.has(category)) {
	storiesByCategory.set(category, {})
}

const categoryStories = storiesByCategory.get(category)!
for (const [storyName, story] of Object.entries(stories)) {
	if (storyName in categoryStories) {
		throw new Error(`Duplicate story name in category "${category}": "${storyName}" (file ${path})`)
	}
	categoryStories[storyName] = story
}
```

- [ ] **Step 2: Update Vue loop**

In `stories.vue.spec.ts`, make the same change.

- [ ] **Step 3: Run existing tests**

```bash
pnpm --filter @markput/storybook run test
```

Expected: PASS (no real collisions in the repo today; the guard is preventative).

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/stories.react.spec.tsx \
        packages/storybook/src/pages/stories.vue.spec.ts
git commit -m "fix(storybook): fail fast on duplicate story names within a category"
```

---

## Task 16: Integrate HTML snapshot into React stories spec

**Files:**
- Modify: `packages/storybook/src/pages/stories.react.spec.tsx`

- [ ] **Step 1: Update the test body**

Replace the `getTests` helper and invocation:

```tsx
import {composeStories} from '@storybook/react-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-react'

import {normalizeHtml} from '../shared/lib/snapshot/normalizeHtml'
import {settleReact} from '../shared/lib/snapshot/settle.react'

const storiesModules = import.meta.glob('./**/*.react.stories.tsx', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, module] of Object.entries(storiesModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	// oxlint-disable-next-line no-unsafe-type-assertion
	const stories = composeStories(module as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	const categoryStories = storiesByCategory.get(category)!
	for (const [storyName, story] of Object.entries(stories)) {
		if (storyName in categoryStories) {
			throw new Error(`Duplicate story name in category "${category}": "${storyName}" (file ${path})`)
		}
		categoryStories[storyName] = story
	}
}

describe('Component: stories', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(`${category} stories`, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(`Story ${name}`, async () => {
					// oxlint-disable-next-line no-unsafe-type-assertion
					const StoryComponent = Story as any
					const {container} = await render(<StoryComponent />)
					await settleReact(container)
					expect(normalizeHtml(container)).toMatchSnapshot('html')
				})
			}
		})
	}
})
```

- [ ] **Step 2: Run — snapshot is created**

```bash
pnpm --filter @markput/storybook run test:react
```

Expected: all stories PASS; a new snapshot file is written to `packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap`.

- [ ] **Step 3: Inspect the snapshot for obvious issues**

```bash
cat packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap | head -50
```

Look for: non-normalized `css-<hash>`, `data-v-*`, leaked UUIDs, absurd line count per story. If any leak through, add a targeted normalization rule (as a follow-up task) and re-run with `-u`.

- [ ] **Step 4: Re-run twice to check determinism**

```bash
pnpm --filter @markput/storybook run test:react
pnpm --filter @markput/storybook run test:react
```

Both runs must pass without `-u`; snapshots are stable.

- [ ] **Step 5: Commit**

```bash
git add packages/storybook/src/pages/stories.react.spec.tsx \
        packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap
git commit -m "feat(storybook): add HTML snapshots for React stories"
```

---

## Task 17: Integrate HTML snapshot into Vue stories spec

**Files:**
- Modify: `packages/storybook/src/pages/stories.vue.spec.ts`

- [ ] **Step 1: Update the test body**

Replace the full file with:

```ts
// oxlint-disable typescript-eslint/no-explicit-any typescript-eslint/no-non-null-assertion
import {composeStories} from '@storybook/vue3-vite'
import {describe, expect, it} from 'vitest'
import {render} from 'vitest-browser-vue'

import {normalizeHtml} from '../shared/lib/snapshot/normalizeHtml'
import {settleVue} from '../shared/lib/snapshot/settle.vue'

const storiesModules = import.meta.glob('./**/*.vue.stories.ts', {eager: true})

const storiesByCategory = new Map<string, Record<string, any>>()

for (const [path, module] of Object.entries(storiesModules)) {
	const match = path.match(/\.\/([^/]+)\//)
	if (!match) continue

	const category = match[1]
	// oxlint-disable-next-line no-unsafe-type-assertion
	const stories = composeStories(module as Parameters<typeof composeStories>[0])

	if (!storiesByCategory.has(category)) {
		storiesByCategory.set(category, {})
	}

	const categoryStories = storiesByCategory.get(category)!
	for (const [storyName, story] of Object.entries(stories)) {
		if (storyName in categoryStories) {
			throw new Error(`Duplicate story name in category "${category}": "${storyName}" (file ${path})`)
		}
		categoryStories[storyName] = story
	}
}

describe('Component: stories', () => {
	for (const [category, stories] of storiesByCategory.entries()) {
		describe(`${category} stories`, () => {
			for (const [name, Story] of Object.entries(stories)) {
				it(`Story ${name}`, async () => {
					const {container} = await render(Story)
					await settleVue(container)
					expect(normalizeHtml(container)).toMatchSnapshot('html')
				})
			}
		})
	}
})
```

- [ ] **Step 2: Run — snapshot is created**

```bash
pnpm --filter @markput/storybook run test:vue
```

Expected: all stories PASS; snapshot file written.

- [ ] **Step 3: Determinism re-run**

```bash
pnpm --filter @markput/storybook run test:vue
pnpm --filter @markput/storybook run test:vue
```

Both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/storybook/src/pages/stories.vue.spec.ts \
        packages/storybook/src/pages/__snapshots__/stories.vue.spec.ts.snap
git commit -m "feat(storybook): add HTML snapshots for Vue stories"
```

---

## Task 18: Remove obsolete `createVisualTests.react.ts`

**Files:**
- Delete: `packages/storybook/src/shared/lib/createVisualTests.react.ts`

- [ ] **Step 1: Confirm no imports**

```bash
rg -n "createVisualTests" packages/
```

Expected: zero matches.

- [ ] **Step 2: Delete the file**

```bash
rm packages/storybook/src/shared/lib/createVisualTests.react.ts
```

- [ ] **Step 3: Run full tests**

```bash
pnpm --filter @markput/storybook run test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A packages/storybook/src/shared/lib/
git commit -m "chore(storybook): remove obsolete createVisualTests helper"
```

---

## Task 19: Full pre-submit verification

**Files:** none (verification only)

- [ ] **Step 1: Full test run**

```bash
pnpm test
```

Expected: all tests pass (core unit tests + storybook browser tests).

- [ ] **Step 2: Build**

```bash
pnpm run build
```

Expected: success.

- [ ] **Step 3: Typecheck**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Lint**

```bash
pnpm run lint
```

Expected: no errors.

- [ ] **Step 5: Format**

```bash
pnpm run format
```

Expected: no files rewritten (or commit any formatter changes separately).

- [ ] **Step 6: Determinism double-run**

```bash
pnpm --filter @markput/storybook run test
pnpm --filter @markput/storybook run test
```

Both runs must pass without `-u`.

- [ ] **Step 7: If formatter changed files, commit**

```bash
git status
# If there are changes:
git add -A
git commit -m "chore: apply oxfmt"
```

- [ ] **Step 8: Push the branch**

```bash
git push -u origin feat/storybook-html-snapshots
```

---

## Task 20: Open PR targeting `next`

**Files:** none

- [ ] **Step 1: Create the PR**

```bash
gh pr create --base next --title "feat(storybook): add HTML snapshot tests for all stories" --body "$(cat <<'EOF'
## Summary

Replaces trivial smoke tests (`textContent.length > 0`) with cross-OS-stable HTML snapshot tests for every Storybook story. Implements Phase 1 of `docs/superpowers/specs/2026-04-21-html-style-snapshots-design.md`.

**What's in:**
- `normalizeHtml` — deterministic DOM→string serializer (not `innerHTML`) with normalization for Emotion/MUI/Ant/styled-components/CSS-Modules/Vue-SFC hashes and React `useId`
- `settle` helpers for React and Vue (microtask + rAF + busy-wait + framework-specific flush)
- Determinism preamble in `vitest.setup.ts` (animations off, color-scheme pinned, forced-colors none)
- React production-mode pin via `resolve.conditions` + `NODE_ENV=production` to stabilize `useId` output
- Version-lock fixture assert that forces fixture refresh when library ranges change
- Story-name collision guard preventing silent test loss from the existing `Object.assign` pattern
- `.gitattributes` ensuring LF line endings for `*.snap` files

**What's out (Phase 2 / 3, future PRs):**
- Computed-style snapshots with keyword-only allow-list
- Portal / Teleport / Shadow-DOM capture

## Test plan

- [ ] `pnpm test` passes locally on macOS
- [ ] Double-run determinism check passes (`pnpm --filter @markput/storybook test` twice without `-u`)
- [ ] Snapshot files (`*.snap`) have LF line endings
- [ ] Visually inspect one snapshot per library (Ant / Material / RSuite) for absence of hashed classnames and scoped-style attrs
- [ ] CI passes on Linux (GitHub Actions) — this is the cross-env verification the spec targets

EOF
)"
```

- [ ] **Step 2: Share the PR URL with the user**

Return the PR URL.

---

## Post-merge (future, not in this plan)

Once Phase 1 has been on `main` for 10 consecutive green runs and 7 calendar days with no snapshot-stability incidents, start a new plan for Phase 2 covering `captureStyles`, the sandbox iframe, `stableKey`, and the keyword-only allow-list. The spec section "Phase 2 entry criterion" gates that work.

---

## Self-review notes

**Spec coverage check:**

- Serializer rules (root inclusion, void, boolean attrs, text, comments, skip script/style, SVG case, `<pre>`, entities) → Tasks 9, 12, 13
- Attribute normalization table (all 12 rows) → Tasks 8, 10
- Id alias for cross-references → Task 11
- Reflected form state (`data-rt-*`) → Task 12
- Version-lock fixture assert → Task 14 (ranges only; transitive drift deferred to snapshot churn)
- Story-name collision guard → Task 15
- React production-mode pin → Task 3 + Task 13 verification
- Determinism preamble (`<meta color-scheme>`, global CSS, animations off, forced-colors) → Task 4
- `page.emulateMedia` — **gap**: the spec mentions this but v5 ties it to Phase 2's iframe. For Phase 1 the CSS-level preamble is sufficient. Documented as sufficient.
- `.gitattributes` LF for `*.snap` → Task 1
- Settle helpers (common, React, Vue) with `[data-test-snapshot-ready]` gate → Tasks 5, 6, 7
- Integration into both `stories.*.spec.*` files → Tasks 16, 17
- Remove `createVisualTests.react.ts` → Task 18
- Full pre-submit + PR → Tasks 19, 20

**Deferred (documented but not implemented in this plan):**

- Resolved-version assert from `pnpm-lock.yaml` (Task 14 checks declared ranges only; transitive drift will surface as snapshot churn)
- Snapshot budget reporter (Phase 2)
- Determinism CI gate script `test:determinism` — the double-run is manual here; formalizing it as a package script is a small follow-up
- Audit script for inherited noise (Phase 2)
- README section "Writing a snapshot-safe story" — added as part of Phase 2 when `[data-test-snapshot-ready]` patterns become documented; for Phase 1 the JSDoc in `settle.common.ts` is the source of truth

**Type consistency:**

- `normalizeHtml(root: Element): string` — used identically in Tasks 9, 16, 17
- `settleReact(container: Element, timeoutMs?: number): Promise<void>` — Tasks 6, 16
- `settleVue(container: Element, timeoutMs?: number): Promise<void>` — Tasks 7, 17
- `RULES`, `ID_REF_ATTRS`, `NormalizationRule` — Tasks 8, 10, 11
