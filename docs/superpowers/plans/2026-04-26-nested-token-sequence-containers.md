# Nested Token Sequence Containers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adapter-owned nested token sequence hosts so custom Mark components can render controls or layout elements around `{children}` without breaking text reconciliation and DOM indexing.

**Architecture:** Core adds a narrow `dom.childrenFor(ownerPath)` registration API for nested child-sequence hosts. React and Vue wrap nested token children in internal `TokenChildren` components that register one concrete host element by ref. `DomFeature` indexes mark children from the registered host when present, while keeping the existing direct-child structural indexing as a compatibility fallback.

**Tech Stack:** TypeScript, Vitest core unit tests, Vitest Browser Mode with Playwright, React 19, Vue 3, Astro/Starlight docs, pnpm.

---

## Scope And Source Spec

Implement `docs/superpowers/specs/2026-04-26-nested-token-sequence-containers-design.md`.

The current code already implements structural rendering without per-token adapter wrappers. This plan only amends nested mark rendering and DOM indexing. Do not reintroduce generic token wrappers, public DOM attributes, public user refs, or new dependencies.

## File Structure

Create:

- `packages/react/markput/src/components/TokenChildren.tsx` - internal React child-sequence host that registers `store.dom.childrenFor(ownerPath)`.
- `packages/vue/markput/src/components/TokenChildren.vue` - internal Vue child-sequence host that registers `store.dom.childrenFor(ownerPath)`.

Modify:

- `packages/core/src/features/dom/DomFeature.ts` - add child-sequence registration state, `childrenFor()`, and nested host indexing.
- `packages/core/src/features/dom/DomFeature.spec.ts` - add core red/green tests for registered child sequence hosts, fallback indexing, duplicate hosts, and outside-host rejection.
- `packages/react/markput/src/components/Token.tsx` - wrap nested child token rendering with `TokenChildren`.
- `packages/vue/markput/src/components/Token.vue` - wrap nested child token rendering with `TokenChildren`.
- `packages/storybook/src/pages/Base/Base.react.spec.tsx` - add React browser test for a Mark with an unregistered control before children.
- `packages/storybook/src/pages/Base/Base.vue.spec.ts` - add Vue browser test for a Mark with an unregistered control before children.
- `packages/storybook/src/pages/Drag/Drag.react.spec.tsx` - add React TodoList regression check.
- `packages/storybook/src/pages/Drag/Drag.vue.spec.ts` - add Vue TodoListDrag regression check.
- `packages/website/src/content/docs/development/architecture.md` - document nested child-sequence hosts in the component tree and DomFeature section.
- `packages/website/src/content/docs/guides/nested-marks.md` - document that slot Mark components must render opaque `children` exactly once.

Do not modify `pnpm-workspace.yaml`, package catalogs, package dependencies, or generated API docs unless implementation unexpectedly changes public exported types.

---

### Task 1: Core Child-Sequence Host Indexing

**Files:**

- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`

- [ ] **Step 1: Add core red-test helpers**

In `packages/core/src/features/dom/DomFeature.spec.ts`, add these helpers after `mountStructuralNested`:

```ts
function mountStructuralNestedWithChildSequence(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const control = document.createElement('input')
	const host = document.createElement('span')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	const trailing = document.createElement('span')
	control.type = 'checkbox'
	host.style.display = 'contents'
	host.append(before, inner, after)
	outer.append(control, host)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.dom.childrenFor([1])(host)
	store.lifecycle.rendered()
	return {store, container, leading, outer, control, host, before, inner, after, trailing}
}

function mountStructuralNestedWithDuplicateChildSequences(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const hostA = document.createElement('span')
	const hostB = document.createElement('span')
	const trailing = document.createElement('span')
	outer.append(hostA, hostB)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.dom.childrenFor([1])(hostA)
	store.dom.childrenFor([1])(hostB)
	return {store, container, outer, hostA, hostB}
}

function mountStructuralNestedWithOutsideChildSequence(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const leading = document.createElement('span')
	const outer = document.createElement('mark')
	const outsideHost = document.createElement('span')
	const trailing = document.createElement('span')
	leading.append(outsideHost)
	container.append(leading, outer, trailing)
	document.body.append(container)
	store.dom.container(container)
	store.dom.childrenFor([1])(outsideHost)
	return {store, container, outer, outsideHost}
}
```

- [ ] **Step 2: Add core red tests**

In `describe('DomFeature structural indexing', () => { ... })`, add these tests after `maps nested children without slot-root wrappers`:

```ts
it('indexes nested children from a registered child sequence host', () => {
	const {store, container, outer, control, host, before, inner, after} = mountStructuralNestedWithChildSequence()

	expect(store.dom.locateNode(outer)).toMatchObject({ok: true, value: {tokenElement: outer}})
	expect(store.dom.locateNode(host)).toMatchObject({ok: true, value: {tokenElement: outer}})
	expect(store.dom.locateNode(control)).toMatchObject({ok: true, value: {tokenElement: outer}})
	expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
	expect(store.dom.locateNode(inner)).toMatchObject({ok: true, value: {tokenElement: inner}})
	expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
	expect(before.textContent).toBe('before ')
	expect(after.textContent).toBe(' after')
	container.remove()
})

it('emits diagnostics for duplicate child sequence hosts', () => {
	const diagnostics: unknown[] = []
	const {store, container} = mountStructuralNestedWithDuplicateChildSequences()
	const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))

	store.lifecycle.rendered()

	expect(diagnostics).toContainEqual({
		kind: 'ambiguousStructure',
		path: [1],
		reason: 'expected exactly 1 child sequence host for owner path 1 but found 2',
	})
	stop()
	container.remove()
})

it('emits diagnostics when child sequence host is outside owner mark root', () => {
	const diagnostics: unknown[] = []
	const {store, container} = mountStructuralNestedWithOutsideChildSequence()
	const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))

	store.lifecycle.rendered()

	expect(diagnostics).toContainEqual({
		kind: 'ambiguousStructure',
		path: [1],
		reason: 'child sequence host for owner path 1 is not contained by owner token element',
	})
	stop()
	container.remove()
})
```

- [ ] **Step 3: Run the core red tests**

Run:

```bash
pnpm -w vitest run --project core packages/core/src/features/dom/DomFeature.spec.ts --testNamePattern "child sequence"
```

Expected: FAIL because `store.dom.childrenFor` does not exist.

- [ ] **Step 4: Add child-sequence registration types and imports**

In `packages/core/src/features/dom/DomFeature.ts`, change the token index import:

```ts
import {pathEquals, pathKey} from '../parsing/tokenIndex'
```

Add this type after `ControlRegistration`:

```ts
type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}
```

Inside `export class DomFeature`, add child-sequence fields after `#pendingControls`:

```ts
readonly #pendingControls = new Map<string, ControlRegistration>()
readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
#nextControlId = 0
#nextChildSequenceId = 0
```

Remove the old standalone `#nextControlId = 0` line so the field is not declared twice.

- [ ] **Step 5: Add `childrenFor()`**

In `DomFeature`, add this method immediately after `controlFor()`:

```ts
childrenFor(ownerPath: TokenPath): DomRef {
	const key = `children:${pathKey(ownerPath)}:${++this.#nextChildSequenceId}`

	const callback: DomRef = element => {
		if (element) {
			this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
		} else {
			this.#pendingChildSequences.delete(key)
		}
	}
	return callback
}
```

- [ ] **Step 6: Add child-sequence lookup and nested indexing helpers**

In `DomFeature`, add these private methods after `#isControlRoot()`:

```ts
#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
	const hosts: HTMLElement[] = []
	for (const registration of this.#pendingChildSequences.values()) {
		if (pathEquals(registration.ownerPath, ownerPath)) hosts.push(registration.element)
	}
	return hosts
}

#indexNestedTokenSequence(
	token: Token,
	path: TokenPath,
	ownerElement: HTMLElement,
	rowElement: HTMLElement | undefined,
	tokenIndex: ReturnType<Store['parsing']['index']>,
	controlElements: Set<HTMLElement>,
	pathElements: Map<string, PathElements>,
	elementRoles: WeakMap<HTMLElement, RegisteredRole>
): void {
	if (token.type !== 'mark' || token.children.length === 0) return

	const hosts = this.#childSequenceHostsFor(path)
	if (hosts.length === 0) {
		this.#indexTokenSequence(
			ownerElement,
			token.children,
			path,
			rowElement,
			tokenIndex,
			controlElements,
			pathElements,
			elementRoles
		)
		return
	}

	const ownerKey = pathKey(path)
	if (hosts.length !== 1) {
		this.diagnostics({
			kind: 'ambiguousStructure',
			path,
			reason: `expected exactly 1 child sequence host for owner path ${ownerKey} but found ${hosts.length}`,
		})
		return
	}

	const host = hosts[0]
	if (!ownerElement.contains(host)) {
		this.diagnostics({
			kind: 'ambiguousStructure',
			path,
			reason: `child sequence host for owner path ${ownerKey} is not contained by owner token element`,
		})
		return
	}

	this.#indexTokenSequence(
		host,
		token.children,
		path,
		rowElement,
		tokenIndex,
		controlElements,
		pathElements,
		elementRoles
	)
}
```

- [ ] **Step 7: Route mark child indexing through the helper**

In `#indexTokenElement`, replace the existing nested indexing block:

```ts
if (token.type === 'mark' && token.children.length > 0) {
	this.#indexTokenSequence(
		element,
		token.children,
		path,
		rowElement,
		tokenIndex,
		controlElements,
		pathElements,
		elementRoles
	)
}
```

with:

```ts
this.#indexNestedTokenSequence(
	token,
	path,
	element,
	rowElement,
	tokenIndex,
	controlElements,
	pathElements,
	elementRoles
)
```

- [ ] **Step 8: Run the focused core tests**

Run:

```bash
pnpm -w vitest run --project core packages/core/src/features/dom/DomFeature.spec.ts --testNamePattern "child sequence|nested children"
```

Expected: PASS for the new child sequence tests and the existing direct-child fallback nested test.

- [ ] **Step 9: Run all DomFeature tests**

Run:

```bash
pnpm -w vitest run --project core packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: PASS for the full file.

- [ ] **Step 10: Commit core changes**

Run:

```bash
git add packages/core/src/features/dom/DomFeature.ts packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "feat(core): index nested token sequence hosts"
```

Expected: commit succeeds.

---

### Task 2: React TokenChildren Adapter And Tests

**Files:**

- Create: `packages/react/markput/src/components/TokenChildren.tsx`
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/storybook/src/pages/Base/Base.react.spec.tsx`
- Modify: `packages/storybook/src/pages/Drag/Drag.react.spec.tsx`

- [ ] **Step 1: Add the React browser red test**

In `packages/storybook/src/pages/Base/Base.react.spec.tsx`, change the first import:

```ts
import type {MarkProps, Markup} from '@markput/react'
```

Add this test after `preserves option-provided children for flat mark components`:

```tsx
it('renders slot text when mark renders an unregistered control before children', async () => {
	const todoMarkup = '- [__value__] __slot__\n' as Markup
	const TodoMark = ({children}: MarkProps) => (
		<span data-testid="todo-mark">
			<input type="checkbox" aria-label="done" />
			{children}
		</span>
	)

	const {container} = await render(
		<MarkedInput Mark={TodoMark} options={[{markup: todoMarkup}]} defaultValue="- [ ] Design Phase\n" />
	)

	await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
	const textSurface = Array.from(container.querySelectorAll<HTMLElement>('span[contenteditable]')).find(
		el => el.textContent === 'Design Phase'
	)
	expect(textSurface?.contentEditable).toBe('true')

	await userEvent.click(getElement(page.getByLabelText('done')))

	expect(textSurface).toHaveTextContent('Design Phase')
})
```

- [ ] **Step 2: Add the React TodoList story regression red test**

In `packages/storybook/src/pages/Drag/Drag.react.spec.tsx`, change:

```ts
const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)
```

to:

```ts
const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag, TodoList} = composeStories(DragStories)
```

Add this test after `render content in read-only mode`:

```tsx
it('render content for TodoList with checkbox controls', async () => {
	await render(<TodoList />)

	await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
	await expect.element(page.getByText('Create wireframes')).toBeInTheDocument()
	await expect.element(page.getByText('Deploy to production')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the React red tests**

Run:

```bash
pnpm -w vitest run --project react packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx --testNamePattern "unregistered control|TodoList"
```

Expected: FAIL because the React adapter still passes raw mapped child tokens and `DomFeature` treats the checkbox as an ambiguous child.

- [ ] **Step 4: Create internal React `TokenChildren`**

Create `packages/react/markput/src/components/TokenChildren.tsx`:

```tsx
import type {TokenPath} from '@markput/core'
import type {CSSProperties, ReactNode} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

const sequenceHostStyle: CSSProperties = {display: 'contents'}

export const TokenChildren = memo(({ownerPath, children}: {ownerPath: TokenPath; children: ReactNode}) => {
	const dom = useMarkput(s => s.dom)
	const ref = useMemo(() => dom.childrenFor(ownerPath), [dom, ownerPath])

	return (
		<span ref={ref} style={sequenceHostStyle}>
			{children}
		</span>
	)
})

TokenChildren.displayName = 'TokenChildren'
```

- [ ] **Step 5: Wrap nested React tokens with `TokenChildren`**

In `packages/react/markput/src/components/Token.tsx`, add:

```ts
import {TokenChildren} from './TokenChildren'
```

Replace the `children` assignment with:

```tsx
const children =
	token.type === 'mark' && token.children.length > 0 ? (
		<TokenChildren ownerPath={path}>
			{token.children.map(child => (
				<Token key={key.get(child)} token={child} />
			))}
		</TokenChildren>
	) : undefined
```

Keep the existing `TokenContext` return shape unchanged.

- [ ] **Step 6: Run the focused React tests**

Run:

```bash
pnpm -w vitest run --project react packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx --testNamePattern "unregistered control|TodoList"
```

Expected: PASS.

- [ ] **Step 7: Run React component regression files touched by this task**

Run:

```bash
pnpm -w vitest run --project react packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx
```

Expected: PASS for both files.

- [ ] **Step 8: Commit React changes**

Run:

```bash
git add packages/react/markput/src/components/Token.tsx packages/react/markput/src/components/TokenChildren.tsx packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx
git commit -m "feat(react): render nested token sequence hosts"
```

Expected: commit succeeds.

---

### Task 3: Vue TokenChildren Adapter And Tests

**Files:**

- Create: `packages/vue/markput/src/components/TokenChildren.vue`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/storybook/src/pages/Base/Base.vue.spec.ts`
- Modify: `packages/storybook/src/pages/Drag/Drag.vue.spec.ts`

- [ ] **Step 1: Add the Vue browser red test**

In `packages/storybook/src/pages/Base/Base.vue.spec.ts`, add this test after `preserves option-provided children for flat mark components`:

```ts
it('renders slot text when mark renders an unregistered control before children', async () => {
	const todoMarkup = '- [__value__] __slot__\n' as Markup
	const TodoMark = defineComponent({
		setup(_, {slots}) {
			return () =>
				h('span', {'data-testid': 'todo-mark'}, [
					h('input', {type: 'checkbox', 'aria-label': 'done'}),
					slots.default?.(),
				])
		},
	})

	const {container} = await render(
		withProps(Default, {
			Mark: TodoMark,
			options: [{markup: todoMarkup}],
			defaultValue: '- [ ] Design Phase\n',
		})
	)

	await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
	const textSurface = Array.from(container.querySelectorAll<HTMLElement>('span[contenteditable]')).find(
		el => el.textContent === 'Design Phase'
	)
	expect(textSurface?.contentEditable).toBe('true')

	await userEvent.click(getElement(page.getByLabelText('done')))

	expect(textSurface).toHaveTextContent('Design Phase')
})
```

- [ ] **Step 2: Add the Vue TodoList story regression red test**

In `packages/storybook/src/pages/Drag/Drag.vue.spec.ts`, change:

```ts
const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag} = composeStories(DragStories)
```

to:

```ts
const {PlainTextDrag, MarkdownDrag, ReadOnlyDrag, TodoListDrag} = composeStories(DragStories)
```

Add this test after `render content in read-only mode`:

```ts
it('render content for TodoListDrag with checkbox controls', async () => {
	await render(TodoListDrag)

	await expect.element(page.getByText('Design Phase')).toBeInTheDocument()
	await expect.element(page.getByText('Create wireframes')).toBeInTheDocument()
	await expect.element(page.getByText('Deploy to production')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the Vue red tests**

Run:

```bash
pnpm -w vitest run --project vue packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts --testNamePattern "unregistered control|TodoListDrag"
```

Expected: FAIL because the Vue adapter still passes raw mapped child tokens and `DomFeature` treats the extra control as an ambiguous child.

- [ ] **Step 4: Create internal Vue `TokenChildren`**

Create `packages/vue/markput/src/components/TokenChildren.vue`:

```vue
<script setup lang="ts">
import type {TokenPath} from '@markput/core'
import {onBeforeUnmount} from 'vue'

import {useStore} from '../lib/hooks/useStore'

const props = defineProps<{ownerPath: TokenPath}>()
const store = useStore()

let childSequenceRef: ((element: HTMLElement | null) => void) | undefined

const getChildSequenceRef = () => {
	if (childSequenceRef) return childSequenceRef
	childSequenceRef = store.dom.childrenFor(props.ownerPath)
	return childSequenceRef
}

const setElement = (el: unknown) => {
	getChildSequenceRef()?.(el instanceof HTMLElement ? el : null)
}

onBeforeUnmount(() => {
	childSequenceRef?.(null)
})
</script>

<template>
	<span :ref="setElement" style="display: contents"><slot /></span>
</template>
```

- [ ] **Step 5: Wrap nested Vue tokens with `TokenChildren`**

In `packages/vue/markput/src/components/Token.vue`, add:

```ts
import TokenChildren from './TokenChildren.vue'
```

Replace the `children` assignment with:

```ts
const children =
	token.type === 'mark' && token.children.length > 0
		? () =>
				h(markRaw(TokenChildren), {ownerPath: path}, () =>
					token.children.map(child => h(markRaw(Token), {key: key.get(child), token: child}))
				)
		: undefined
```

Keep the existing `return children ? h(Comp, compProps, children) : h(Comp, compProps)` line unchanged.

- [ ] **Step 6: Run the focused Vue tests**

Run:

```bash
pnpm -w vitest run --project vue packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts --testNamePattern "unregistered control|TodoListDrag"
```

Expected: PASS.

- [ ] **Step 7: Run Vue component regression files touched by this task**

Run:

```bash
pnpm -w vitest run --project vue packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts
```

Expected: PASS for both files.

- [ ] **Step 8: Commit Vue changes**

Run:

```bash
git add packages/vue/markput/src/components/Token.vue packages/vue/markput/src/components/TokenChildren.vue packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts
git commit -m "feat(vue): render nested token sequence hosts"
```

Expected: commit succeeds.

---

### Task 4: Documentation Updates

**Files:**

- Modify: `packages/website/src/content/docs/development/architecture.md`
- Modify: `packages/website/src/content/docs/guides/nested-marks.md`

- [ ] **Step 1: Update the architecture component tree**

In `packages/website/src/content/docs/development/architecture.md`, replace the nested Token section in the component tree with:

```md
  │ │   └─ <Token mark={t} />       # Unified renderer for text & mark tokens
  │ │       └─ <TokenChildren>      # Internal host for __slot__ child sequence
  │ │           └─ <Token mark={child}>
```

- [ ] **Step 2: Update the component responsibility table**

In the component responsibility table, add this row after `Token`:

```md
| **TokenChildren**    | Internal nested token sequence host for slot children        |
```

- [ ] **Step 3: Update the DomFeature architecture section**

In `packages/website/src/content/docs/development/architecture.md`, replace the stale role list under `### DomFeature` with:

```md
`DomFeature` owns the root container signal and indexes rendered structure after each render:

- top-level token roots are discovered from the editor container or block rows;
- nested slot children are discovered from adapter-owned `TokenChildren` hosts registered through `childrenFor(path)`;
- block controls are registered through `controlFor(path)` and ignored during token indexing;
- text token roots are reconciled as editable text surfaces;
- mark roots receive focusability state.

It exposes raw boundary helpers used by keyboard, clipboard, overlay, block editing, drag, and mark commands. It also applies pending `caret.recovery` after renders; failed recovery is cleared after one attempt and reported through DOM diagnostics.
```

- [ ] **Step 4: Update nested marks guide**

In `packages/website/src/content/docs/guides/nested-marks.md`, replace the `## Opaque Children` section with:

````md
## Opaque Children

React and Vue wrap nested slot content in an internal child-sequence host. Custom Mark components should treat `children` as opaque rendered content and render it exactly once.

```tsx
function Highlight({children}: {children?: React.ReactNode}) {
    return <mark>{children}</mark>
}
```

Marks can render controls, icons, or layout elements around children:

```tsx
function TodoItem({children}: {children?: React.ReactNode}) {
    return (
        <label>
            <input type="checkbox" />
            {children}
        </label>
    )
}
```

Do not inspect DOM child order to infer token identity. Use `useMarkInfo()` for structure and `useMark()` for commands.
````

- [ ] **Step 5: Run docs format checks**

Run:

```bash
pnpm exec oxfmt --check packages/website/src/content/docs/development/architecture.md packages/website/src/content/docs/guides/nested-marks.md
```

Expected: PASS, or the same repository-level oxfmt exclusion message if Markdown remains excluded by config. If oxfmt reports formatting changes are needed, run:

```bash
pnpm exec oxfmt packages/website/src/content/docs/development/architecture.md packages/website/src/content/docs/guides/nested-marks.md
```

then rerun the check command.

- [ ] **Step 6: Commit documentation changes**

Run:

```bash
git add packages/website/src/content/docs/development/architecture.md packages/website/src/content/docs/guides/nested-marks.md
git commit -m "docs: document nested token sequence hosts"
```

Expected: commit succeeds.

---

### Task 5: Final Verification

**Files:**

- Verify all files changed by Tasks 1-4.

- [ ] **Step 1: Run focused core verification**

Run:

```bash
pnpm -w vitest run --project core packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused React verification**

Run:

```bash
pnpm -w vitest run --project react packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Drag/Drag.react.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused Vue verification**

Run:

```bash
pnpm -w vitest run --project vue packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Drag/Drag.vue.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 5: Run package builds**

Run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run lint check**

Run:

```bash
pnpm run lint:check
```

Expected: PASS.

- [ ] **Step 8: Run format check**

Run:

```bash
pnpm run format:check
```

Expected: PASS.

- [ ] **Step 9: Inspect final diff and history**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: working tree contains only intentional changes, or is clean if all task commits were created. The recent commits should include:

```txt
feat(core): index nested token sequence hosts
feat(react): render nested token sequence hosts
feat(vue): render nested token sequence hosts
docs: document nested token sequence hosts
```

Do not commit generated coverage, Storybook output, Playwright scratch files, or unrelated user changes.
