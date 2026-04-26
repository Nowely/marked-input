# Structural Token Rendering API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore React/Vue token rendering to the direct `next` branch API shape while keeping DOM/token location, editability, raw selection mapping, and caret recovery owned by core.

**Architecture:** React and Vue render the token tree directly and expose only the container ref plus narrow block-control refs. `DomFeature` structurally indexes token root elements from the committed DOM after `lifecycle.rendered()`, then reconciles text roots, mark focusability, raw boundary mapping, and pending caret recovery from that index. The generic per-token `refFor()` API and token/text/slotRoot adapter wrappers are removed.

**Tech Stack:** TypeScript, Vitest core unit tests, Vitest Browser Mode with Playwright, React 19, Vue 3, pnpm.

---

## Scope And Source Spec

Implement `docs/superpowers/specs/2026-04-26-structural-token-rendering-api-design.md`.

This plan intentionally changes the current `codex/core-editor-engine-dom-location` branch, not the `next` branch. Use `next` only as the rendering-shape reference for React/Vue `Token`.

## File Structure

Modify:

- `packages/core/src/shared/editorContracts.ts` - narrow DOM contracts by removing token/text/slotRoot ref targets and `slotRootElement`; add structural diagnostic kinds.
- `packages/core/src/features/dom/DomFeature.ts` - replace registered token/text/slotRoot refs with structural indexing and `controlFor()`.
- `packages/core/src/features/dom/DomFeature.spec.ts` - replace ref-registration tests with structural-index tests.
- `packages/core/src/features/caret/selection.ts` - remove direct `querySelectorAll('[contenteditable="true"]')`; rely on `DomFeature.reconcile()`.
- `packages/core/src/features/caret/focus.ts` and `selectionHelpers.ts` if type errors remain after `slotRootElement` removal.
- `packages/core/src/features/keyboard/input.spec.ts`, `focus.spec.ts`, `Store.spec.ts` - migrate test setup from `refFor()` to structural DOM helpers.
- `packages/react/markput/src/components/Token.tsx` - restore direct slot rendering and remove token/text/slotRoot refs.
- `packages/react/markput/src/components/Block.tsx` - stop registering row through `dom.refFor()`; keep block feature ref.
- `packages/react/markput/src/components/DragHandle.tsx` - register the outer control root through `dom.controlFor(path)`.
- `packages/react/markput/src/components/DropIndicator.tsx` - register control root through `dom.controlFor(path)`.
- `packages/react/markput/src/components/BlockMenu.tsx` - register menu root through `dom.controlFor(path)`.
- `packages/vue/markput/src/components/Token.vue` - restore direct slot rendering and remove token/text/slotRoot refs.
- `packages/vue/markput/src/components/Block.vue` - stop registering row through `dom.refFor()`; keep block feature ref.
- `packages/vue/markput/src/components/DragHandle.vue` - register outer side panel through `dom.controlFor(path)`.
- `packages/vue/markput/src/components/DropIndicator.vue` - register control root through `dom.controlFor(path)`.
- `packages/vue/markput/src/components/BlockMenu.vue` - register menu root through `dom.controlFor(path)`.
- `packages/storybook/src/pages/Base/Base.react.spec.tsx` and `Base.vue.spec.ts` - add direct-render shape tests.
- `packages/storybook/src/pages/Nested/nested.react.spec.tsx` and `nested.vue.spec.ts` - add nested no-slot-root shape tests.
- `packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap` and `stories.vue.spec.ts.snap` - update snapshots after wrapper removal.

Do not modify dependency catalog entries or install new dependencies.

---

### Task 1: Core Structural Index Red Tests

**Files:**

- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`

- [ ] **Step 1: Replace ref-based helpers with structural helpers**

At the top of `DomFeature.spec.ts`, replace `mountRegisteredInline`, `mountRegisteredMarkWithDescendant`, and `mountRegisteredBlockWithControl` with these helpers:

```ts
function enableStructuralStore(value: string, props: Parameters<Store['props']['set']>[0] = {}) {
	const store = new Store()
	store.props.set({defaultValue: value, ...props})
	store.value.enable()
	store.dom.enable()
	return store
}

function mountStructuralInline(value: string) {
	const store = enableStructuralStore(value)
	const container = document.createElement('div')
	const textSurface = document.createElement('span')
	container.append(textSurface)
	document.body.append(container)
	store.dom.container(container)
	store.lifecycle.rendered()
	const textNode = textSurface.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural text surface did not render a text node')
	return {store, container, textSurface, textNode}
}

function mountStructuralInlineMark(value = 'hello @[world]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__value__]'}]})
	const container = document.createElement('div')
	const before = document.createElement('span')
	const mark = document.createElement('mark')
	const after = document.createElement('span')
	container.append(before, mark, after)
	document.body.append(container)
	store.dom.container(container)
	store.lifecycle.rendered()
	return {store, container, before, mark, after}
}

function mountStructuralNested(value = '@[before @[nested] after]') {
	const store = enableStructuralStore(value, {Mark: () => null, options: [{markup: '@[__slot__]'}]})
	const container = document.createElement('div')
	const outer = document.createElement('mark')
	const before = document.createElement('span')
	const inner = document.createElement('mark')
	const after = document.createElement('span')
	outer.append(before, inner, after)
	container.append(outer)
	document.body.append(container)
	store.dom.container(container)
	store.lifecycle.rendered()
	return {store, container, outer, before, inner, after}
}

function mountStructuralBlockWithControl(value: string) {
	const store = enableStructuralStore(value, {layout: 'block'})
	const container = document.createElement('div')
	const row = document.createElement('div')
	const control = document.createElement('button')
	const textSurface = document.createElement('span')
	control.textContent = 'x'
	row.append(control, textSurface)
	container.append(row)
	document.body.append(container)
	store.dom.container(container)
	store.dom.controlFor([0])(control)
	store.lifecycle.rendered()
	const textNode = textSurface.firstChild
	const controlText = control.firstChild
	if (!(textNode instanceof Text)) throw new Error('Structural block text surface did not render a text node')
	if (!(controlText instanceof Text)) throw new Error('Structural control did not render a text node')
	return {store, container, row, control, controlText, textSurface, textNode}
}
```

- [ ] **Step 2: Replace registration tests with structural-index tests**

Replace the `describe('DomFeature registration', ...)` block with:

```ts
describe('DomFeature structural indexing', () => {
	let store: Store

	beforeEach(() => {
		vi.clearAllMocks()
		store = new Store()
		store.props.set({Mark: () => null, options: [{markup: '@[__value__]'}]})
		store.value.enable()
		store.value.replaceAll('hello @[world]')
	})

	it('owns the container ref signal', () => {
		const container = document.createElement('div')

		store.dom.container(container)

		expect(store.dom.container()).toBe(container)

		store.dom.container(null)

		expect(store.dom.container()).toBe(null)
	})

	it('publishes one dom index per rendered commit', () => {
		const {store, textSurface, container} = mountStructuralInline('hello')

		expect(store.dom.index()).toEqual({generation: 1})
		expect(store.dom.locateNode(textSurface)).toMatchObject({ok: true})
		container.remove()
	})

	it('maps inline token roots by rendered token order', () => {
		const {store, before, mark, after, container} = mountStructuralInlineMark()

		expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
		expect(store.dom.locateNode(mark)).toMatchObject({ok: true, value: {tokenElement: mark}})
		expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
		container.remove()
	})

	it('treats text token roots as editable text surfaces', () => {
		const {store, textSurface, container} = mountStructuralInline('hello')

		expect(store.dom.locateNode(textSurface)).toMatchObject({
			ok: true,
			value: {tokenElement: textSurface, textElement: textSurface},
		})
		expect(textSurface.textContent).toBe('hello')
		expect(textSurface.contentEditable).toBe('true')
		container.remove()
	})

	it('maps nested children without slot-root wrappers', () => {
		const {store, outer, before, inner, after, container} = mountStructuralNested()

		expect(store.dom.locateNode(outer)).toMatchObject({ok: true, value: {tokenElement: outer}})
		expect(store.dom.locateNode(before)).toMatchObject({ok: true, value: {tokenElement: before}})
		expect(store.dom.locateNode(inner)).toMatchObject({ok: true, value: {tokenElement: inner}})
		expect(store.dom.locateNode(after)).toMatchObject({ok: true, value: {tokenElement: after}})
		container.remove()
	})

	it('returns control for registered controls', () => {
		const {store, control, container} = mountStructuralBlockWithControl('hello')

		expect(store.dom.locateNode(control)).toEqual({ok: false, reason: 'control'})
		container.remove()
	})

	it('emits diagnostics when a nested mark omits child roots', () => {
		const diagnostics: unknown[] = []
		const store = enableStructuralStore('@[before @[nested] after]', {
			Mark: () => null,
			options: [{markup: '@[__slot__]'}],
		})
		const stop = watch(store.dom.diagnostics, diagnostic => diagnostics.push(diagnostic))
		const container = document.createElement('div')
		const outer = document.createElement('mark')
		container.append(outer)
		document.body.append(container)
		store.dom.container(container)
		store.lifecycle.rendered()

		expect(diagnostics).toContainEqual({
			kind: 'ambiguousStructure',
			path: [0],
			reason: 'expected 3 child token elements but found 0',
		})
		expect(store.dom.locateNode(outer)).toMatchObject({ok: true})
		stop()
		container.remove()
	})
})
```

- [ ] **Step 3: Update the existing raw-boundary tests to call structural helpers**

In the lower `describe('raw boundary mapping', ...)` block, replace helper names:

```ts
mountRegisteredInline
```

with:

```ts
mountStructuralInline
```

Replace the mark descendant test with:

```ts
it('rejects editable boundaries inside mark presentation descendants', () => {
	const {store, container, mark} = mountStructuralInlineMark('@[world]')
	const descendant = document.createElement('span')
	descendant.contentEditable = 'true'
	descendant.textContent = 'inner'
	mark.append(descendant)
	const descendantText = descendant.firstChild
	if (!(descendantText instanceof Text)) throw new Error('Mark descendant did not render a text node')
	store.lifecycle.rendered()

	expect(store.dom.rawPositionFromBoundary(descendantText, 0, 'after')).toEqual({
		ok: false,
		reason: 'invalidBoundary',
	})
	container.remove()
})
```

Replace the control-crossing test helper:

```ts
mountRegisteredBlockWithControl
```

with:

```ts
mountStructuralBlockWithControl
```

- [ ] **Step 4: Run core DOM tests and verify they fail**

Run:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: fail with TypeScript/runtime errors because `store.dom.controlFor` and structural indexing do not exist, and because `refFor()` tests were removed.

- [ ] **Step 5: Commit red tests**

```bash
git add packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "test(core): cover structural DOM indexing"
```

---

### Task 2: DomFeature Structural Index Green

**Files:**

- Modify: `packages/core/src/shared/editorContracts.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: `packages/core/src/features/dom/DomFeature.spec.ts`

- [ ] **Step 1: Narrow DOM contracts**

In `editorContracts.ts`, replace the DOM ref target and location types with:

```ts
export type DomRef = (element: HTMLElement | null) => void

export type NodeLocationResult = Result<
	{
		readonly address: TokenAddress
		readonly tokenElement: HTMLElement
		readonly textElement?: HTMLElement
		readonly rowElement?: HTMLElement
	},
	'notIndexed' | 'outsideEditor' | 'control'
>
```

Remove `DomRefTarget`.

Extend `DomDiagnostic['kind']` to include structural indexing failures:

```ts
		| 'missingContainer'
		| 'ambiguousStructure'
```

- [ ] **Step 2: Replace DomFeature private registration state**

In `DomFeature.ts`, remove imports of `DomRefTarget`, then replace `RegisteredRole`, `PathElements`, and ref fields with:

```ts
type RegisteredRole =
	| {readonly role: 'control'}
	| {
			readonly role: 'row' | 'token' | 'text'
			readonly path: TokenPath
			readonly address: TokenAddress
	  }

type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement: HTMLElement
	textElement?: HTMLElement
}

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}
```

Replace:

```ts
readonly #refCallbacks = new Map<string, DomRef>()
readonly #pendingElements = new Map<string, {target: DomRefTarget; element: HTMLElement}>()
```

with:

```ts
readonly #controlCallbacks = new Map<string, DomRef>()
readonly #pendingControls = new Map<string, ControlRegistration>()
```

- [ ] **Step 3: Replace `refFor()` with `controlFor()`**

Delete `refFor()` and `#targetKey()`.

Add this method:

```ts
controlFor(ownerPath?: TokenPath): DomRef {
	const key = ownerPath ? `control:${pathKey(ownerPath)}` : 'control:global'
	const existing = this.#controlCallbacks.get(key)
	if (existing) return existing

	const callback: DomRef = element => {
		if (element) this.#pendingControls.set(key, {ownerPath, element})
		else this.#pendingControls.delete(key)
	}
	this.#controlCallbacks.set(key, callback)
	return callback
}
```

- [ ] **Step 4: Replace rendered commit with structural indexing**

Replace `#commitRendered()` with:

```ts
#commitRendered(): void {
	const container = this.container()
	if (!container) {
		this.diagnostics({kind: 'missingContainer', reason: 'container is not registered'})
		return
	}

	const tokenIndex = this._store.parsing.index()
	const pathElements = new Map<string, PathElements>()
	const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	const controlElements = new Set<HTMLElement>()

	for (const {element} of this.#pendingControls.values()) {
		controlElements.add(element)
		elementRoles.set(element, {role: 'control'})
	}

	const tokens = this._store.parsing.tokens()
	if (this._store.props.layout() === 'block') {
		this.#indexBlockTokens(container, tokens, tokenIndex, controlElements, pathElements, elementRoles)
	} else {
		this.#indexTokenSequence(container, tokens, [], undefined, controlElements, pathElements, elementRoles)
	}

	this.#pathElements = pathElements
	this.#elementRoles = elementRoles
	this.#reconcileRegisteredTextSurfaces()

	batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})
	this.#clearStaleCaretLocation()
	this.#applyPendingRecovery()
}
```

- [ ] **Step 5: Add structural indexing helpers**

Add these private methods near `#commitRendered()`:

```ts
#elementChildren(element: HTMLElement): HTMLElement[] {
	return Array.from(element.children).filter(child => child instanceof HTMLElement)
}

#isControlRoot(element: HTMLElement, controlElements: Set<HTMLElement>): boolean {
	if (controlElements.has(element)) return true
	for (const control of controlElements) {
		if (element.contains(control)) return true
	}
	return false
}

#indexBlockTokens(
	container: HTMLElement,
	tokens: readonly Token[],
	tokenIndex: ReturnType<Store['parsing']['index']>,
	controlElements: Set<HTMLElement>,
	pathElements: Map<string, PathElements>,
	elementRoles: WeakMap<HTMLElement, RegisteredRole>
): void {
	const rows = this.#elementChildren(container)
	if (rows.length !== tokens.length) {
		this.diagnostics({
			kind: 'ambiguousStructure',
			reason: `expected ${tokens.length} block rows but found ${rows.length}`,
		})
	}

	tokens.forEach((token, i) => {
		const row = rows[i]
		if (!row) return
		const candidates = this.#elementChildren(row).filter(child => !this.#isControlRoot(child, controlElements))
		if (candidates.length !== 1) {
			this.diagnostics({
				kind: 'ambiguousStructure',
				path: [i],
				reason: `expected 1 block token element but found ${candidates.length}`,
			})
			return
		}
		this.#indexTokenElement(token, [i], candidates[0], row, tokenIndex, controlElements, pathElements, elementRoles)
	})
}

#indexTokenSequence(
	parent: HTMLElement,
	tokens: readonly Token[],
	basePath: TokenPath,
	rowElement: HTMLElement | undefined,
	controlElements: Set<HTMLElement>,
	pathElements: Map<string, PathElements>,
	elementRoles: WeakMap<HTMLElement, RegisteredRole>
): void {
	const elements = this.#elementChildren(parent).filter(child => !this.#isControlRoot(child, controlElements))
	if (elements.length !== tokens.length) {
		this.diagnostics({
			kind: 'ambiguousStructure',
			path: basePath.length ? basePath : undefined,
			reason: `expected ${tokens.length} child token elements but found ${elements.length}`,
		})
	}

	tokens.forEach((token, i) => {
		const element = elements[i]
		if (!element) return
		this.#indexTokenElement(
			token,
			[...basePath, i],
			element,
			rowElement,
			tokenIndex,
			controlElements,
			pathElements,
			elementRoles
		)
	})
}

#indexTokenElement(
	token: Token,
	path: TokenPath,
	element: HTMLElement,
	rowElement: HTMLElement | undefined,
	tokenIndex: ReturnType<Store['parsing']['index']>,
	controlElements: Set<HTMLElement>,
	pathElements: Map<string, PathElements>,
	elementRoles: WeakMap<HTMLElement, RegisteredRole>
): void {
	const address = tokenIndex.addressFor(path)
	if (!address) {
		this.diagnostics({kind: 'stalePath', path, reason: 'structural path no longer resolves'})
		return
	}

	const record: PathElements = {
		path: [...path],
		address,
		tokenElement: element,
		textElement: token.type === 'text' ? element : undefined,
		rowElement,
	}
	pathElements.set(tokenIndex.key(path), record)
	elementRoles.set(element, {role: token.type === 'text' ? 'text' : 'token', path, address})
	if (rowElement) elementRoles.set(rowElement, {role: 'row', path, address})

	if (token.type === 'mark' && token.children.length > 0) {
		this.#indexTokenSequence(element, token.children, path, rowElement, controlElements, pathElements, elementRoles)
	}
}
```

If TypeScript rejects `ReturnType<Store['parsing']['index']>`, replace that local helper parameter type with:

```ts
ReturnType<Store['parsing']['index']>
```

from a local alias:

```ts
type CurrentTokenIndex = ReturnType<Store['parsing']['index']>
```

- [ ] **Step 6: Remove slot-root handling from location and boundary mapping**

In `locateNode()`, remove `slotRootElement` from the returned value.

Delete this branch from `rawPositionFromBoundary()`:

```ts
if (node === location.value.slotRootElement) {
	return this.#rawPositionFromTokenChildBoundary(
		location.value.slotRootElement,
		offset,
		token.value,
		affinity
	)
}
```

- [ ] **Step 7: Keep reconciliation logic, but rename it**

Rename `#reconcileRegisteredTextSurfaces()` to `#reconcileStructuralTextSurfaces()` and update callers:

```ts
reconcile(): void {
	this.#reconcileStructuralTextSurfaces()
}
```

Inside the method, keep the text reconciliation and mark `tabIndex` behavior. It now runs against structural text roots.

- [ ] **Step 8: Run core DOM tests and verify they pass**

Run:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts
```

Expected: pass.

- [ ] **Step 9: Commit structural DomFeature**

```bash
git add packages/core/src/shared/editorContracts.ts packages/core/src/features/dom/DomFeature.ts packages/core/src/features/dom/DomFeature.spec.ts
git commit -m "refactor(core): index token DOM structurally"
```

---

### Task 3: Migrate Core Tests And Remove Selection Query

**Files:**

- Modify: `packages/core/src/features/caret/selection.ts`
- Modify: `packages/core/src/features/caret/focus.spec.ts`
- Modify: `packages/core/src/features/keyboard/input.spec.ts`
- Modify: `packages/core/src/store/Store.spec.ts`
- Modify other `packages/core/src/**/*.spec.ts` files found by the `rg` command below.

- [ ] **Step 1: Find remaining core `refFor()` usages**

Run:

```bash
rg -n "refFor\\(" packages/core/src
```

Expected: failures in core tests and possibly code paths that still use the old API.

- [ ] **Step 2: Replace test setup pattern**

For each test creating:

```ts
const shell = document.createElement('span')
const textSurface = document.createElement('span')
container.append(shell)
shell.append(textSurface)
store.dom.container(container)
store.dom.refFor({role: 'token', path: [0]})(shell)
store.dom.refFor({role: 'text', path: [0]})(textSurface)
```

replace with:

```ts
const textSurface = document.createElement('span')
container.append(textSurface)
store.dom.container(container)
```

For mark tests creating a token shell, append the mark root directly under the container or row and do not register a token ref.

For block-control tests, replace:

```ts
store.dom.refFor({role: 'control', ownerPath: [0]})(control)
```

with:

```ts
store.dom.controlFor([0])(control)
```

- [ ] **Step 3: Remove direct contenteditable query from selection feature**

In `packages/core/src/features/caret/selection.ts`, replace this effect:

```ts
effect(() => {
	const value = store.caret.selecting()
	if (value !== 'drag') return
	const container = store.dom.container()
	if (!container) return
	container
		.querySelectorAll<HTMLElement>('[contenteditable="true"]')
		.forEach(el => (el.contentEditable = 'false'))
})
```

with:

```ts
effect(() => {
	const value = store.caret.selecting()
	if (value === 'drag') store.dom.reconcile()
})
```

`DomFeature.enable()` already watches `store.caret.selecting()` and reconciles text roots. This effect keeps the feature behavior explicit without querying DOM attributes.

- [ ] **Step 4: Run focused core tests**

Run:

```bash
pnpm -w vitest run packages/core/src/features/dom/DomFeature.spec.ts packages/core/src/features/caret/focus.spec.ts packages/core/src/features/keyboard/input.spec.ts packages/core/src/store/Store.spec.ts
```

Expected: pass.

- [ ] **Step 5: Verify no core production `refFor()` calls remain**

Run:

```bash
rg -n "refFor\\(" packages/core/src --glob '!**/*.spec.ts'
```

Expected: no matches.

- [ ] **Step 6: Commit core cleanup**

```bash
git add packages/core/src
git commit -m "refactor(core): remove token ref registration tests"
```

---

### Task 4: React Direct Rendering API

**Files:**

- Modify: `packages/storybook/src/pages/Base/Base.react.spec.tsx`
- Modify: `packages/storybook/src/pages/Nested/nested.react.spec.tsx`
- Modify: `packages/react/markput/src/components/Token.tsx`
- Modify: `packages/react/markput/src/components/Block.tsx`
- Modify: `packages/react/markput/src/components/DragHandle.tsx`
- Modify: `packages/react/markput/src/components/DropIndicator.tsx`
- Modify: `packages/react/markput/src/components/BlockMenu.tsx`

- [ ] **Step 1: Add React DOM-shape tests**

In `Base.react.spec.tsx`, after `it.todo('set readOnly on selection')`, add:

```tsx
it('renders default text as one editable span', async () => {
	const {container} = await render(<Default defaultValue="plain" />)
	const editor = container.firstElementChild!
	const editable = container.querySelector<HTMLElement>('span[contenteditable]')!

	expect(editor.children).toHaveLength(1)
	expect(editor.firstElementChild).toBe(editable)
	expect(editable).toHaveTextContent('plain')
})

it('renders mark roots without adapter wrappers', async () => {
	const {container} = await render(<MarkedInput Mark={({value}) => <mark data-testid="mark">{value}</mark>} defaultValue="hello @[world]" />)
	const editor = container.firstElementChild!
	const mark = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!

	expect(mark.parentElement).toBe(editor)
	expect(mark).toHaveTextContent('world')
	expect(mark.tabIndex).toBe(0)
})
```

In `Nested.react.spec.tsx`, add a test in the rendering describe block:

```tsx
it('renders nested token roots without slot-root wrappers', async () => {
	const markup: Markup = '@[__slot__]'
	const value = '@[before @[nested] after]'
	const Mark = ({children, value}: MarkProps) => <mark data-testid="mark">{children ?? value}</mark>
	const {container} = await render(<MarkedInput Mark={Mark} options={[{markup}]} defaultValue={value} />)
	const outer = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!
	const inner = container.querySelectorAll<HTMLElement>('mark[data-testid="mark"]')[1]!

	expect(inner.parentElement).toBe(outer)
	expect(Array.from(outer.children)).toContain(inner)
	expect(outer.querySelector('span > span > span')).toBeNull()
})
```

- [ ] **Step 2: Run React shape tests and verify they fail**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Nested/nested.react.spec.tsx
```

Expected: fail because React `Token` still renders adapter wrappers and token refs.

- [ ] **Step 3: Restore React `Token` direct rendering**

Replace `packages/react/markput/src/components/Token.tsx` with:

```tsx
import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({token}: {token: TokenType}) => {
	const {resolveMarkSlot, key, index, store} = useMarkput(s => ({
		resolveMarkSlot: s.mark.slot,
		key: s.key,
		index: s.parsing.index,
		store: s,
	}))
	const path = index.pathFor(token)
	const address = path ? index.addressFor(path) : undefined
	if (!address) return null

	const [Component, props] = resolveMarkSlot(token)
	const children =
		token.type === 'mark' && token.children.length > 0
			? token.children.map(child => <Token key={key.get(child)} token={child} />)
			: undefined

	return (
		<TokenContext value={{store, token, address}}>
			<Component {...props}>{children}</Component>
		</TokenContext>
	)
})

Token.displayName = 'Token'
```

- [ ] **Step 4: Remove row token-location registration from React Block**

In `Block.tsx`, replace:

```tsx
const {dom, index} = useMarkput(s => ({dom: s.dom, index: s.parsing.index}))
const blockIndex = tokens.indexOf(token)
const path = index.pathFor(token)
if (!path) return null

const setBlockRef = (el: HTMLElement | null) => {
	blockStore.attachContainer(el, blockIndex, {action})
	dom.refFor({role: 'row', path})(el)
}
```

with:

```tsx
const blockIndex = tokens.indexOf(token)

const setBlockRef = (el: HTMLElement | null) => {
	blockStore.attachContainer(el, blockIndex, {action})
}
```

- [ ] **Step 5: Register React block controls through `controlFor()`**

In `DragHandle.tsx`, include `index` and `dom` as today, but replace:

```tsx
const controlRef = path ? dom.refFor({role: 'control', ownerPath: path}) : undefined
```

with:

```tsx
const controlRef = path ? dom.controlFor(path) : undefined
```

Register the outer side-panel `div`, not only the button:

```tsx
return (
	<div
		ref={controlRef}
		className={cx(
			styles.SidePanel,
			alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible
		)}
	>
		<button
			ref={(el: HTMLButtonElement | null) => {
				blockStore.attachGrip(el, blockIndex, {action})
			}}
			type="button"
			draggable
			className={cx(styles.GripButton, isDragging && styles.GripButtonDragging)}
			aria-label="Drag to reorder or click for options"
		>
			<span className={iconGrip} />
		</button>
	</div>
)
```

In `DropIndicator.tsx` and `BlockMenu.tsx`, replace `dom.refFor({role: 'control', ownerPath: path})` with `dom.controlFor(path)`.

- [ ] **Step 6: Run React focused tests**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Nested/nested.react.spec.tsx packages/storybook/src/pages/Clipboard/Clipboard.react.spec.tsx
```

Expected: pass except snapshot tests not included in this command.

- [ ] **Step 7: Commit React adapter change**

```bash
git add packages/react/markput/src/components packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Nested/nested.react.spec.tsx
git commit -m "refactor(react): render token slots directly"
```

---

### Task 5: Vue Direct Rendering API

**Files:**

- Modify: `packages/storybook/src/pages/Base/Base.vue.spec.ts`
- Modify: `packages/storybook/src/pages/Nested/nested.vue.spec.ts`
- Modify: `packages/vue/markput/src/components/Token.vue`
- Modify: `packages/vue/markput/src/components/Block.vue`
- Modify: `packages/vue/markput/src/components/DragHandle.vue`
- Modify: `packages/vue/markput/src/components/DropIndicator.vue`
- Modify: `packages/vue/markput/src/components/BlockMenu.vue`

- [ ] **Step 1: Add Vue DOM-shape tests**

In `Base.vue.spec.ts`, after `it.todo('set readOnly on selection')`, add:

```ts
it('renders default text as one editable span', async () => {
	const {container} = await render(withProps(Default, {defaultValue: 'plain'}))
	const editor = container.firstElementChild!
	const editable = container.querySelector<HTMLElement>('span[contenteditable]')!

	expect(editor.children).toHaveLength(1)
	expect(editor.firstElementChild).toBe(editable)
	expect(editable).toHaveTextContent('plain')
})

it('renders mark roots without adapter wrappers', async () => {
	const Mark = defineComponent({
		props: {value: String},
		setup(props) {
			return () => h('mark', {'data-testid': 'mark'}, props.value)
		},
	})
	const {container} = await render(withProps(Default, {Mark, defaultValue: 'hello @[world]'}))
	const editor = container.firstElementChild!
	const mark = container.querySelector<HTMLElement>('mark[data-testid="mark"]')!

	expect(mark.parentElement).toBe(editor)
	expect(mark).toHaveTextContent('world')
	expect(mark.tabIndex).toBe(0)
})
```

In `Nested.vue.spec.ts`, add:

```ts
it('renders nested token roots without slot-root wrappers', async () => {
	const markup: Markup = '@[__slot__]'
	const value = '@[before @[nested] after]'
	const Mark = defineComponent({
		props: {value: String},
		setup(props, {slots}) {
			return () => h('mark', {'data-testid': 'mark'}, slots.default?.() ?? props.value)
		},
	})
	const {container} = await render(
		h(MarkedInput, {
			Mark,
			options: [{markup}],
			defaultValue: value,
		})
	)
	const marks = container.querySelectorAll<HTMLElement>('mark[data-testid="mark"]')
	const outer = marks[0]
	const inner = marks[1]

	expect(inner.parentElement).toBe(outer)
	expect(Array.from(outer.children)).toContain(inner)
	expect(outer.querySelector('span > span > span')).toBeNull()
})
```

- [ ] **Step 2: Run Vue shape tests and verify they fail**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Nested/nested.vue.spec.ts
```

Expected: fail because Vue `Token.vue` still renders adapter wrappers and token refs.

- [ ] **Step 3: Restore Vue `Token.vue` direct rendering**

Replace `packages/vue/markput/src/components/Token.vue` with:

```vue
<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const Token = defineComponent({
	name: 'Token',
	props: {
		token: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props): () => VNode | null {
		provide(
			TOKEN_KEY,
			toRef(() => props.token)
		)

		const store = useStore()
		const key = store.key
		const resolveMarkSlot = useMarkput(s => s.mark.slot)
		const index = useMarkput(s => s.parsing.index)

		return () => {
			const token = props.token
			const path = index.value.pathFor(token)
			if (!path || !index.value.addressFor(path)) return null

			const [Comp, compProps] = resolveMarkSlot.value(token)
			const children =
				token.type === 'mark' && token.children.length > 0
					? () => token.children.map(child => h(markRaw(Token), {key: key.get(child), token: child}))
					: undefined

			return h(Comp, compProps, children)
		}
	},
})

export default Token
</script>
```

- [ ] **Step 4: Remove row token-location registration from Vue Block**

In `Block.vue`, replace `setBlockRef` with:

```ts
const setBlockRef = (el: unknown) => {
	const resolved = el as {$el?: HTMLElement} | HTMLElement | null
	const element = (resolved && '$el' in resolved ? resolved.$el : resolved) as HTMLElement | null
	blockStore.attachContainer(element, props.blockIndex, {action: store.drag.action})
}
```

- [ ] **Step 5: Register Vue block controls through `controlFor()`**

In `DragHandle.vue`, register the outer `<div>` as the control and keep the button ref for drag:

Add these functions in the existing `<script setup lang="ts">` block:

```ts
const setPanelRef = (el: unknown) => {
	const path = index.value.pathFor(props.token)
	if (path) store.dom.controlFor(path)(el as HTMLElement | null)
}

const setGripRef = (el: unknown) => {
	const element = el as HTMLButtonElement | null
	blockStore.attachGrip(element, props.blockIndex, {action: store.drag.action})
}
```

Replace the template with:

```vue
<template>
	<div
		v-if="!readOnly"
		:ref="setPanelRef"
		:class="[
			styles.SidePanel,
			alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible,
		]"
	>
		<button
			:ref="setGripRef"
			type="button"
			draggable="true"
			:class="[styles.GripButton, isDragging && styles.GripButtonDragging]"
			aria-label="Drag to reorder or click for options"
		>
			<span :class="`${styles.Icon} ${styles.IconGrip}`" />
		</button>
	</div>
</template>
```

In `DropIndicator.vue` and `BlockMenu.vue`, replace `store.dom.refFor({role: 'control', ownerPath: path})` with `store.dom.controlFor(path)`.

- [ ] **Step 6: Run Vue focused tests**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Nested/nested.vue.spec.ts packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts
```

Expected: pass except snapshot tests not included in this command.

- [ ] **Step 7: Commit Vue adapter change**

```bash
git add packages/vue/markput/src/components packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Nested/nested.vue.spec.ts
git commit -m "refactor(vue): render token slots directly"
```

---

### Task 6: Remove Generic DOM Ref API

**Files:**

- Modify: `packages/core/src/shared/editorContracts.ts`
- Modify: `packages/core/src/features/dom/DomFeature.ts`
- Modify: any files found by the grep commands below.

- [ ] **Step 1: Verify old API call sites**

Run:

```bash
rg -n "refFor\\(|DomRefTarget|slotRootElement|role: 'slotRoot'|role: 'text'|role: 'token'" packages/core/src packages/react/markput/src packages/vue/markput/src
```

Expected: only old type definitions or missed usages. No React/Vue `Token` usage should remain after Tasks 4 and 5.

- [ ] **Step 2: Delete obsolete contracts**

In `editorContracts.ts`, delete:

```ts
export type DomRefTarget =
	| {readonly role: 'control'; readonly ownerPath?: TokenPath}
	| {readonly role: 'row' | 'token' | 'text' | 'slotRoot'; readonly path: TokenPath}
```

Keep:

```ts
export type DomRef = (element: HTMLElement | null) => void
```

because `controlFor()` still returns it.

Ensure `NodeLocationResult` has no `slotRootElement`.

- [ ] **Step 3: Delete obsolete code in DomFeature**

Confirm `DomFeature.ts` has no:

```ts
refFor(
#targetKey
slotRootElement
role: 'slotRoot'
```

If any remain, delete them and use the structural index record instead.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit API cleanup**

```bash
git add packages/core/src packages/react/markput/src packages/vue/markput/src
git commit -m "refactor(core): remove generic DOM ref API"
```

---

### Task 7: Snapshots And Storybook Coverage

**Files:**

- Modify: `packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap`
- Modify: `packages/storybook/src/pages/__snapshots__/stories.vue.spec.ts.snap`
- Modify: storybook tests if snapshot assertions reveal stale wrapper assumptions.

- [ ] **Step 1: Update Storybook snapshots**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/stories.react.spec.tsx packages/storybook/src/pages/stories.vue.spec.ts --update
```

Expected: snapshots update from wrapper-heavy DOM to direct token roots.

- [ ] **Step 2: Inspect snapshot changes**

Run:

```bash
git diff -- packages/storybook/src/pages/__snapshots__/stories.react.spec.tsx.snap packages/storybook/src/pages/__snapshots__/stories.vue.spec.ts.snap
```

Expected: removed nested adapter spans around text and mark roots. No user-visible text should disappear.

- [ ] **Step 3: Run Storybook focused suites**

Run:

```bash
pnpm -w vitest run packages/storybook/src/pages/Base/Base.react.spec.tsx packages/storybook/src/pages/Base/Base.vue.spec.ts packages/storybook/src/pages/Nested/nested.react.spec.tsx packages/storybook/src/pages/Nested/nested.vue.spec.ts packages/storybook/src/pages/Clipboard/Clipboard.react.spec.tsx packages/storybook/src/pages/Clipboard/Clipboard.vue.spec.ts packages/storybook/src/pages/stories.react.spec.tsx packages/storybook/src/pages/stories.vue.spec.ts
```

Expected: pass.

- [ ] **Step 4: Commit snapshots**

```bash
git add packages/storybook/src/pages
git commit -m "test(storybook): update structural token snapshots"
```

---

### Task 8: Final Verification

**Files:**

- No planned source edits.

- [ ] **Step 1: Verify no old adapter DOM refs remain**

Run:

```bash
rg -n "refFor\\(|DomRefTarget|slotRootElement|role: 'slotRoot'|role: 'text'|role: 'token'|querySelectorAll<HTMLElement>\\('\\[contenteditable" packages/core/src packages/react/markput/src packages/vue/markput/src
```

Expected: no matches.

- [ ] **Step 2: Run full local checks**

Run:

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint:check
pnpm run format:check
```

Expected: all pass.

- [ ] **Step 3: Capture final branch status**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: clean working tree and recent task commits visible on `codex/core-editor-engine-dom-location`.
