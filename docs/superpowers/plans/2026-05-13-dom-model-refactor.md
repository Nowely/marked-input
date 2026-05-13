# DomController → DomModel Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 829-line `dom/DomController.ts` god class with a focused `DomModel` facade composed of `DomIndexer`, `DomBoundary`, `DomCaretPlacer`, and shared `textOffsets` helpers — keeping the public `store.dom.*` surface byte-identical so no consumers churn beyond the type-import rename.

**Architecture:** Six tasks. Task 1 renames the file/class/imports so external consumers stop referencing `DomController` (one commit of churn, easy to land). Tasks 2–5 extract pure helpers and then three single-purpose collaborator classes (`DomIndexer`, `DomBoundary`, `DomCaretPlacer`) in increasing dependency order, each leaving the test suite green. Task 6 refreshes `dom/README.md` to describe the new split.

**Tech Stack:** TypeScript, signals (`packages/core/src/shared/signals`), vitest, pnpm workspace. Tests run via `pnpm --filter @markput/core test --run` from the monorepo root.

**Baseline:** 30 test files, 569 passed, 1 todo. After every task this count must be unchanged.

---

## Task 1: Rename `DomController` → `DomModel`

Move the file, rename the class, update 9 import sites, rename the spec, update the `describe` block string. No behavior change. After this task the file is still 829 lines and still does six things — that gets fixed in Tasks 2–5.

**Files:**
- Move: `packages/core/src/features/dom/DomController.ts` → `packages/core/src/features/dom/DomModel.ts`
- Move: `packages/core/src/features/dom/DomController.spec.ts` → `packages/core/src/features/dom/DomModel.spec.ts`
- Modify: `packages/core/src/features/dom/index.ts`
- Modify: `packages/core/src/store/Store.ts:3,33`
- Modify: `packages/core/src/features/caret/TriggerFinder.ts:3,22,49`
- Modify: `packages/core/src/features/caret/CaretModel.ts:5,18,31`
- Modify: `packages/core/src/features/overlay/OverlayController.ts:9,45`
- Modify: `packages/core/src/features/keyboard/KeyboardController.ts:2,16`
- Modify: `packages/core/src/features/clipboard/ClipboardController.ts:3,41`
- Modify: `packages/core/src/shared/classes/MarkputHandler.ts:1,7`

- [ ] **Step 1: Move the source file with git mv**

```bash
git mv packages/core/src/features/dom/DomController.ts packages/core/src/features/dom/DomModel.ts
```

- [ ] **Step 2: Move the spec file with git mv**

```bash
git mv packages/core/src/features/dom/DomController.spec.ts packages/core/src/features/dom/DomModel.spec.ts
```

- [ ] **Step 3: Rename the class declaration in DomModel.ts**

In `packages/core/src/features/dom/DomModel.ts`, change line 128:

From:
```ts
export class DomController {
```

To:
```ts
export class DomModel {
```

- [ ] **Step 4: Update the dom feature barrel**

Replace the contents of `packages/core/src/features/dom/index.ts`:

```ts
export {DomModel} from './DomModel'
export {isTextTokenSpan} from './isTextTokenSpan'
```

- [ ] **Step 5: Update Store.ts**

In `packages/core/src/store/Store.ts`, change line 3:

From:
```ts
import {DomController} from '../features/dom'
```

To:
```ts
import {DomModel} from '../features/dom'
```

And line 33:

From:
```ts
readonly dom = new DomController(this.lifecycle, this.props, this.parsing, this.value)
```

To:
```ts
readonly dom = new DomModel(this.lifecycle, this.props, this.parsing, this.value)
```

- [ ] **Step 6: Update TriggerFinder.ts**

In `packages/core/src/features/caret/TriggerFinder.ts`, replace all three occurrences of `DomController` with `DomModel`:

- Line 3 import: `import type {DomController} from '../dom/DomController'` → `import type {DomModel} from '../dom/DomModel'`
- Line 22 constructor param: `constructor(private readonly dom?: DomController)` → `constructor(private readonly dom?: DomModel)`
- Line 49 method param: `dom?: DomController` → `dom?: DomModel`

- [ ] **Step 7: Update CaretModel.ts**

In `packages/core/src/features/caret/CaretModel.ts`:

- Line 5: `import type {DomController} from '../dom/DomController'` → `import type {DomModel} from '../dom/DomModel'`
- Line 18 (JSDoc comment): `{@link DomController.reconcile}` → `{@link DomModel.reconcile}`
- Line 31 constructor param: `private readonly dom: DomController` → `private readonly dom: DomModel`

- [ ] **Step 8: Update OverlayController.ts**

In `packages/core/src/features/overlay/OverlayController.ts`:

- Line 9: `import type {DomController} from '../dom/DomController'` → `import type {DomModel} from '../dom/DomModel'`
- Line 45 constructor param: `private readonly dom: DomController` → `private readonly dom: DomModel`

- [ ] **Step 9: Update KeyboardController.ts**

In `packages/core/src/features/keyboard/KeyboardController.ts`:

- Line 2: `import type {DomController} from '../dom/DomController'` → `import type {DomModel} from '../dom/DomModel'`
- Line 16 constructor param: `dom: DomController` → `dom: DomModel`

- [ ] **Step 10: Update ClipboardController.ts**

In `packages/core/src/features/clipboard/ClipboardController.ts`:

- Line 3: `import type {DomController} from '../dom/DomController'` → `import type {DomModel} from '../dom/DomModel'`
- Line 41 constructor param: `private readonly dom: DomController` → `private readonly dom: DomModel`

- [ ] **Step 11: Update MarkputHandler.ts**

In `packages/core/src/shared/classes/MarkputHandler.ts`:

- Line 1: `import type {DomController} from '../../features/dom/DomController'` → `import type {DomModel} from '../../features/dom/DomModel'`
- Line 7 constructor param: `private readonly dom: DomController` → `private readonly dom: DomModel`

- [ ] **Step 12: Update the describe block in the renamed spec**

In `packages/core/src/features/dom/DomModel.spec.ts`, line 152:

From:
```ts
describe('DomController structural indexing', () => {
```

To:
```ts
describe('DomModel structural indexing', () => {
```

- [ ] **Step 13: Verify no other `DomController` references remain**

Run:
```bash
grep -rn "DomController" packages/core/src/ packages/common/core/src/ 2>/dev/null
```

Expected output: **empty** (zero matches). If anything matches, update those references the same way (import + usage).

- [ ] **Step 14: Run the test suite**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

- [ ] **Step 15: Commit**

```bash
git add -A packages/core/src/features/dom packages/core/src/store/Store.ts packages/core/src/features/caret packages/core/src/features/overlay packages/core/src/features/keyboard packages/core/src/features/clipboard packages/core/src/shared/classes/MarkputHandler.ts
git commit -m "refactor(dom): rename DomController to DomModel"
```

---

## Task 2: Extract `textOffsets.ts` pure helpers

Move the seven free functions at the top of `DomModel.ts` (lines 51–126) into a new `textOffsets.ts` so the class file shrinks and the helpers become independently importable.

**Files:**
- Create: `packages/core/src/features/dom/textOffsets.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts:1-126`

- [ ] **Step 1: Create `packages/core/src/features/dom/textOffsets.ts`**

Write the file with exactly these contents (copied verbatim from `DomModel.ts` lines 51–126):

```ts
export function nextTextNode(walker: TreeWalker): Text | null {
	const node = walker.nextNode()
	return node instanceof Text ? node : null
}

export function splitsSurrogatePair(text: string, offset: number): boolean {
	if (offset <= 0 || offset >= text.length) return false
	const prev = text.charCodeAt(offset - 1)
	const next = text.charCodeAt(offset)
	return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
}

export function textOffsetWithin(surface: HTMLElement, node: Node, offset: number): number | undefined {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? ''
		if (splitsSurrogatePair(text, offset)) return undefined
		return node instanceof Text ? textOffsetFromTreeWalker(surface, node, offset) : undefined
	}

	if (node === surface) return elementBoundaryOffset(surface, offset)
	return undefined
}

export function textOffsetFromTreeWalker(surface: HTMLElement, target: Text, targetOffset: number): number | undefined {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextTextNode(walker)
	while (current) {
		if (current === target) return total + targetOffset
		total += current.length
		current = nextTextNode(walker)
	}
	return undefined
}

export function textLength(surface: HTMLElement): number {
	let total = 0
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
	let current = nextTextNode(walker)
	while (current) {
		total += current.length
		current = nextTextNode(walker)
	}
	return total
}

export function elementBoundaryOffset(surface: HTMLElement, offset: number): number | undefined {
	if (offset <= 0) return 0
	if (offset >= surface.childNodes.length) return textLength(surface)

	let total = 0
	for (let i = 0; i < offset; i++) {
		const child = surface.childNodes.item(i)
		if (child.nodeType === Node.TEXT_NODE && child instanceof Text) {
			total += child.length
			continue
		}
		if (child instanceof HTMLElement) total += textLength(child)
	}
	return total
}

export function hasEditableAncestorBefore(node: Node, boundary: HTMLElement): boolean {
	let current = node instanceof HTMLElement ? node : node.parentElement
	while (current && current !== boundary) {
		if (
			current.isContentEditable ||
			current.contentEditable === 'true' ||
			current.contentEditable === 'plaintext-only'
		) {
			return true
		}
		current = current.parentElement
	}
	return false
}
```

- [ ] **Step 2: Remove the duplicated helpers from DomModel.ts and add the import**

In `packages/core/src/features/dom/DomModel.ts`, delete lines 51–126 (the seven free functions). Then add the import in the import block at the top of the file, immediately after the existing imports. The final top-of-file should look like:

```ts
import {firstHtmlChild} from '../../shared/checkers'
import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	NodeLocationResult,
	Range,
	RawSelection,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {batch, computed, event, listen, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathEquals, pathKey} from '../parsing/tokenIndex'
import type {TokenIndex} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import {hasEditableAncestorBefore, nextTextNode, splitsSurrogatePair, textLength, textOffsetWithin} from './textOffsets'
```

(Note: `textOffsetFromTreeWalker` and `elementBoundaryOffset` are used only inside `textOffsetWithin`, so they don't need to be imported. The five names listed above are the ones referenced directly from `DomModel`'s methods.)

- [ ] **Step 3: Run the test suite**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

- [ ] **Step 4: Verify the file shrunk and helpers moved**

Run:
```bash
wc -l packages/core/src/features/dom/DomModel.ts packages/core/src/features/dom/textOffsets.ts
```

Expected: `DomModel.ts` around 750 lines (down from 829), `textOffsets.ts` around 75 lines.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/textOffsets.ts packages/core/src/features/dom/DomModel.ts
git commit -m "refactor(dom): extract textOffsets helpers from DomModel"
```

---

## Task 3: Extract `DomIndexer`

Move indexing (`#commitRendered` and friends), text-surface reconciliation, the `#pathElements` / `#elementRoles` maps, `locateNode`, the `#rendering` re-entry guard, and the generation counter into a new `DomIndexer` class. `DomModel` retains the public `index`/`indexed`/`diagnostics` surface and the click-on-empty listener; it composes a `DomIndexer` and delegates `reconcile` and `locateNode`.

**Files:**
- Create: `packages/core/src/features/dom/DomIndexer.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts`

- [ ] **Step 1: Create `packages/core/src/features/dom/DomIndexer.ts`**

Write the file with this complete content:

```ts
import type {
	DomDiagnostic,
	DomIndex,
	NodeLocationResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {batch, computed, signal, watch} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathEquals, pathKey} from '../parsing/tokenIndex'
import type {TokenIndex} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'

export type RegisteredRole =
	| {readonly role: 'control'}
	| {
			readonly role: 'childSequence' | 'row' | 'token' | 'text'
			readonly path: TokenPath
			readonly address: TokenAddress
	  }

export type PathElements = {
	path: TokenPath
	address: TokenAddress
	rowElement?: HTMLElement
	tokenElement: HTMLElement
	textElement?: HTMLElement
}

export type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

export type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

export interface DomIndexerHost {
	container(): HTMLElement | null
	pendingControls(): IterableIterator<ControlRegistration>
	pendingChildSequences(): IterableIterator<ChildSequenceRegistration>
	emitDiagnostic(diagnostic: DomDiagnostic): void
	emitIndexed(): void
}

export class DomIndexer {
	readonly #domIndex = signal<DomIndex>(undefined, {readonly: true})
	readonly index: Computed<DomIndex | undefined> = computed(() => this.#domIndex())

	#elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
	#pathElements = new Map<string, PathElements>()
	#generation = 0
	#rendering = false
	#queuedRender = false

	constructor(
		private readonly host: DomIndexerHost,
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController
	) {
		lifecycle.onMounted(() => {
			watch(lifecycle.rendered, () => {
				this.#handleRendered()
			})
			watch(
				computed(() => props.readOnly()),
				() => this.reconcile()
			)
		})
	}

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#reconcileStructuralTextSurfaces(opts?.isUserSelecting)
	}

	locateNode(node: Node): NodeLocationResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const container = this.host.container()
		if (!container || !container.contains(node)) return {ok: false, reason: 'outsideEditor'}

		let current: Node | null = node
		while (current) {
			if (current instanceof HTMLElement) {
				const role = this.#elementRoles.get(current)
				if (role?.role === 'control') return {ok: false, reason: 'control'}
				if (role) {
					const elements = this.#pathElements.get(pathKey(role.path))
					if (!elements?.tokenElement) return {ok: false, reason: 'notIndexed'}
					return {
						ok: true,
						value: {
							address: role.address,
							tokenElement: elements.tokenElement,
							textElement: elements.textElement,
							rowElement: elements.rowElement,
						},
					}
				}
			}
			if (current === container) break
			current = current.parentNode
		}

		return {ok: false, reason: 'outsideEditor'}
	}

	pathElements(): IterableIterator<PathElements> {
		return this.#pathElements.values()
	}

	pathElementsFor(address: TokenAddress): PathElements | undefined {
		return this.#pathElements.get(pathKey(address.path))
	}

	roleFor(element: HTMLElement): RegisteredRole | undefined {
		return this.#elementRoles.get(element)
	}

	#handleRendered(): void {
		if (this.#rendering) {
			this.#queuedRender = true
			this.host.emitDiagnostic({kind: 'renderReentry', reason: 'rendered event queued during DOM indexing'})
			return
		}

		this.#rendering = true
		try {
			this.#commitRendered()
		} finally {
			this.#rendering = false
			const queued = this.#queuedRender
			this.#queuedRender = false
			if (queued) this.#handleRendered()
		}
	}

	#commitRendered(): void {
		const container = this.host.container()
		if (!container) {
			this.host.emitDiagnostic({kind: 'missingContainer', reason: 'container is not registered'})
			return
		}

		const tokenIndex = this.parsing.index()
		const pathElements = new Map<string, PathElements>()
		const elementRoles = new WeakMap<HTMLElement, RegisteredRole>()
		const controlElements = new Set<HTMLElement>()

		for (const {element} of this.host.pendingControls()) {
			controlElements.add(element)
			elementRoles.set(element, {role: 'control'})
		}

		const tokens = this.parsing.tokens()
		if (this.props.layout() === 'block') {
			this.#indexBlockTokens(container, tokens, tokenIndex, controlElements, pathElements, elementRoles)
		} else {
			this.#indexTokenSequence(
				container,
				tokens,
				[],
				undefined,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
		}

		this.#pathElements = pathElements
		this.#elementRoles = elementRoles
		this.#reconcileStructuralTextSurfaces()

		batch(() => this.#domIndex({generation: ++this.#generation}), {mutable: true})
		this.host.emitIndexed()
	}

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

	#childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const hosts: HTMLElement[] = []
		for (const registration of this.host.pendingChildSequences()) {
			if (pathEquals(registration.ownerPath, ownerPath)) hosts.push(registration.element)
		}
		return hosts
	}

	#indexNestedTokenSequence(
		token: Token,
		path: TokenPath,
		address: TokenAddress,
		ownerElement: HTMLElement,
		rowElement: HTMLElement | undefined,
		tokenIndex: TokenIndex,
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
			this.host.emitDiagnostic({
				kind: 'ambiguousStructure',
				path,
				reason: `expected exactly 1 child sequence host for owner path ${ownerKey} but found ${hosts.length}`,
			})
			return
		}

		const host = hosts[0]
		if (!ownerElement.contains(host)) {
			this.host.emitDiagnostic({
				kind: 'ambiguousStructure',
				path,
				reason: `child sequence host for owner path ${ownerKey} is not contained by owner token element`,
			})
			return
		}

		elementRoles.set(host, {role: 'childSequence', path, address})
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

	#indexBlockTokens(
		container: HTMLElement,
		tokens: readonly Token[],
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const rows = this.#elementChildren(container)
		if (rows.length !== tokens.length) {
			this.host.emitDiagnostic({
				kind: 'ambiguousStructure',
				reason: `expected ${tokens.length} block rows but found ${rows.length}`,
			})
		}

		tokens.forEach((token, i) => {
			const row = rows.at(i)
			if (!row) return
			const candidates = this.#elementChildren(row).filter(child => !this.#isControlRoot(child, controlElements))
			if (candidates.length !== 1) {
				this.host.emitDiagnostic({
					kind: 'ambiguousStructure',
					path: [i],
					reason: `expected 1 block token element but found ${candidates.length}`,
				})
				return
			}
			this.#indexTokenElement(
				token,
				[i],
				candidates[0],
				row,
				tokenIndex,
				controlElements,
				pathElements,
				elementRoles
			)
		})
	}

	#indexTokenSequence(
		parent: HTMLElement,
		tokens: readonly Token[],
		basePath: TokenPath,
		rowElement: HTMLElement | undefined,
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const elements = this.#elementChildren(parent).filter(child => !this.#isControlRoot(child, controlElements))
		if (elements.length !== tokens.length) {
			this.host.emitDiagnostic({
				kind: 'ambiguousStructure',
				path: basePath.length ? basePath : undefined,
				reason: `expected ${tokens.length} child token elements but found ${elements.length}`,
			})
			return
		}

		tokens.forEach((token, i) => {
			const element = elements.at(i)
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
		tokenIndex: TokenIndex,
		controlElements: Set<HTMLElement>,
		pathElements: Map<string, PathElements>,
		elementRoles: WeakMap<HTMLElement, RegisteredRole>
	): void {
		const address = tokenIndex.addressFor(path)
		if (!address) {
			this.host.emitDiagnostic({kind: 'stalePath', path, reason: 'structural path no longer resolves'})
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
		if (rowElement && path.length === 1) elementRoles.set(rowElement, {role: 'row', path, address})

		this.#indexNestedTokenSequence(
			token,
			path,
			address,
			element,
			rowElement,
			tokenIndex,
			controlElements,
			pathElements,
			elementRoles
		)
	}

	#reconcileStructuralTextSurfaces(isUserSelecting?: boolean): void {
		const tokenIndex = this.parsing.index()
		const editable = this.props.readOnly() || isUserSelecting ? 'false' : 'true'

		for (const record of this.#pathElements.values()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok) {
				this.host.emitDiagnostic({
					kind: 'stalePath',
					path: record.path,
					reason: 'structural path became stale during reconciliation',
				})
				continue
			}

			if (record.textElement) {
				if (resolved.value.type !== 'text') {
					this.host.emitDiagnostic({
						kind: 'missingRole',
						path: record.path,
						reason: 'text role registered for non-text token',
					})
					continue
				}
				if (record.textElement.textContent !== resolved.value.content) {
					record.textElement.textContent = resolved.value.content
				}
				record.textElement.contentEditable = editable
				continue
			}

			if (resolved.value.type === 'mark') {
				if (this.props.readOnly()) {
					record.tokenElement.removeAttribute('tabindex')
				} else {
					record.tokenElement.tabIndex = 0
				}
			}
		}
	}
}
```

- [ ] **Step 2: Rewrite `DomModel.ts` to use `DomIndexer`**

Replace the contents of `packages/core/src/features/dom/DomModel.ts` with:

```ts
import {firstHtmlChild} from '../../shared/checkers'
import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	NodeLocationResult,
	Range,
	RawSelection,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {computed, event, listen, signal} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import {pathKey} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import type {
	ChildSequenceRegistration,
	ControlRegistration,
	DomIndexerHost,
	PathElements,
} from './DomIndexer'
import {DomIndexer} from './DomIndexer'
import {hasEditableAncestorBefore, nextTextNode, splitsSurrogatePair, textLength, textOffsetWithin} from './textOffsets'

export class DomModel {
	readonly container = signal<HTMLElement | null>(null)
	readonly diagnostics = event<DomDiagnostic>()
	readonly indexed = event<void>()
	readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly index: Computed<DomIndex | undefined>

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {
		const host: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitDiagnostic: diagnostic => this.diagnostics(diagnostic),
			emitIndexed: () => this.indexed(),
		}
		this.#indexer = new DomIndexer(host, lifecycle, props, parsing)
		this.index = this.#indexer.index

		lifecycle.onMounted(() => {
			const container = this.container()
			if (container) {
				listen(container, 'click', () => {
					const tokens = this.parsing.tokens()
					if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
						const c = this.container()
						const element = c ? firstHtmlChild(c) : null
						element?.focus()
					}
				})
			}
		})
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		if (!this.#isComposing) return
		this.#isComposing = false
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${ownerPath ? pathKey(ownerPath) : 'global'}:${++this.#nextControlId}`

		const callback: DomRef = element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
		return callback
	}

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

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#indexer.reconcile(opts)
	}

	locateNode(node: Node): NodeLocationResult {
		return this.#indexer.locateNode(node)
	}

	placeAt(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const maxPos = this.value.current().length
		const clamped = Math.min(rawPosition, maxPos)
		const target = this.#findTextTargetForRawPosition(clamped, affinity)
		if (!target) {
			const boundary = this.#focusMarkBoundaryForRawPosition(clamped)
			if (!boundary.ok) return boundary
			return {ok: true, value: {applied: clamped}}
		}
		target.element.focus()
		this.#placeCaretInTextSurface(target.element, clamped - target.start)
		return {ok: true, value: {applied: clamped}}
	}

	placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}
		const result = this.#placeSelection({range: clamped, direction: undefined})
		if (!result.ok) return result
		return {ok: true, value: {applied: clamped}}
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const resolved = this.parsing.index().resolveAddress(address)
		if (!resolved.ok) return {ok: false, reason: 'stale'}

		const elements = this.#indexer.pathElementsFor(address)
		const target = elements?.textElement ?? elements?.tokenElement ?? elements?.rowElement
		if (!target) return {ok: false, reason: 'notIndexed'}

		target.focus()
		const role =
			target === elements?.textElement ? 'text' : target === elements?.rowElement ? 'row' : 'markDescendant'
		if (role === 'markDescendant') {
			this.#placeCollapsedBoundary(target, boundary === 'end' ? target.childNodes.length : 0)
		}
		return {ok: true, value: undefined}
	}

	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		if (this.#isComposing) return {ok: false, reason: 'composing'}

		const container = this.container()
		if (container && node === container) {
			return this.#rawPositionFromContainerBoundary(offset, affinity)
		}

		const location = this.locateNode(node)
		if (!location.ok) return location.reason === 'control' ? {ok: false, reason: 'control'} : location

		const token = this.parsing.index().resolveAddress(location.value.address)
		if (!token.ok) return {ok: false, reason: 'notIndexed'}

		if (node instanceof HTMLElement) {
			const role = this.#indexer.roleFor(node)
			if (role?.role === 'childSequence') {
				const childCount = node.childNodes.length
				if (offset <= 0) return {ok: true, value: token.value.position.start}
				if (offset >= childCount) return {ok: true, value: token.value.position.end}
				return this.#rawPositionFromTokenChildBoundary(node, offset, token.value, affinity)
			}
		}

		const textElement = location.value.textElement
		if (textElement?.contains(node)) {
			const local = textOffsetWithin(textElement, node, offset)
			if (local === undefined) return {ok: false, reason: 'invalidBoundary'}
			return {ok: true, value: token.value.position.start + local}
		}

		if (node === location.value.tokenElement) {
			const childCount = location.value.tokenElement.childNodes.length
			if (offset <= 0) return {ok: true, value: token.value.position.start}
			if (offset >= childCount) return {ok: true, value: token.value.position.end}
			return this.#rawPositionFromTokenChildBoundary(location.value.tokenElement, offset, token.value, affinity)
		}

		if (token.value.type === 'mark' && location.value.tokenElement.contains(node)) {
			if (hasEditableAncestorBefore(node, location.value.tokenElement)) {
				return {ok: false, reason: 'invalidBoundary'}
			}
			return {
				ok: true,
				value: affinity === 'after' ? token.value.position.start : token.value.position.end,
			}
		}

		if (location.value.rowElement && node === location.value.rowElement) {
			return {ok: true, value: offset <= 0 ? token.value.position.start : token.value.position.end}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	readRawSelection(): RawSelectionResult {
		if (!this.index()) return {ok: false, reason: 'notIndexed'}
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return {ok: false, reason: 'invalidBoundary'}

		const range = selection.getRangeAt(0)
		const start = this.rawPositionFromBoundary(range.startContainer, range.startOffset, 'after')
		const end = this.rawPositionFromBoundary(range.endContainer, range.endOffset, 'before')

		if (!start.ok) {
			const reason = start.reason === 'composing' ? 'invalidBoundary' : start.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}
		if (!end.ok) {
			const reason = end.reason === 'composing' ? 'invalidBoundary' : end.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}

		const rangeValue =
			start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return {ok: true, value: direction ? {range: rangeValue, direction} : {range: rangeValue}}
	}

	#rawPositionFromContainerBoundary(offset: number, affinity: 'before' | 'after'): BoundaryPositionResult {
		const tokens = this.parsing.tokens()
		if (tokens.length === 0) return {ok: true, value: 0}
		if (offset <= 0) return {ok: true, value: tokens[0].position.start}
		if (offset >= tokens.length) return {ok: true, value: tokens[tokens.length - 1].position.end}

		const before = tokens[offset - 1]
		const after = tokens[offset]
		return {ok: true, value: affinity === 'before' ? before.position.end : after.position.start}
	}

	#rawPositionFromTokenChildBoundary(
		tokenElement: HTMLElement,
		offset: number,
		token: Token,
		affinity: 'before' | 'after'
	): BoundaryPositionResult {
		if (token.type === 'text') {
			const path = this.parsing.index().pathFor(token) ?? []
			const elements = this.parsing.index().addressFor(path)
			const textElement = elements ? this.#indexer.pathElementsFor(elements)?.textElement : undefined
			if (!textElement || textLength(textElement) === 0) return {ok: true, value: token.position.start}
		}

		const before = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset))
		if (before?.ok && after?.ok) {
			const beforeToken = this.parsing.index().resolveAddress(before.value.address)
			const afterToken = this.parsing.index().resolveAddress(after.value.address)
			if (beforeToken.ok && afterToken.ok) {
				return {
					ok: true,
					value: affinity === 'before' ? beforeToken.value.position.end : afterToken.value.position.start,
				}
			}
		}

		return {ok: true, value: affinity === 'before' ? token.position.start : token.position.end}
	}

	#locateRegisteredDescendant(node: Node | null): NodeLocationResult | undefined {
		if (!node) return undefined
		return this.locateNode(node)
	}

	#findTextTargetForRawPosition(
		rawPosition: number,
		affinity: 'before' | 'after'
	): {element: HTMLElement; start: number; end: number} | undefined {
		const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
		const tokenIndex = this.parsing.index()

		for (const record of this.#indexer.pathElements()) {
			if (!record.textElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'text') continue
			candidates.push({
				element: record.textElement,
				start: resolved.value.position.start,
				end: resolved.value.position.end,
			})
		}

		candidates.sort((a, b) => a.start - b.start)
		const containing = candidates.find(candidate => rawPosition >= candidate.start && rawPosition <= candidate.end)
		if (containing) return containing
		if (affinity === 'before') return [...candidates].toReversed().find(candidate => candidate.end <= rawPosition)
		return candidates.find(candidate => candidate.start >= rawPosition)
	}

	#focusMarkBoundaryForRawPosition(rawPosition: number): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const tokenIndex = this.parsing.index()

		for (const record of this.#indexer.pathElements()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'mark') continue
			if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

			const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
			record.tokenElement.focus()
			this.#placeCollapsedBoundary(
				record.tokenElement,
				boundary === 'end' ? record.tokenElement.childNodes.length : 0
			)
			return {ok: true, value: undefined}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	#placeCaretInTextSurface(surface: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const boundary = this.#boundaryInTextSurface(surface, offset)
		if (!boundary) return
		const range = document.createRange()
		range.setStart(boundary.node, boundary.offset)
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#placeCollapsedBoundary(element: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const range = document.createRange()
		range.setStart(element, Math.min(Math.max(offset, 0), element.childNodes.length))
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#placeSelection(selection: RawSelection): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const start = this.#findTextTargetForRawPosition(selection.range.start, 'after')
		const end = this.#findTextTargetForRawPosition(selection.range.end, 'before')
		const browserSelection = window.getSelection()
		if (!start || !end || !browserSelection) return {ok: false, reason: 'invalidBoundary'}

		const startBoundary = this.#boundaryInTextSurface(start.element, selection.range.start - start.start)
		const endBoundary = this.#boundaryInTextSurface(end.element, selection.range.end - end.start)
		if (!startBoundary || !endBoundary) return {ok: false, reason: 'invalidBoundary'}

		const range = document.createRange()
		range.setStart(startBoundary.node, startBoundary.offset)
		range.setEnd(endBoundary.node, endBoundary.offset)
		browserSelection.removeAllRanges()
		browserSelection.addRange(range)
		return {ok: true, value: undefined}
	}

	#boundaryInTextSurface(surface: HTMLElement, offset: number): {node: Text; offset: number} | undefined {
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		let node = nextTextNode(walker)
		while (node) {
			if (remaining <= node.length) return {node, offset: remaining}
			remaining -= node.length
			node = nextTextNode(walker)
		}

		const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
		if (!text.parentNode) surface.append(text)
		return {node: text, offset: text.length}
	}
}
```

Notes:
- `splitsSurrogatePair` is no longer imported because nothing in `DomModel` references it directly after the move (it's used only by `textOffsetWithin`). Leave it out of the import.
- The `#rawPositionFromTokenChildBoundary` path that looked up `textElement` by walking back through `pathFor` is rewritten to ask the indexer for `pathElementsFor`. The behavior is identical (same lookup chain), just routed through the new internal interface.

- [ ] **Step 3: Run the test suite**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

If any test fails, the most likely cause is one of:
1. A type used in `DomModel` that didn't get re-imported from `DomIndexer` (check for missing `PathElements`, `RegisteredRole`, etc.).
2. `splitsSurrogatePair` import inadvertently left in `DomModel.ts` (should be removed).
3. A boundary or path lookup that referenced `this.#pathElements` directly (every such reference must now go through `this.#indexer.pathElements()` or `pathElementsFor`).

- [ ] **Step 4: Verify file sizes**

Run:
```bash
wc -l packages/core/src/features/dom/DomModel.ts packages/core/src/features/dom/DomIndexer.ts packages/core/src/features/dom/textOffsets.ts
```

Expected: `DomModel.ts` around 440 lines, `DomIndexer.ts` around 320 lines, `textOffsets.ts` around 75 lines.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomIndexer.ts packages/core/src/features/dom/DomModel.ts
git commit -m "refactor(dom): extract DomIndexer from DomModel"
```

---

## Task 4: Extract `DomBoundary`

Move `rawPositionFromBoundary`, `readRawSelection`, and their private helpers (`#rawPositionFromContainerBoundary`, `#rawPositionFromTokenChildBoundary`, `#locateRegisteredDescendant`) into `DomBoundary`. `DomModel` keeps the composition flag and delegates the two public methods.

**Files:**
- Create: `packages/core/src/features/dom/DomBoundary.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts`

- [ ] **Step 1: Create `packages/core/src/features/dom/DomBoundary.ts`**

Write the file with this complete content:

```ts
import type {
	BoundaryPositionResult,
	NodeLocationResult,
	RawSelectionResult,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import type {PathElements, RegisteredRole} from './DomIndexer'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'

export interface DomBoundaryHost {
	container(): HTMLElement | null
	isIndexed(): boolean
	isComposing(): boolean
	locateNode(node: Node): NodeLocationResult
	roleFor(element: HTMLElement): RegisteredRole | undefined
	pathElementsFor(address: TokenAddress): PathElements | undefined
}

export class DomBoundary {
	constructor(
		private readonly host: DomBoundaryHost,
		private readonly parsing: ParseController
	) {}

	fromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		if (this.host.isComposing()) return {ok: false, reason: 'composing'}

		const container = this.host.container()
		if (container && node === container) {
			return this.#fromContainerBoundary(offset, affinity)
		}

		const location = this.host.locateNode(node)
		if (!location.ok) return location.reason === 'control' ? {ok: false, reason: 'control'} : location

		const token = this.parsing.index().resolveAddress(location.value.address)
		if (!token.ok) return {ok: false, reason: 'notIndexed'}

		if (node instanceof HTMLElement) {
			const role = this.host.roleFor(node)
			if (role?.role === 'childSequence') {
				const childCount = node.childNodes.length
				if (offset <= 0) return {ok: true, value: token.value.position.start}
				if (offset >= childCount) return {ok: true, value: token.value.position.end}
				return this.#fromTokenChildBoundary(node, offset, token.value, affinity)
			}
		}

		const textElement = location.value.textElement
		if (textElement?.contains(node)) {
			const local = textOffsetWithin(textElement, node, offset)
			if (local === undefined) return {ok: false, reason: 'invalidBoundary'}
			return {ok: true, value: token.value.position.start + local}
		}

		if (node === location.value.tokenElement) {
			const childCount = location.value.tokenElement.childNodes.length
			if (offset <= 0) return {ok: true, value: token.value.position.start}
			if (offset >= childCount) return {ok: true, value: token.value.position.end}
			return this.#fromTokenChildBoundary(location.value.tokenElement, offset, token.value, affinity)
		}

		if (token.value.type === 'mark' && location.value.tokenElement.contains(node)) {
			if (hasEditableAncestorBefore(node, location.value.tokenElement)) {
				return {ok: false, reason: 'invalidBoundary'}
			}
			return {
				ok: true,
				value: affinity === 'after' ? token.value.position.start : token.value.position.end,
			}
		}

		if (location.value.rowElement && node === location.value.rowElement) {
			return {ok: true, value: offset <= 0 ? token.value.position.start : token.value.position.end}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	readSelection(): RawSelectionResult {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return {ok: false, reason: 'invalidBoundary'}

		const range = selection.getRangeAt(0)
		const start = this.fromBoundary(range.startContainer, range.startOffset, 'after')
		const end = this.fromBoundary(range.endContainer, range.endOffset, 'before')

		if (!start.ok) {
			const reason = start.reason === 'composing' ? 'invalidBoundary' : start.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}
		if (!end.ok) {
			const reason = end.reason === 'composing' ? 'invalidBoundary' : end.reason
			return {
				ok: false,
				reason: reason === 'control' || reason === 'outsideEditor' ? 'mixedBoundary' : reason,
			}
		}

		const rangeValue =
			start.value <= end.value ? {start: start.value, end: end.value} : {start: end.value, end: start.value}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return {ok: true, value: direction ? {range: rangeValue, direction} : {range: rangeValue}}
	}

	#fromContainerBoundary(offset: number, affinity: 'before' | 'after'): BoundaryPositionResult {
		const tokens = this.parsing.tokens()
		if (tokens.length === 0) return {ok: true, value: 0}
		if (offset <= 0) return {ok: true, value: tokens[0].position.start}
		if (offset >= tokens.length) return {ok: true, value: tokens[tokens.length - 1].position.end}

		const before = tokens[offset - 1]
		const after = tokens[offset]
		return {ok: true, value: affinity === 'before' ? before.position.end : after.position.start}
	}

	#fromTokenChildBoundary(
		tokenElement: HTMLElement,
		offset: number,
		token: Token,
		affinity: 'before' | 'after'
	): BoundaryPositionResult {
		if (token.type === 'text') {
			const path: TokenPath = this.parsing.index().pathFor(token) ?? []
			const address = this.parsing.index().addressFor(path)
			const textElement = address ? this.host.pathElementsFor(address)?.textElement : undefined
			if (!textElement || textLength(textElement) === 0) return {ok: true, value: token.position.start}
		}

		const before = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset - 1))
		const after = this.#locateRegisteredDescendant(tokenElement.childNodes.item(offset))
		if (before?.ok && after?.ok) {
			const beforeToken = this.parsing.index().resolveAddress(before.value.address)
			const afterToken = this.parsing.index().resolveAddress(after.value.address)
			if (beforeToken.ok && afterToken.ok) {
				return {
					ok: true,
					value: affinity === 'before' ? beforeToken.value.position.end : afterToken.value.position.start,
				}
			}
		}

		return {ok: true, value: affinity === 'before' ? token.position.start : token.position.end}
	}

	#locateRegisteredDescendant(node: Node | null): NodeLocationResult | undefined {
		if (!node) return undefined
		return this.host.locateNode(node)
	}
}
```

- [ ] **Step 2: Update `DomModel.ts` to delegate to `DomBoundary`**

In `packages/core/src/features/dom/DomModel.ts`:

a. Add to the import block at the top (after the existing `./DomIndexer` import):

```ts
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'
```

b. Remove the now-unused imports `hasEditableAncestorBefore` and `textLength` from the `./textOffsets` import (leave `nextTextNode`, `splitsSurrogatePair`, `textOffsetWithin`). The line becomes:

```ts
import {nextTextNode, textOffsetWithin} from './textOffsets'
```

Wait — `textOffsetWithin` is also no longer used in `DomModel` after this task. Remove the entire `./textOffsets` import line and re-add it as:

```ts
import {nextTextNode} from './textOffsets'
```

c. Add a `#boundary` field and initialize it in the constructor. After the `this.#indexer = new DomIndexer(...)` line, append:

```ts
		const boundaryHost: DomBoundaryHost = {
			container: () => this.container(),
			isIndexed: () => this.index() !== undefined,
			isComposing: () => this.#isComposing,
			locateNode: node => this.#indexer.locateNode(node),
			roleFor: element => this.#indexer.roleFor(element),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, parsing)
```

And declare the field next to `#indexer`:

```ts
	readonly #boundary: DomBoundary
```

d. Replace the body of `rawPositionFromBoundary` and `readRawSelection` with delegations:

```ts
	rawPositionFromBoundary(
		node: Node,
		offset: number,
		affinity: 'before' | 'after' = 'after'
	): BoundaryPositionResult {
		return this.#boundary.fromBoundary(node, offset, affinity)
	}

	readRawSelection(): RawSelectionResult {
		return this.#boundary.readSelection()
	}
```

e. Delete the now-unused private methods: `#rawPositionFromContainerBoundary`, `#rawPositionFromTokenChildBoundary`, `#locateRegisteredDescendant`. Also remove the imports of `Token`, `hasEditableAncestorBefore`, `textLength`, `textOffsetWithin`, and `pathKey` if nothing else in the file references them — verify with the search in Step 3.

f. The unused-import cleanup: after removing the methods above, the following imports may become unused at the top of `DomModel.ts`. Remove any that are no longer referenced:
- `import type {Token} from '../parsing'`
- `pathKey` from `'../parsing/tokenIndex'` (still used by `controlFor`/`childrenFor`, so KEEP it)

Verify by searching:

```bash
grep -n "Token\|pathKey\|hasEditableAncestorBefore\|textLength\|textOffsetWithin" packages/core/src/features/dom/DomModel.ts
```

Adjust imports until no unused symbols remain.

- [ ] **Step 3: Run the test suite**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

- [ ] **Step 4: Verify file sizes**

Run:
```bash
wc -l packages/core/src/features/dom/DomModel.ts packages/core/src/features/dom/DomBoundary.ts
```

Expected: `DomModel.ts` around 340 lines, `DomBoundary.ts` around 165 lines.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomBoundary.ts packages/core/src/features/dom/DomModel.ts
git commit -m "refactor(dom): extract DomBoundary from DomModel"
```

---

## Task 5: Extract `DomCaretPlacer`

Move `placeAt`, `placeRange`, `focusAddress`, and their private helpers (`#findTextTargetForRawPosition`, `#focusMarkBoundaryForRawPosition`, `#placeCaretInTextSurface`, `#placeCollapsedBoundary`, `#placeSelection`, `#boundaryInTextSurface`) into `DomCaretPlacer`. `DomModel` keeps only thin delegations after this task.

**Files:**
- Create: `packages/core/src/features/dom/DomCaretPlacer.ts`
- Modify: `packages/core/src/features/dom/DomModel.ts`

- [ ] **Step 1: Create `packages/core/src/features/dom/DomCaretPlacer.ts`**

Write the file with this complete content:

```ts
import type {Range, RawSelection, Result, TokenAddress} from '../../shared/editorContracts'
import type {ParseController} from '../parsing/ParseController'
import type {PathElements} from './DomIndexer'
import type {ValueModel} from '../value/ValueModel'
import {nextTextNode} from './textOffsets'

export interface DomCaretHost {
	isIndexed(): boolean
	pathElements(): IterableIterator<PathElements>
	pathElementsFor(address: TokenAddress): PathElements | undefined
}

export class DomCaretPlacer {
	constructor(
		private readonly host: DomCaretHost,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {}

	placeAt(
		rawPosition: number,
		affinity: 'before' | 'after' = 'after'
	): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		const maxPos = this.value.current().length
		const clamped = Math.min(rawPosition, maxPos)
		const target = this.#findTextTargetForRawPosition(clamped, affinity)
		if (!target) {
			const boundary = this.#focusMarkBoundaryForRawPosition(clamped)
			if (!boundary.ok) return boundary
			return {ok: true, value: {applied: clamped}}
		}
		target.element.focus()
		this.#placeCaretInTextSurface(target.element, clamped - target.start)
		return {ok: true, value: {applied: clamped}}
	}

	placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
		const maxPos = this.value.current().length
		const clamped: Range = {
			start: Math.min(range.start, maxPos),
			end: Math.min(range.end, maxPos),
		}
		const result = this.#placeSelection({range: clamped, direction: undefined})
		if (!result.ok) return result
		return {ok: true, value: {applied: clamped}}
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		if (!this.host.isIndexed()) return {ok: false, reason: 'notIndexed'}
		const resolved = this.parsing.index().resolveAddress(address)
		if (!resolved.ok) return {ok: false, reason: 'stale'}

		const elements = this.host.pathElementsFor(address)
		const target = elements?.textElement ?? elements?.tokenElement ?? elements?.rowElement
		if (!target) return {ok: false, reason: 'notIndexed'}

		target.focus()
		const role =
			target === elements?.textElement ? 'text' : target === elements?.rowElement ? 'row' : 'markDescendant'
		if (role === 'markDescendant') {
			this.#placeCollapsedBoundary(target, boundary === 'end' ? target.childNodes.length : 0)
		}
		return {ok: true, value: undefined}
	}

	#findTextTargetForRawPosition(
		rawPosition: number,
		affinity: 'before' | 'after'
	): {element: HTMLElement; start: number; end: number} | undefined {
		const candidates: Array<{element: HTMLElement; start: number; end: number}> = []
		const tokenIndex = this.parsing.index()

		for (const record of this.host.pathElements()) {
			if (!record.textElement) continue
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'text') continue
			candidates.push({
				element: record.textElement,
				start: resolved.value.position.start,
				end: resolved.value.position.end,
			})
		}

		candidates.sort((a, b) => a.start - b.start)
		const containing = candidates.find(candidate => rawPosition >= candidate.start && rawPosition <= candidate.end)
		if (containing) return containing
		if (affinity === 'before') return [...candidates].toReversed().find(candidate => candidate.end <= rawPosition)
		return candidates.find(candidate => candidate.start >= rawPosition)
	}

	#focusMarkBoundaryForRawPosition(rawPosition: number): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const tokenIndex = this.parsing.index()

		for (const record of this.host.pathElements()) {
			const resolved = tokenIndex.resolveAddress(record.address)
			if (!resolved.ok || resolved.value.type !== 'mark') continue
			if (rawPosition !== resolved.value.position.start && rawPosition !== resolved.value.position.end) continue

			const boundary = rawPosition === resolved.value.position.end ? 'end' : 'start'
			record.tokenElement.focus()
			this.#placeCollapsedBoundary(
				record.tokenElement,
				boundary === 'end' ? record.tokenElement.childNodes.length : 0
			)
			return {ok: true, value: undefined}
		}

		return {ok: false, reason: 'invalidBoundary'}
	}

	#placeCaretInTextSurface(surface: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const boundary = this.#boundaryInTextSurface(surface, offset)
		if (!boundary) return
		const range = document.createRange()
		range.setStart(boundary.node, boundary.offset)
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#placeCollapsedBoundary(element: HTMLElement, offset: number): void {
		const selection = window.getSelection()
		if (!selection) return

		const range = document.createRange()
		range.setStart(element, Math.min(Math.max(offset, 0), element.childNodes.length))
		range.collapse(true)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	#placeSelection(selection: RawSelection): Result<void, 'notIndexed' | 'invalidBoundary'> {
		const start = this.#findTextTargetForRawPosition(selection.range.start, 'after')
		const end = this.#findTextTargetForRawPosition(selection.range.end, 'before')
		const browserSelection = window.getSelection()
		if (!start || !end || !browserSelection) return {ok: false, reason: 'invalidBoundary'}

		const startBoundary = this.#boundaryInTextSurface(start.element, selection.range.start - start.start)
		const endBoundary = this.#boundaryInTextSurface(end.element, selection.range.end - end.start)
		if (!startBoundary || !endBoundary) return {ok: false, reason: 'invalidBoundary'}

		const range = document.createRange()
		range.setStart(startBoundary.node, startBoundary.offset)
		range.setEnd(endBoundary.node, endBoundary.offset)
		browserSelection.removeAllRanges()
		browserSelection.addRange(range)
		return {ok: true, value: undefined}
	}

	#boundaryInTextSurface(surface: HTMLElement, offset: number): {node: Text; offset: number} | undefined {
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		let node = nextTextNode(walker)
		while (node) {
			if (remaining <= node.length) return {node, offset: remaining}
			remaining -= node.length
			node = nextTextNode(walker)
		}

		const text = surface.firstChild instanceof Text ? surface.firstChild : document.createTextNode('')
		if (!text.parentNode) surface.append(text)
		return {node: text, offset: text.length}
	}
}
```

- [ ] **Step 2: Rewrite `DomModel.ts` final form**

Replace the contents of `packages/core/src/features/dom/DomModel.ts` with the final minimal version:

```ts
import {firstHtmlChild} from '../../shared/checkers'
import type {
	BoundaryPositionResult,
	DomDiagnostic,
	DomIndex,
	DomRef,
	NodeLocationResult,
	Range,
	RawSelectionResult,
	Result,
	TokenAddress,
	TokenPath,
} from '../../shared/editorContracts'
import {computed, event, listen, signal} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {ParseController} from '../parsing/ParseController'
import {pathKey} from '../parsing/tokenIndex'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import {DomBoundary} from './DomBoundary'
import type {DomBoundaryHost} from './DomBoundary'
import {DomCaretPlacer} from './DomCaretPlacer'
import type {DomCaretHost} from './DomCaretPlacer'
import {DomIndexer} from './DomIndexer'
import type {
	ChildSequenceRegistration,
	ControlRegistration,
	DomIndexerHost,
} from './DomIndexer'

export class DomModel {
	readonly container = signal<HTMLElement | null>(null)
	readonly diagnostics = event<DomDiagnostic>()
	readonly indexed = event<void>()
	readonly readOnly: Computed<boolean> = computed(() => this.props.readOnly())

	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0
	#isComposing = false

	readonly #indexer: DomIndexer
	readonly #boundary: DomBoundary
	readonly #caret: DomCaretPlacer
	readonly index: Computed<DomIndex | undefined>

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly parsing: ParseController,
		private readonly value: ValueModel
	) {
		const indexerHost: DomIndexerHost = {
			container: () => this.container(),
			pendingControls: () => this.#pendingControls.values(),
			pendingChildSequences: () => this.#pendingChildSequences.values(),
			emitDiagnostic: diagnostic => this.diagnostics(diagnostic),
			emitIndexed: () => this.indexed(),
		}
		this.#indexer = new DomIndexer(indexerHost, lifecycle, props, parsing)
		this.index = this.#indexer.index

		const boundaryHost: DomBoundaryHost = {
			container: () => this.container(),
			isIndexed: () => this.index() !== undefined,
			isComposing: () => this.#isComposing,
			locateNode: node => this.#indexer.locateNode(node),
			roleFor: element => this.#indexer.roleFor(element),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#boundary = new DomBoundary(boundaryHost, parsing)

		const caretHost: DomCaretHost = {
			isIndexed: () => this.index() !== undefined,
			pathElements: () => this.#indexer.pathElements(),
			pathElementsFor: address => this.#indexer.pathElementsFor(address),
		}
		this.#caret = new DomCaretPlacer(caretHost, parsing, value)

		lifecycle.onMounted(() => {
			const container = this.container()
			if (container) {
				listen(container, 'click', () => {
					const tokens = this.parsing.tokens()
					if (tokens.length === 1 && tokens[0].type === 'text' && tokens[0].content === '') {
						const c = this.container()
						const element = c ? firstHtmlChild(c) : null
						element?.focus()
					}
				})
			}
		})
	}

	compositionStarted(): void {
		this.#isComposing = true
	}

	compositionEnded(): void {
		if (!this.#isComposing) return
		this.#isComposing = false
	}

	controlFor(ownerPath?: TokenPath): DomRef {
		const key = `control:${ownerPath ? pathKey(ownerPath) : 'global'}:${++this.#nextControlId}`

		const callback: DomRef = element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
		return callback
	}

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

	reconcile(opts?: {isUserSelecting?: boolean}): void {
		this.#indexer.reconcile(opts)
	}

	locateNode(node: Node): NodeLocationResult {
		return this.#indexer.locateNode(node)
	}

	placeAt(rawPosition: number, affinity: 'before' | 'after' = 'after'): Result<{applied: number}, 'notIndexed' | 'invalidBoundary'> {
		return this.#caret.placeAt(rawPosition, affinity)
	}

	placeRange(range: Range): Result<{applied: Range}, 'notIndexed' | 'invalidBoundary'> {
		return this.#caret.placeRange(range)
	}

	focusAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): Result<void, 'notIndexed' | 'stale'> {
		return this.#caret.focusAddress(address, boundary)
	}

	rawPositionFromBoundary(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): BoundaryPositionResult {
		return this.#boundary.fromBoundary(node, offset, affinity)
	}

	readRawSelection(): RawSelectionResult {
		return this.#boundary.readSelection()
	}
}
```

- [ ] **Step 3: Run the test suite**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

- [ ] **Step 4: Verify final file sizes**

Run:
```bash
wc -l packages/core/src/features/dom/*.ts
```

Expected approximate sizes:
- `DomModel.ts` ~145 lines
- `DomIndexer.ts` ~320 lines
- `DomBoundary.ts` ~165 lines
- `DomCaretPlacer.ts` ~180 lines
- `textOffsets.ts` ~75 lines
- `isTextTokenSpan.ts` (unchanged)

Total dom feature code: ~885 lines across 6 files, down from one 829-line file. The total goes up slightly because every file now carries its own import block — that's the cost paid for one-concept-per-file.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/dom/DomCaretPlacer.ts packages/core/src/features/dom/DomModel.ts
git commit -m "refactor(dom): extract DomCaretPlacer from DomModel"
```

---

## Task 6: Update `dom/README.md`

Refresh the feature README to describe the new layout. The behavior description is still correct; only the "Components" section needs updating to reflect file responsibilities.

**Files:**
- Modify: `packages/core/src/features/dom/README.md`

- [ ] **Step 1: Replace the README contents**

Replace the contents of `packages/core/src/features/dom/README.md` with:

```markdown
# DOM Feature

Owns rendered DOM structure, token-to-element indexing, raw boundary mapping, text reconciliation, focus-by-address, and caret range placement.

## Layout

- `DomModel.ts` — public facade exposed as `store.dom`. Owns `container`, ref registries (`controlFor` / `childrenFor`), composition flags, the click-on-empty listener, and the `index` / `indexed` / `diagnostics` / `readOnly` surface. Composes the three collaborators below and delegates the imperative methods to them.
- `DomIndexer.ts` — rebuilds the token-to-element index after `lifecycle.rendered`, keeps `#pathElements` / `#elementRoles` in sync, and reconciles structural text surfaces (text content + `contentEditable`) when `props.readOnly` changes or selection mode toggles.
- `DomBoundary.ts` — converts DOM `(node, offset)` boundaries and the current browser selection into raw value positions. Used by the value pipeline and keyboard handlers.
- `DomCaretPlacer.ts` — places carets and ranges back into the DOM from raw positions or token addresses (`placeAt`, `placeRange`, `focusAddress`). Out-of-bounds inputs are clamped; placements that cannot resolve return `invalidBoundary` and the caller is expected to surface that.
- `textOffsets.ts` — pure helpers for walking text content (`textOffsetWithin`, `textLength`, `splitsSurrogatePair`, `hasEditableAncestorBefore`, etc.).

## Registration

React/Vue register the root through `store.dom.container` and block controls through `store.dom.controlFor()`. Mark child slots use `store.dom.childrenFor()`.

## Indexing

The index is built after `lifecycle.rendered()` from direct rendered token roots. Out-of-shape DOM trees produce `dom.diagnostics` events (`ambiguousStructure`, `stalePath`, `missingContainer`, etc.) rather than throwing.

## Notes

Production code must not infer token identity from public data attributes or user refs.
```

- [ ] **Step 2: Run the test suite (still green)**

Run:
```bash
pnpm --filter @markput/core test --run
```

Expected: `Test Files 30 passed (30) | Tests 569 passed | 1 todo (570)`.

- [ ] **Step 3: Build the consumer packages to verify type exports are intact**

Run:
```bash
pnpm --filter @markput/react build && pnpm --filter @markput/vue build
```

Expected: both succeed with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/features/dom/README.md
git commit -m "docs(dom): refresh README for DomModel split"
```

---

## Self-Review

**Spec coverage:**
- Target structure (file list) → Tasks 1, 2, 3, 4, 5 create each listed file.
- DomModel public facade with composition + delegation → Task 5 final form.
- DomIndexer responsibilities → Task 3.
- DomBoundary responsibilities → Task 4.
- DomCaretPlacer responsibilities → Task 5.
- textOffsets.ts responsibilities → Task 2.
- 8 import sites updated → Task 1, Steps 5–11.
- Spec file renamed and describe-block updated → Task 1, Steps 2 and 12.
- README refreshed → Task 6.
- Test gate: 569 passed, 1 todo → every task's verification step.

**Placeholder scan:** No "TBD", "TODO", "implement later", or "similar to Task N" placeholders. Every code-changing step has full code or a verbatim find/replace instruction.

**Type consistency:**
- `DomIndexerHost`, `DomBoundaryHost`, `DomCaretHost` interfaces are declared in their respective task and consumed identically in the `DomModel` constructor in Task 5 (re-declared then for clarity, not re-defined elsewhere).
- `pathElements()` returns `IterableIterator<PathElements>` consistently across `DomIndexer` and the consumer hosts.
- `pathElementsFor(address)` takes a `TokenAddress` and returns `PathElements | undefined` in both `DomIndexer` and the host interfaces.
- `roleFor(element)` returns `RegisteredRole | undefined`.

**Risk note for executor:** Task 3 is the largest single step (creates DomIndexer + rewrites DomModel in one commit). If it fails partway, the model file is left in an inconsistent state. Recommend executor re-reads the entire Task 3 before starting and runs the test suite immediately after Step 2 even before committing.
