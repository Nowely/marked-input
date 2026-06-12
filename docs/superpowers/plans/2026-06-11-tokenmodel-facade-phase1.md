# TokenModel Facade (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement Phase 1 (sub-phases 1a/1b/1c) of `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md` — a hybrid TokenHandle + facade API on TokenModel backed by the current engine, migrate every consumer off raw DOM code, then delete the old surface.

**Architecture:** Raw DOM APIs (Range, Selection, TreeWalker, textContent writes) become legal only inside `packages/core/src/features/tokens/`. `caretDom.ts`/`textOffsets.ts` move into tokens as internal helpers; `SelectionController`'s boundary parsing moves into a `boundary.ts` module behind `TokenModel.boundaryFor`; consumers (selection, keyboard, overlay, clipboard) speak handles, addresses, and raw positions only.

**Tech Stack:** TypeScript, custom signals (`shared/signals`: `signal`/`computed`/`event`/`watch`), vitest in real-Chromium browser mode (`pnpm -F core test` from repo root — real Selection API available in specs).

**Facade additions beyond the spec sketch:** the spec's hard rule ("Selection API only inside tokens") forces a few facade methods the spec's API sketch didn't list: `readSelection()`, `selectedContent()`, `selectionRect()`, `selectionAnchor()`, `reconcileSurfaces()`. Each maps 1:1 to an existing consumer mechanic being absorbed. Handle methods `caretIndex()`, `caretOnFirstLine()`, `caretOnLastLine()`, `placeCaretAtX()`, `hasTextSurface()` absorb `caretDom` usage from `blockEdit.ts`/`arrowNav.ts`. These are Phase 1 surface; the spec remains authority for Phases 2–3.

**Conventions for this plan:**
- All commands run from the repo root `/Users/ruliny/Git/marked-input`.
- Test all: `pnpm -F core test` (runs `vitest run --project core` in headless Chromium).
- Test one file: `pnpm -w exec vitest run --project core <name-fragment>` (e.g. `TokenHandle`).
- Match the existing code style exactly: tabs for indentation, single quotes, no semicolons (see any file under `packages/core/src` for reference).
- Commit after every task; messages follow `refactor(tokens): ...` / `test(tokens): ...` conventional style seen in `git log`.

---

## Sub-phase 1a — facade + handles alongside the old API

### Task 1: Move `textOffsets.ts` and `caretDom.ts` into tokens

Pure file moves. No behavior change; the whole suite is the gate.

**Files:**
- Move: `packages/core/src/features/selection/textOffsets.ts` → `packages/core/src/features/tokens/textOffsets.ts`
- Move: `packages/core/src/features/selection/caretDom.ts` → `packages/core/src/features/tokens/caret.ts`
- Move: `packages/core/src/features/selection/caretDom.spec.ts` → `packages/core/src/features/tokens/caret.spec.ts`
- Modify: `packages/core/src/features/selection/SelectionController.ts:13-14`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts:11`
- Modify: `packages/core/src/features/overlay/OverlayController.ts:7`

- [x] **Step 1: Move the files with git mv**

```bash
git mv packages/core/src/features/selection/textOffsets.ts packages/core/src/features/tokens/textOffsets.ts
git mv packages/core/src/features/selection/caretDom.ts packages/core/src/features/tokens/caret.ts
git mv packages/core/src/features/selection/caretDom.spec.ts packages/core/src/features/tokens/caret.spec.ts
```

File contents are unchanged. The `'../../shared/checkers'` import inside both files stays valid (same directory depth).

- [x] **Step 2: Update the three importers**

In `packages/core/src/features/selection/SelectionController.ts` replace lines 13–14:

```ts
import {focusIfNeeded, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from '../tokens/caret'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from '../tokens/textOffsets'
```

In `packages/core/src/features/keyboard/blockEdit.ts` replace line 11:

```ts
import * as caretDom from '../tokens/caret'
```

In `packages/core/src/features/overlay/OverlayController.ts` replace line 7:

```ts
import * as caretDom from '../tokens/caret'
```

- [x] **Step 3: Fix the moved spec's import**

In `packages/core/src/features/tokens/caret.spec.ts`, change any `from './caretDom'` import to `from './caret'`.

- [x] **Step 4: Run the full suite**

Run: `pnpm -F core test`
Expected: all green (move only).

- [x] **Step 5: Commit**

```bash
git add -A packages/core
git commit -m "refactor(tokens): move caret and text-offset DOM helpers into tokens module"
```

---

### Task 2: TokenHandle + registry + handle lookups

TDD. Handles are path-keyed live objects cached by TokenModel; `handleFor`/`handleAt`/`handles` are the new lookups.

**Files:**
- Create: `packages/core/src/features/tokens/TokenHandle.ts`
- Create: `packages/core/src/features/tokens/TokenHandle.spec.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.ts`
- Modify: `packages/core/src/features/tokens/index.ts`

- [x] **Step 1: Write the failing spec**

Create `packages/core/src/features/tokens/TokenHandle.spec.ts`:

```ts
import {describe, expect, it, vi} from 'vitest'

import {watch} from '../../shared/signals/index.js'
import {Store} from '../../store/Store'

function mountInline(value: string) {
	const store = new Store()
	store.props.set({defaultValue: value})
	const container = document.createElement('div')
	const span = document.createElement('span')
	container.append(span)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container, span}
}

describe('TokenHandle', () => {
	it('handleAt resolves a token element to a live handle', () => {
		const {store, container, span} = mountInline('hello')

		const handle = store.tokens.handleAt(span)
		expect(handle).not.toBe('control')
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.element()).toBe(span)
		expect(handle.text()).toBe('hello')
		expect(handle.token().type).toBe('text')
		expect(handle.dead()).toBe(false)
		container.remove()
	})

	it('returns the same handle for the same path across commits', () => {
		const {store, container, span} = mountInline('hello')

		const first = store.tokens.handleAt(span)
		store.host.rendered()
		const second = store.tokens.handleAt(span)
		expect(second).toBe(first)
		container.remove()
	})

	it('handleFor resolves by address, handles() iterates all', () => {
		const {store, container} = mountInline('hello')

		const address = store.tokens.index().addressFor([0])
		if (!address) throw new Error('expected address')
		const handle = store.tokens.handleFor(address)
		expect(handle?.address().path).toEqual([0])
		expect([...store.tokens.handles()]).toHaveLength(1)
		container.remove()
	})

	it('fires text change and refreshes snapshots on value edit', () => {
		const {store, container, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')

		const onChange = vi.fn()
		watch(handle.changed, onChange)

		store.value.current('hello!')
		span.textContent = 'hello!'
		store.host.rendered()

		expect(onChange).toHaveBeenCalledWith({kind: 'text', previous: 'hello'})
		expect(handle.text()).toBe('hello!')
		container.remove()
	})

	it('kills handles whose token disappears (dead-handle contract)', () => {
		const store = new Store()
		store.props.set({defaultValue: 'ab'})
		const container = document.createElement('div')
		const span = document.createElement('span')
		container.append(span)
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()

		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')
		const onChange = vi.fn()
		watch(handle.changed, onChange)
		const lastToken = handle.token()

		// Make the token disappear: empty the value and remove its element, then
		// re-render. NOTE for implementer: if inline layout keeps a single empty
		// text token alive (it does — see filterEmptyText, block-only), switch this
		// fixture to a block-layout mount instead. Copy the exact block mount
		// pattern from an existing spec (grep "isBlock\|layout" in
		// packages/core/src/**/*.spec.ts) rather than guessing the prop shape.
		store.value.current('')
		span.remove()
		store.host.rendered()

		expect(onChange).toHaveBeenCalledWith({kind: 'unmounted'})
		expect(handle.dead()).toBe(true)
		expect(handle.element()).toBeUndefined()
		expect(handle.token()).toBe(lastToken)
		expect(handle.placeCaret(0)).toBe(false)

		// never resurrected: a fresh lookup after re-adding yields a new handle
		container.remove()
	})

	it('handleAt returns "control" inside control elements and undefined outside', () => {
		const {store, container, span} = mountInline('hello')

		const control = document.createElement('button')
		container.append(control)
		store.tokens.control()(control)
		store.host.rendered()

		expect(store.tokens.handleAt(control)).toBe('control')
		expect(store.tokens.handleAt(document.body)).toBeUndefined()
		expect(store.tokens.handleAt(span)).not.toBeUndefined()
		container.remove()
	})
})
```

- [x] **Step 2: Run the spec to verify it fails**

Run: `pnpm -w exec vitest run --project core TokenHandle`
Expected: FAIL — `handleAt is not a function`.

- [x] **Step 3: Implement TokenHandle**

Create `packages/core/src/features/tokens/TokenHandle.ts`:

```ts
import type {TokenAddress} from '../../shared/editorContracts'
import {computed, event, signal} from '../../shared/signals/index.js'
import type {Computed, Event, Signal} from '../../shared/signals/index.js'
import {
	focusIfNeeded,
	getCaretIndex,
	isOnFirstLine,
	isOnLastLine,
	placeAtChildBoundary,
	placeAtTextOffset,
	setAtX,
} from './caret'
import type {TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {textLength} from './textOffsets'

export type TokenChange =
	| {kind: 'text'; previous: string}
	| {kind: 'moved'; previousAddress: TokenAddress}
	| {kind: 'mounted'} // reserved for Phase 3 (not emitted in Phase 1)
	| {kind: 'unmounted'}

/** Internal view of TokenModel state a handle reads through. */
export type HandleHost = {
	/** Reactive read; bumped after every DOM commit. */
	version(): number
	nodeByKey(key: string): TokenNode | undefined
}

/**
 * Live, path-keyed view of one token: reactive getters over the parsed token
 * and its indexed DOM, plus caret commands scoped to it. Created and synced by
 * TokenModel; survives commits while a token exists at its path, then dies
 * (stale reads never throw, commands become no-ops, never resurrected).
 */
export class TokenHandle {
	readonly changed: Event<TokenChange> = event<TokenChange>()

	readonly #dead: Signal<boolean> = signal({initial: false})
	readonly dead: Computed<boolean> = computed(() => this.#dead())

	#lastToken: Token
	#lastAddress: TokenAddress

	readonly token: Computed<Token> = computed(() => {
		this.host.version()
		return this.#lastToken
	})

	readonly address: Computed<TokenAddress> = computed(() => {
		this.host.version()
		return this.#lastAddress
	})

	readonly element: Computed<HTMLElement | undefined> = computed(() => this.#node()?.tokenElement)

	readonly text: Computed<string> = computed(() => this.token().content)

	constructor(
		private readonly key: string,
		private readonly host: HandleHost,
		token: Token,
		address: TokenAddress
	) {
		this.#lastToken = token
		this.#lastAddress = address
	}

	#node(): TokenNode | undefined {
		if (this.#dead()) return undefined
		this.host.version()
		return this.host.nodeByKey(this.key)
	}

	/** Row in block layout, else the text surface / token root. */
	#measureScope(): HTMLElement | undefined {
		const node = this.#node()
		if (!node) return undefined
		return node.rowElement ?? node.textElement ?? node.tokenElement
	}

	hasTextSurface(): boolean {
		return this.#node()?.textElement != null
	}

	textLength(): number {
		const scope = this.#measureScope()
		return scope ? textLength(scope) : 0
	}

	/** Caret offset within this token's scope, or undefined when unmounted. */
	caretIndex(): number | undefined {
		const scope = this.#measureScope()
		return scope ? getCaretIndex(scope) : undefined
	}

	caretRect(offset: number): DOMRect | undefined {
		const node = this.#node()
		const surface = node?.textElement
		if (!surface) return undefined
		const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT)
		let remaining = Math.max(0, offset)
		for (let text = walker.nextNode(); text instanceof Text; text = walker.nextNode()) {
			if (remaining <= text.length) {
				const range = document.createRange()
				range.setStart(text, remaining)
				range.collapse(true)
				return range.getBoundingClientRect()
			}
			remaining -= text.length
		}
		return undefined
	}

	caretOnFirstLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnFirstLine(scope) : true
	}

	caretOnLastLine(): boolean {
		const scope = this.#measureScope()
		return scope ? isOnLastLine(scope) : true
	}

	/** Place a collapsed caret at a character offset (Infinity → end). */
	placeCaret(offset: number): boolean {
		const node = this.#node()
		if (!node) return false
		if (!node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, offset <= 0 ? 'start' : 'end')
			return true
		}
		focusIfNeeded(node.textElement)
		const length = textLength(node.textElement)
		placeAtTextOffset(node.textElement, Number.isFinite(offset) ? Math.max(0, Math.min(offset, length)) : length)
		return true
	}

	placeCaretAtBoundary(side: 'start' | 'end'): boolean {
		const node = this.#node()
		if (!node) return false
		if (!node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, side)
			return true
		}
		return this.placeCaret(side === 'start' ? 0 : Infinity)
	}

	/** Place caret at viewport x (and optional y) within this token's scope. */
	placeCaretAtX(x: number, y?: number): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		setAtX(scope, x, y)
		return true
	}

	/** Focus this token's scope element (row in block layout). */
	focus(): boolean {
		const scope = this.#measureScope()
		if (!scope) return false
		focusIfNeeded(scope)
		return true
	}

	/** @internal Called by TokenModel after each commit. */
	sync(node: TokenNode, token: Token | undefined): void {
		if (!token) return
		const prevToken = this.#lastToken
		const prevAddress = this.#lastAddress
		this.#lastToken = token
		this.#lastAddress = node.address
		if (token.content !== prevToken.content) {
			this.changed({kind: 'text', previous: prevToken.content})
		} else if (token.position.start !== prevToken.position.start) {
			this.changed({kind: 'moved', previousAddress: prevAddress})
		}
	}

	/** @internal Called by TokenModel when the token disappears. */
	kill(): void {
		if (this.#dead()) return
		this.#dead(true)
		this.changed({kind: 'unmounted'})
	}
}
```

Note: `caretRect` uses TreeWalker directly rather than `findTextBoundary` because the latter is non-exported and creates DOM (an empty Text node) as a side effect — wrong for a measurement.

- [x] **Step 4: Wire the registry into TokenModel**

In `packages/core/src/features/tokens/TokenModel.ts`:

Add imports:

```ts
import {TokenHandle} from './TokenHandle'
import type {HandleHost} from './TokenHandle'
import {signal} from '../../shared/signals/index.js'   // merge into the existing signals import
import type {Signal} from '../../shared/signals/index.js'
```

Add fields (next to the existing DOM-index fields):

```ts
	// Handle registry — path-keyed live token objects.
	readonly #handles = new Map<string, TokenHandle>()
	readonly #domVersion: Signal<number> = signal({initial: 0})
	readonly #handleHost: HandleHost = {
		version: () => this.#domVersion(),
		nodeByKey: key => this.#byPath.get(key),
	}
```

Add public lookups:

```ts
	handleFor(address: TokenAddress): TokenHandle | undefined {
		const node = this.#byPath.get(pathKey(address.path))
		return node ? this.#ensureHandle(node) : undefined
	}

	handleAt(node: Node): TokenHandle | 'control' | undefined {
		const lookup = this.locate(node)
		if (!lookup) return undefined
		if (lookup.kind === 'control') return 'control'
		return this.#ensureHandle(lookup.node)
	}

	*handles(): IterableIterator<TokenHandle> {
		for (const node of this.#byPath.values()) yield this.#ensureHandle(node)
	}

	#ensureHandle(node: TokenNode): TokenHandle {
		const key = pathKey(node.path)
		const existing = this.#handles.get(key)
		if (existing) return existing
		const token = this.index().resolveAddress(node.address) ?? node.address.token
		const handle = new TokenHandle(key, this.#handleHost, token, node.address)
		this.#handles.set(key, handle)
		return handle
	}
```

At the end of `#commit()` (inside the `try`, after `this.#controlRoots = result.controlRoots` and before `this.indexed()`):

```ts
			this.#syncHandles()
			this.#domVersion(this.#domVersion() + 1)
```

And add the sync method:

```ts
	#syncHandles(): void {
		const tokenIndex = this.index()
		for (const [key, handle] of this.#handles) {
			const node = this.#byPath.get(key)
			if (!node) {
				this.#handles.delete(key)
				handle.kill()
				continue
			}
			handle.sync(node, tokenIndex.resolveAddress(node.address))
		}
	}
```

- [x] **Step 5: Export the handle types**

In `packages/core/src/features/tokens/index.ts` add:

```ts
export {TokenHandle} from './TokenHandle'
export type {TokenChange} from './TokenHandle'
```

- [x] **Step 6: Run the spec until green, then the full suite**

Run: `pnpm -w exec vitest run --project core TokenHandle`
Expected: PASS. If the dead-handle spec's mount choreography fights the block-layout filter, adjust the *spec* (the simplest valid mount that removes a token), not the registry.

Run: `pnpm -F core test`
Expected: all green.

- [x] **Step 7: Commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): TokenHandle registry with handleFor/handleAt/handles lookups"
```

---

### Task 3: boundary module + facade reads (`boundaryFor`, `tokenAt`, selection reads)

Move `SelectionController`'s boundary parsing into tokens **without changing SelectionController yet** (it keeps its own copy until Task 7 — the dual-run parity spec compares the two).

**Files:**
- Create: `packages/core/src/features/tokens/boundary.ts`
- Create: `packages/core/src/features/tokens/TokenModel.facade.spec.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.ts`

- [x] **Step 1: Create the boundary module**

Create `packages/core/src/features/tokens/boundary.ts` — the five helper functions at the bottom of `SelectionController.ts:324-406` moved verbatim with a context object replacing the `TokenModel` parameter (so 1c can privatize the lookups):

```ts
import type {TokenAddress} from '../../shared/editorContracts'
import type {Lookup, TokenNode} from './domTypes'
import type {Token} from './parser/types'
import {hasEditableAncestorBefore, textLength, textOffsetWithin} from './textOffsets'
import type {TokenIndex} from './tokenIndex'

export type BoundaryContext = {
	container: HTMLElement | undefined
	tokens: readonly Token[]
	index: TokenIndex
	locate(node: Node): Lookup | undefined
	nodeFor(address: TokenAddress): TokenNode | undefined
	nodes(): IterableIterator<TokenNode>
}

/** Map a DOM boundary (node, offset) to an absolute document position. */
export function rawPositionFromBoundary(
	ctx: BoundaryContext,
	node: Node,
	offset: number,
	affinity: 'before' | 'after' = 'after'
): number | undefined {
	if (ctx.container && node === ctx.container) {
		return fromContainerBoundary(ctx.tokens, offset, affinity)
	}

	const lookup = ctx.locate(node)
	if (lookup?.kind !== 'token') return undefined

	const token = ctx.index.resolveAddress(lookup.node.address)
	if (!token) return undefined

	if (node instanceof HTMLElement && node === lookup.node.childSequenceHost) {
		const childCount = node.childNodes.length
		if (offset <= 0) return token.position.start
		if (offset >= childCount) return token.position.end
		return fromTokenChildBoundary(ctx, node, offset, token, affinity)
	}

	const textElement = lookup.node.textElement
	if (textElement?.contains(node)) {
		const local = textOffsetWithin(textElement, node, offset)
		if (local === undefined) return undefined
		return token.position.start + local
	}

	if (node === lookup.node.tokenElement) {
		const childCount = lookup.node.tokenElement.childNodes.length
		if (offset <= 0) return token.position.start
		if (offset >= childCount) return token.position.end
		return fromTokenChildBoundary(ctx, lookup.node.tokenElement, offset, token, affinity)
	}

	if (token.type === 'mark' && lookup.node.tokenElement.contains(node)) {
		if (hasEditableAncestorBefore(node, lookup.node.tokenElement)) {
			return undefined
		}
		return affinity === 'after' ? token.position.start : token.position.end
	}

	if (lookup.node.rowElement && node === lookup.node.rowElement) {
		return offset <= 0 ? token.position.start : token.position.end
	}

	return undefined
}

function fromContainerBoundary(
	tokens: readonly Token[],
	offset: number,
	affinity: 'before' | 'after'
): number | undefined {
	if (tokens.length === 0) return 0
	if (offset <= 0) return tokens[0].position.start
	if (offset >= tokens.length) return tokens[tokens.length - 1].position.end

	const before = tokens[offset - 1]
	const after = tokens[offset]
	return affinity === 'before' ? before.position.end : after.position.start
}

function fromTokenChildBoundary(
	ctx: BoundaryContext,
	tokenElement: HTMLElement,
	offset: number,
	token: Token,
	affinity: 'before' | 'after'
): number | undefined {
	if (token.type === 'text') {
		const path = ctx.index.pathFor(token) ?? []
		const address = ctx.index.addressFor(path)
		const textElement = address ? ctx.nodeFor(address)?.textElement : undefined
		if (!textElement || textLength(textElement) === 0) return token.position.start
	}

	const before = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset - 1))
	const after = lookupTokenDescendant(ctx, tokenElement.childNodes.item(offset))
	if (before && after) {
		const beforeToken = ctx.index.resolveAddress(before.address)
		const afterToken = ctx.index.resolveAddress(after.address)
		if (beforeToken && afterToken) {
			return affinity === 'before' ? beforeToken.position.end : afterToken.position.start
		}
	}

	return affinity === 'before' ? token.position.start : token.position.end
}

function lookupTokenDescendant(ctx: BoundaryContext, node: Node | null): TokenNode | undefined {
	if (!node) return undefined
	const lookup = ctx.locate(node)
	return lookup?.kind === 'token' ? lookup.node : undefined
}

/** Text-token surface containing `rawPosition`, else the next one after it. */
export function textTargetAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'index'>,
	rawPosition: number
): {node: TokenNode; start: number; end: number} | undefined {
	const candidates: Array<{node: TokenNode; start: number; end: number}> = []
	for (const node of ctx.nodes()) {
		if (!node.textElement) continue
		const resolved = ctx.index.resolveAddress(node.address)
		if (resolved?.type !== 'text') continue
		candidates.push({node, start: resolved.position.start, end: resolved.position.end})
	}
	candidates.sort((a, b) => a.start - b.start)
	const containing = candidates.find(c => rawPosition >= c.start && rawPosition <= c.end)
	if (containing) return containing
	return candidates.find(c => c.start >= rawPosition)
}

/** Mark token whose start or end boundary sits exactly at `rawPosition`. */
export function markBoundaryAt(
	ctx: Pick<BoundaryContext, 'nodes' | 'index'>,
	rawPosition: number
): {element: HTMLElement; position: {start: number; end: number}} | undefined {
	for (const node of ctx.nodes()) {
		const resolved = ctx.index.resolveAddress(node.address)
		if (resolved?.type !== 'mark') continue
		if (rawPosition !== resolved.position.start && rawPosition !== resolved.position.end) continue
		return {element: node.tokenElement, position: resolved.position}
	}
	return undefined
}
```

- [x] **Step 2: Add the facade reads to TokenModel**

In `packages/core/src/features/tokens/TokenModel.ts` add imports:

```ts
import {markBoundaryAt, rawPositionFromBoundary, textTargetAt} from './boundary'
import type {BoundaryContext} from './boundary'
import {getRect} from './caret'
import {reconcileTextSurfaces} from './reconcileTextSurfaces'
import type {RawSelection} from '../../shared/editorContracts'   // merge into existing contracts import
```

Add methods:

```ts
	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.current(),
			index: this.index(),
			locate: node => this.locate(node),
			nodeFor: address => this.nodeFor(address),
			nodes: () => this.nodes(),
		}
	}

	/** Map a DOM boundary (node, offset) to an absolute document position. */
	boundaryFor(node: Node, offset: number, affinity: 'before' | 'after' = 'after'): number | undefined {
		return rawPositionFromBoundary(this.#boundaryContext(), node, offset, affinity)
	}

	/** Handle of the text token containing `position` (or the next one after). */
	tokenAt(position: number): TokenHandle | undefined {
		const target = textTargetAt(this.#boundaryContext(), position)
		return target ? this.#ensureHandle(target.node) : undefined
	}

	/** Current window selection as absolute positions. */
	readSelection(): RawSelection | undefined {
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return undefined

		const range = selection.getRangeAt(0)
		const start = this.boundaryFor(range.startContainer, range.startOffset, 'after')
		if (start === undefined) return undefined
		const end = this.boundaryFor(range.endContainer, range.endOffset, 'before')
		if (end === undefined) return undefined

		const rangeValue = start <= end ? {start, end} : {start: end, end: start}
		const direction =
			rangeValue.start === rangeValue.end
				? undefined
				: selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
					? 'backward'
					: 'forward'

		return direction ? {range: rangeValue, direction} : {range: rangeValue}
	}

	/** Current selection serialized for clipboard use. */
	selectedContent(): {html: string; text: string} | undefined {
		const sel = window.getSelection()
		const range = sel?.rangeCount ? sel.getRangeAt(0) : undefined
		if (!range) return undefined
		const fragment = range.cloneContents()
		const div = document.createElement('div')
		div.appendChild(fragment)
		return {html: div.innerHTML, text: range.toString()}
	}

	/** Viewport rect of the current caret/selection. */
	selectionRect(): DOMRect | undefined {
		return getRect() ?? undefined
	}

	/** Anchor node + offset of the current selection (overlay trigger probing). */
	selectionAnchor(): {node: Node; offset: number; isCollapsed: boolean} | undefined {
		const sel = window.getSelection()
		if (!sel?.anchorNode) return undefined
		return {node: sel.anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed}
	}

	/** Sync text surfaces' textContent/contentEditable and mark tabindex. */
	reconcileSurfaces(options: {editable: boolean; readOnly: boolean}): void {
		reconcileTextSurfaces(this.nodes(), this.index(), options)
	}
```

(`RawSelection`'s `direction` field is `'forward' | 'backward'` — the moved code is identical to `SelectionController.readRaw`, so types already line up.)

- [x] **Step 3: Write the dual-run parity spec**

Create `packages/core/src/features/tokens/TokenModel.facade.spec.ts`. It mounts realistic fixtures and asserts the facade equals the (still-present) old SelectionController implementation node-for-node:

```ts
import {describe, expect, it} from 'vitest'

import {Store} from '../../store/Store'

type Mounted = {store: Store; container: HTMLElement}

/** Inline fixture: [text "he", mark "@[x]", text "llo"] */
function mountWithMark(): Mounted {
	const store = new Store()
	store.props.set({
		defaultValue: 'he@[x]llo',
		options: [{markup: '@[__value__]'}],
		Mark: () => null,
	})
	const container = document.createElement('div')
	const text1 = document.createElement('span')
	const mark = document.createElement('span')
	mark.append(document.createTextNode('x'))
	const text2 = document.createElement('span')
	container.append(text1, mark, text2)
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

// NOTE for implementer: copy the exact block-layout mount pattern (props shape
// that makes store.props.layout.isBlock() true, row separator in the value)
// from an existing spec — grep "isBlock\|layout" in packages/core/src/**/*.spec.ts.
// The shape below shows the intended DOM (one row div per token, one span inside);
// the props.set call is a guess and must be corrected against a real spec.
function mountBlock(): Mounted {
	const store = new Store()
	store.props.set({defaultValue: 'one\ntwo', layout: 'block'})
	const container = document.createElement('div')
	for (let i = 0; i < 2; i++) {
		const row = document.createElement('div')
		const span = document.createElement('span')
		row.append(span)
		container.append(row)
	}
	document.body.append(container)
	store.host.container(container)
	store.host.rendered()
	return {store, container}
}

/** All (node, offset) probes worth checking in a container. */
function* probes(container: HTMLElement): Generator<[Node, number]> {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
	for (let node: Node | null = container; node; node = walker.nextNode()) {
		const max = node instanceof Text ? node.length : node.childNodes.length
		for (let offset = 0; offset <= max; offset++) yield [node, offset]
	}
}

describe('TokenModel facade parity (dual-run vs SelectionController)', () => {
	for (const [name, mount] of [
		['inline with mark', mountWithMark],
		['block layout', mountBlock],
	] as const) {
		it(`boundaryFor matches rawPositionFromBoundary — ${name}`, () => {
			const {store, container} = mount()
			for (const [node, offset] of probes(container)) {
				for (const affinity of ['before', 'after'] as const) {
					expect(store.tokens.boundaryFor(node, offset, affinity), `${node.nodeName}@${offset}/${affinity}`).toBe(
						store.selection.rawPositionFromBoundary(node, offset, affinity)
					)
				}
			}
			container.remove()
		})

		it(`readSelection matches readRaw — ${name}`, () => {
			const {store, container} = mount()
			const firstText = document.createTreeWalker(container, NodeFilter.SHOW_TEXT).nextNode()
			if (firstText instanceof Text && firstText.length > 0) {
				const sel = window.getSelection()
				const range = document.createRange()
				range.setStart(firstText, 0)
				range.setEnd(firstText, Math.min(1, firstText.length))
				sel?.removeAllRanges()
				sel?.addRange(range)
				expect(store.tokens.readSelection()).toEqual(store.selection.readRaw())
				expect(store.tokens.selectedContent()).toEqual(store.selection.readSelectedContent())
			}
			container.remove()
		})
	}

	it('tokenAt finds the containing text surface and the next one after a gap', () => {
		const {store, container} = mountWithMark()
		// value: he@[x]llo → text "he" [0,2], mark [2,8], text "llo" [8,11]
		expect(store.tokens.tokenAt(1)?.address().path).toEqual([0])
		expect(store.tokens.tokenAt(5)?.address().path).toEqual([0]) // inside mark: "he" ends at 2 ≤ 5? containing fails → next start ≥ 5 is "llo"
		expect(store.tokens.tokenAt(9)?.address().path).toEqual([2])
		container.remove()
	})
})
```

Note for the implementer: the `tokenAt(5)` expectation above documents *intent*; before finalizing, print the actual parsed positions (`store.tokens.current().map(t => t.position)`) and pin the assertions to the real parser output for `'he@[x]llo'` with markup `'@[__value__]'`. The invariant being tested: containing-surface first, else next surface by start position — identical to old `findTextTargetAt`. Same for the fixture DOM shape: mirror what `packages/core/src/features/tokens/TokenModel.index.spec.ts` and `SelectionController.spec.ts` do for mark fixtures (they are the source of truth for adapter-shaped DOM).

- [x] **Step 4: Run facade spec, then full suite**

Run: `pnpm -w exec vitest run --project core facade`
Expected: PASS (fix fixture shapes against existing spec patterns if buildIndex bails — symptom: `boundaryFor` returns undefined everywhere because `byPath` is empty).

Run: `pnpm -F core test`
Expected: all green.

- [x] **Step 5: Commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): boundary module and facade reads with dual-run parity specs"
```

---

### Task 4: placement commands (`placeCaret`, `selectRange`, `caretFromPoint`)

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.facade.spec.ts`

- [x] **Step 1: Write the failing specs**

Append to `TokenModel.facade.spec.ts`:

```ts
describe('TokenModel placement commands', () => {
	it('placeCaret(raw) places inside the right surface; readSelection round-trips', () => {
		const {store, container} = mountWithMark()
		expect(store.tokens.placeCaret(1)).toBe(true)
		expect(store.tokens.readSelection()?.range).toEqual({start: 1, end: 1})
		container.remove()
	})

	it('placeCaret at a mark boundary collapses at the mark edge', () => {
		const {store, container} = mountWithMark()
		const mark = store.tokens.current().find(t => t.type === 'mark')
		if (!mark) throw new Error('expected mark')
		expect(store.tokens.placeCaret(mark.position.end)).toBe(true)
		expect(store.tokens.readSelection()?.range.start).toBe(mark.position.end)
		container.remove()
	})

	it('placeCaret({address, offset}) targets the addressed token explicitly', () => {
		const {store, container} = mountWithMark()
		const address = store.tokens.index().addressFor([2])
		if (!address) throw new Error('expected address')
		expect(store.tokens.placeCaret({address, offset: 1})).toBe(true)
		expect(store.tokens.readSelection()?.range.start).toBe(address.token.position.start + 1)
		container.remove()
	})

	it('selectRange spans two text surfaces', () => {
		const {store, container} = mountWithMark()
		const last = store.tokens.current().at(-1)
		if (!last) throw new Error('expected tokens')
		expect(store.tokens.selectRange(0, last.position.end)).toBe(true)
		const read = store.tokens.readSelection()
		expect(read?.range).toEqual({start: 0, end: last.position.end})
		container.remove()
	})

	it('handle.placeCaret + handle.caretIndex round-trip', () => {
		const {store, container} = mountWithMark()
		const handle = store.tokens.tokenAt(0)
		if (!handle) throw new Error('expected handle')
		expect(handle.placeCaret(2)).toBe(true)
		expect(handle.caretIndex()).toBe(2)
		expect(handle.textLength()).toBe(handle.text().length)
		container.remove()
	})
})
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm -w exec vitest run --project core facade`
Expected: FAIL — `placeCaret is not a function`.

- [x] **Step 3: Implement on TokenModel**

Add imports from `./caret`:

```ts
import {focusIfNeeded, getRect, placeAtChildBoundary, placeAtTextOffset, placeRangeAcrossSurfaces} from './caret'
```

Add methods:

```ts
	/**
	 * Place a collapsed caret. Number form resolves the best target (text
	 * surface containing the position, else a mark boundary exactly there);
	 * address form targets a specific token (callers use it to disambiguate
	 * tokens sharing a boundary position).
	 */
	placeCaret(target: number | {address: TokenAddress; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		const node = this.nodeFor(target.address)
		const resolved = this.index().resolveAddress(target.address)
		if (!node || !resolved) return false

		if (resolved.type === 'mark' && !node.textElement) {
			focusIfNeeded(node.tokenElement)
			placeAtChildBoundary(node.tokenElement, target.offset <= 0 ? 'start' : 'end')
			return true
		}

		const surface = node.textElement ?? node.tokenElement
		focusIfNeeded(surface)
		if (node.textElement) placeAtTextOffset(node.textElement, target.offset)
		return true
	}

	#placeAtRawPosition(rawPosition: number): boolean {
		const ctx = this.#boundaryContext()

		const textTarget = textTargetAt(ctx, rawPosition)
		if (textTarget?.node.textElement && rawPosition >= textTarget.start && rawPosition <= textTarget.end) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		const markTarget = markBoundaryAt(ctx, rawPosition)
		if (markTarget) {
			focusIfNeeded(markTarget.element)
			placeAtChildBoundary(markTarget.element, rawPosition === markTarget.position.end ? 'end' : 'start')
			return true
		}

		if (textTarget?.node.textElement) {
			focusIfNeeded(textTarget.node.textElement)
			placeAtTextOffset(textTarget.node.textElement, rawPosition - textTarget.start)
			return true
		}

		return false
	}

	/** Select [start, end]; collapses via placeCaret when equal. */
	selectRange(start: number, end: number): boolean {
		if (start === end) return this.placeCaret(start)
		const ctx = this.#boundaryContext()
		const startTarget = textTargetAt(ctx, start)
		const endTarget = textTargetAt(ctx, end)
		if (!startTarget?.node.textElement || !endTarget?.node.textElement) return false
		placeRangeAcrossSurfaces(
			{element: startTarget.node.textElement, offset: start - startTarget.start},
			{element: endTarget.node.textElement, offset: end - endTarget.start}
		)
		return true
	}

	/** Absolute position at viewport coordinates (read half of old setAtX). */
	caretFromPoint(x: number, y: number): number | undefined {
		const doc = document as unknown as {
			caretRangeFromPoint?(x: number, y: number): globalThis.Range | null
			caretPositionFromPoint?(x: number, y: number): {offsetNode: Node; offset: number} | null
		}
		const pos = doc.caretRangeFromPoint?.(x, y) ?? doc.caretPositionFromPoint?.(x, y)
		if (!pos) return undefined
		if (pos instanceof globalThis.Range) return this.boundaryFor(pos.startContainer, pos.startOffset)
		return this.boundaryFor(pos.offsetNode, pos.offset)
	}
```

**Ordering note:** `#placeAtRawPosition` differs from the old `#placeCollapsed` in one deliberate way — the old code tried any `textTargetAt` result first (including "next surface after a gap") *before* mark boundaries; this version prefers a *containing* text surface, then an exact mark boundary, then the next-surface fallback. At positions exactly on a text↔mark boundary the containing text surface still wins (old behavior preserved: `findTextTargetAt` used `position >= start && <= end` inclusive). Existing SelectionController placement specs are the gate — if any disagree, match old behavior exactly and drop this refinement.

- [x] **Step 4: Run facade spec + full suite**

Run: `pnpm -w exec vitest run --project core facade` → PASS
Run: `pnpm -F core test` → all green

- [x] **Step 5: Commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): placement commands placeCaret/selectRange/caretFromPoint on TokenModel"
```

---

## Sub-phase 1b — consumer migration (one consumer per commit)

### Task 5: migrate `inputRange.ts`

**Files:**
- Modify: `packages/core/src/features/keyboard/inputRange.ts`

- [x] **Step 1: Switch to the facade**

Replace the file body (keep `RawSelection` import):

```ts
import type {RawSelection} from '../../shared/editorContracts'
import type {Store} from '../../store/Store'

type KbCtx = Pick<Store, 'selection' | 'tokens'>

type InputTargetRange = {
	readonly startContainer: Node
	readonly startOffset: number
	readonly endContainer: Node
	readonly endOffset: number
}

export function rawRangeFromInputEvent(store: KbCtx, event: InputEvent): RawSelection | undefined {
	const ranges = event.getTargetRanges()
	if (ranges.length === 0) return store.selection.readRaw()
	return rawRangeFromTargetRange(store, ranges[0])
}

function rawRangeFromTargetRange(store: KbCtx, range: InputTargetRange): RawSelection | undefined {
	const start = store.tokens.boundaryFor(range.startContainer, range.startOffset, 'after')
	if (start === undefined) return undefined
	const end = store.tokens.boundaryFor(range.endContainer, range.endOffset, 'before')
	if (end === undefined) return undefined
	return {
		range: start <= end ? {start, end} : {start: end, end: start},
	}
}
```

Check the two call sites (`blockEdit.ts`, and grep `rawRangeFromInputEvent` for others) — their `KbCtx` picks must include `'tokens'`; `blockEdit.ts`'s already does.

- [x] **Step 2: Test + commit**

Run: `pnpm -F core test` → all green

```bash
git add -A packages/core
git commit -m "refactor(keyboard): inputRange reads boundaries via tokens.boundaryFor"
```

---

### Task 6: migrate `TriggerFinder` + `OverlayController`

**Files:**
- Modify: `packages/core/src/features/overlay/TriggerFinder.ts`
- Modify: `packages/core/src/features/overlay/OverlayController.ts`
- Modify: `packages/core/src/features/overlay/TriggerFinder.spec.ts` (constructor arg type if it stubs selection)

- [x] **Step 1: TriggerFinder takes TokenModel**

In `TriggerFinder.ts`: replace the `SelectionController` import with `import type {TokenModel} from '../tokens/TokenModel'`, and change the constructor + the two selection touchpoints:

```ts
	constructor(private readonly tokens?: TokenModel) {
		const anchor = tokens?.selectionAnchor() ?? fallbackAnchor()
		if (!anchor || !document.contains(anchor.node)) throw new Error('Anchor node of selection is not exists!')
		this.node = anchor.node
		this.span = anchor.node.textContent ?? ''
		this.dividedText = this.getDividedTextBy(anchor.offset)
	}

	static find<T>(
		options: T[] | undefined,
		getTrigger: TriggerExtractor<T>,
		tokens?: TokenModel
	): OverlayMatch<T> | undefined {
		if (!options) return
		if (!(tokens?.selectionAnchor() ?? fallbackAnchor())?.isCollapsed) return
		try {
			return new TriggerFinder(tokens).find(options, getTrigger)
		} catch {
			return undefined
		}
	}
```

```ts
	#rawRangeForMatch(source: string, index: number) {
		if (!this.tokens) return {start: index, end: index + source.length}
		const boundary = this.tokens.boundaryFor(this.node, index + source.length, 'after')
		if (boundary === undefined) return undefined
		return {start: boundary - source.length, end: boundary}
	}
```

`fallbackAnchor()` keeps the tokens-less unit-test path working (TriggerFinder.spec.ts constructs it without a store):

```ts
function fallbackAnchor(): {node: Node; offset: number; isCollapsed: boolean} | undefined {
	const sel = window.getSelection()
	if (!sel?.anchorNode) return undefined
	return {node: sel.anchorNode, offset: sel.anchorOffset, isCollapsed: sel.isCollapsed}
}
```

(The fallback is deleted in 1c if `TriggerFinder.spec.ts` can pass a real store; if it can't cheaply, keep the fallback — it reads, never writes, and lives behind the facade in spirit. Flag it in the 1c task.)

- [x] **Step 2: OverlayController drops caretDom**

In `OverlayController.ts`: delete the `import * as caretDom from '../tokens/caret'` line, change `position` to use the facade, and pass tokens to TriggerFinder:

```ts
	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = this.tokens.selectionRect()
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})
```

At line ~124: `TriggerFinder.find(this.props.options(), option => option.overlay?.trigger, this.tokens) ?? ...`

- [x] **Step 3: Test + commit**

Run: `pnpm -F core test` → all green (TriggerFinder.spec.ts exercises the fallback path; OverlayController specs the facade path)

```bash
git add -A packages/core
git commit -m "refactor(overlay): TriggerFinder and overlay positioning read through tokens facade"
```

---

### Task 7: migrate `SelectionController` (+ ClipboardController's one line)

The big shrink: SelectionController keeps policy (range signal, preferred address, clamping, focus/user-selecting tracking) and delegates all mechanics.

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts`
- Modify: `packages/core/src/features/clipboard/ClipboardController.ts:34`
- Modify: `packages/core/src/features/selection/SelectionController.spec.ts`

- [x] **Step 1: Replace mechanics with facade calls**

In `SelectionController.ts`:

1. Imports — remove lines 10–14 (`reconcileTextSurfaces`/`TokenNode` import, `TokenIndex` import, `caret` import, `textOffsets` import). Keep `Token` only if still referenced (it isn't after step 4). Keep `TokenModel` type import.

2. `#reconcileSurfaces` becomes:

```ts
	#reconcileSurfaces(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.isUserSelecting())
		this.tokens.reconcileSurfaces({editable, readOnly})
	}
```

3. `readRaw` becomes a policy-level delegate; `rawPositionFromBoundary` and `readSelectedContent` are **deleted** (their callers were migrated in Tasks 5–6; clipboard is updated in Step 2):

```ts
	readRaw(): RawSelection | undefined {
		return this.tokens.readSelection()
	}
```

4. Placement internals — replace `#applyPreferredAddress`, `#placeCollapsed`, `#placeExtended`:

```ts
	#applyPreferredAddress(rawPosition: number): boolean {
		const address = this.#preferredAddress
		this.#preferredAddress = undefined
		if (!address) return false
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved) return false
		return this.tokens.placeCaret({address, offset: rawPosition - resolved.position.start})
	}

	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredAddress(rawPosition)) return true
		return this.tokens.placeCaret(rawPosition)
	}

	#placeExtended(range: Range): boolean {
		return this.tokens.selectRange(range.start, range.end)
	}
```

(Behavior note: old `#applyPreferredAddress` placed mark boundaries via `rawPosition === position.end ? 'end' : 'start'`; the address form of `placeCaret` uses `offset <= 0 ? 'start' : 'end'`. Equivalent here because `#resolveAddress` only ever produces rawPosition exactly at the token's start or end. `#resolveAddress` also keeps its `nodeFor` guard — see next point.)

5. `#resolveAddress` — replace the `nodeFor` mount-check with a handle check:

```ts
	#resolveAddress(address: TokenAddress, boundary: 'start' | 'end'): Range | undefined {
		if (!this.tokens.handleFor(address)) return undefined
		const resolved = this.tokens.index().resolveAddress(address)
		if (!resolved) return undefined
		const pos = boundary === 'end' ? resolved.position.end : resolved.position.start
		this.#preferredAddress = address
		return {start: pos, end: pos}
	}
```

6. `#trackSelection`'s `syncIfInEditor` — replace `locate`:

```ts
		const syncIfInEditor = (node: Node): void => {
			const at = this.tokens.handleAt(node)
			if (at && at !== 'control') {
				sync()
				return
			}
			if (at === 'control') return
			this.range(undefined)
		}
```

7. Delete the six module-level helper functions at the bottom of the file (`fromContainerBoundary`, `fromTokenChildBoundary`, `lookupTokenDescendant`, `findTextTargetAt`, `findMarkBoundaryAt`, `placeAtMarkBoundary`) — they live in `tokens/boundary.ts` / `TokenModel` now.

- [x] **Step 2: ClipboardController**

At `ClipboardController.ts:34` replace `this.selection.readSelectedContent()` with `this.tokens.selectedContent()` (the class already receives... **verify**: if `ClipboardController` has no `tokens` member, add it to the constructor where `Store` wires it — check `packages/core/src/store/Store.ts` for the construction site and pass `this.tokens`).

- [x] **Step 3: Update SelectionController.spec.ts**

The `rawPositionFromBoundary` assertions (lines ~348–387) move to the facade: replace `store.selection.rawPositionFromBoundary(` with `store.tokens.boundaryFor(` throughout the spec. `readRaw` assertions stay as-is (the delegate keeps the API). If the spec imports moved caret helpers, point them at `../tokens/caret`.

- [x] **Step 4: Remove the dual-run parity spec's old-API side**

`TokenModel.facade.spec.ts` still calls `store.selection.rawPositionFromBoundary` / `readSelectedContent` — they no longer exist. Rewrite those parity assertions as direct behavior assertions (the expected values are now pinned by the previous green run): replace each `expect(facade).toBe(old)` with `expect(facade).toBe(<the concrete expectation already proven>)` — concretely, change the boundary parity test to assert `boundaryFor` against a small table of known-good `(node, offset, affinity) → position` triples per fixture, captured from the last green run of the dual-run version.

- [x] **Step 5: Test + commit**

Run: `pnpm -F core test` → all green. The SelectionController suite is the real gate here; investigate any placement regression against the Ordering note in Task 4 before touching boundary.ts.

```bash
git add -A packages/core
git commit -m "refactor(selection): SelectionController keeps policy, delegates DOM mechanics to tokens facade"
```

---

### Task 8: migrate `arrowNav.ts`

**Files:**
- Modify: `packages/core/src/features/keyboard/arrowNav.ts:30-38`

- [x] **Step 1: Replace locate with handleAt**

```ts
function shiftFocus(store: KbCtx, event: KeyboardEvent, direction: 'prev' | 'next'): boolean {
	// Resolve the "current" token from the focused DOM element, not from
	// caret.selection. At a position exactly between two tokens the position alone
	// is ambiguous; the active element tells us which token the user is
	// actually standing on.
	const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
	const handle = active ? store.tokens.handleAt(active) : undefined
	if (!handle || handle === 'control') return false

	const isFocusedOnMarkElement = active === handle.element() && !handle.hasTextSurface()
	const address = handle.address()

	const token = store.tokens.index().resolveAddress(address)
	if (!token) return false
	...
```

The rest of the function (`path`/`siblingAddress`/`placeAtAddress`) is unchanged.

- [x] **Step 2: Test + commit**

Run: `pnpm -F core test` → all green

```bash
git add -A packages/core
git commit -m "refactor(keyboard): arrowNav resolves focus through token handles"
```

---

### Task 9: migrate `blockEdit.ts`

The dense one. Every `caretDom.*` call and the DOM-walking `findActiveBlock` go through handles.

**Files:**
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`

- [x] **Step 1: Replace findActiveBlock with handle resolution**

Delete `findActiveBlock`, the `ActiveBlock` type, the `caretDom` import, and the `htmlChildren, isHtmlElement` import (keep what's still used). Add:

```ts
import type {TokenHandle} from '../tokens'
```

```ts
type ActiveRow = {
	handle: TokenHandle
	index: number
}

function rowHandle(store: KbCtx, rowIndex: number): TokenHandle | undefined {
	const address = store.tokens.index().addressFor([rowIndex])
	return address ? store.tokens.handleFor(address) : undefined
}

function findActiveRow(store: KbCtx): ActiveRow | undefined {
	const active = document.activeElement
	if (!active) return undefined
	const handle = store.tokens.handleAt(active)
	if (!handle || handle === 'control') return undefined
	const index = handle.address().path[0]
	const row = rowHandle(store, index)
	if (!row) return undefined
	return {handle: row, index}
}
```

- [x] **Step 2: Migrate each handler**

`handleDelete` — head becomes:

```ts
function handleDelete(store: KbCtx, container: HTMLElement, event: KeyboardEvent) {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active

	const rows = store.tokens.current()
	if (blockIndex >= rows.length) return

	const token = rows[blockIndex]
	const value = store.value.current()

	if (event.key === KEYBOARD.BACKSPACE) {
		const caretAtStart = handle.caretIndex() === 0
		...
```

…and in the DELETE branch:

```ts
	if (event.key === KEYBOARD.DELETE) {
		const caretIndex = handle.caretIndex()
		const caretAtEnd = caretIndex === handle.textLength()
		const caretAtStart = caretIndex === 0
		...
```

`mergeOrFocusNeighbor` — the `blockDivs` parameter disappears; final line becomes:

```ts
		focusRow(store, rows[toIndex], toIndex, caretOnFocus)
```

Update both call sites in `handleDelete` accordingly (drop the `blockDivs` argument).

`focusRow` — element parameter becomes a row index:

```ts
function focusRow(store: KbCtx, token: Token, rowIndex: number, caret: 'start' | 'end'): void {
	if (token.type === 'mark') {
		const path = store.tokens.index().pathFor(token)
		const address = path ? store.tokens.index().addressFor(path) : undefined
		if (address && store.selection.placeAtAddress(address, caret)) return
	}

	const row = rowHandle(store, rowIndex)
	if (!row) return
	row.focus()
	row.placeCaret(caret === 'start' ? 0 : Infinity)
}
```

`handleBlockArrowLeftRight`:

```ts
function handleBlockArrowLeftRight(
	store: KbCtx,
	container: HTMLElement,
	event: KeyboardEvent,
	direction: 'left' | 'right'
): void {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active
	const rowCount = store.tokens.current().length

	if (direction === 'left') {
		if (handle.caretIndex() !== 0) return
		if (blockIndex === 0) return
		event.preventDefault()
		const prev = rowHandle(store, blockIndex - 1)
		if (!prev) return
		prev.focus()
		prev.placeCaret(Infinity)
		return
	}

	if (handle.caretIndex() !== handle.textLength()) return
	if (blockIndex >= rowCount - 1) return
	event.preventDefault()
	const next = rowHandle(store, blockIndex + 1)
	if (!next) return
	next.focus()
	next.placeCaret(0)
}
```

`handleArrowUpDown`:

```ts
function handleArrowUpDown(store: KbCtx, container: HTMLElement, event: KeyboardEvent) {
	const active = findActiveRow(store)
	if (!active) return
	const {handle, index: blockIndex} = active
	const rowCount = store.tokens.current().length

	if (event.key === KEYBOARD.UP) {
		if (!handle.caretOnFirstLine()) return
		if (blockIndex === 0) return

		event.preventDefault()
		const caretRect = store.tokens.selectionRect()
		const caretX = caretRect?.left ?? handle.element()?.getBoundingClientRect().left ?? 0
		const prev = rowHandle(store, blockIndex - 1)
		if (!prev) return
		prev.focus()
		const prevRect = prev.element()?.getBoundingClientRect()
		prev.placeCaretAtX(caretX, prevRect ? prevRect.bottom - 4 : undefined)
	} else if (event.key === KEYBOARD.DOWN) {
		if (!handle.caretOnLastLine()) return
		if (blockIndex >= rowCount - 1) return

		event.preventDefault()
		const caretRect = store.tokens.selectionRect()
		const caretX = caretRect?.left ?? handle.element()?.getBoundingClientRect().left ?? 0
		const next = rowHandle(store, blockIndex + 1)
		if (!next) return
		next.focus()
		const nextRect = next.element()?.getBoundingClientRect()
		next.placeCaretAtX(caretX, nextRect ? nextRect.top + 4 : undefined)
	}
}
```

(Subtle change to preserve: the old code measured rects on the **row div**; `handle.element()` is the token element inside the row. For Y-targeting (`bottom - 4` / `top + 4`) the row and token rects can differ if rows have padding. If the block keyboard specs catch a discrepancy, add a `rowRect(): DOMRect | undefined` method to TokenHandle returning `this.#measureScope()?.getBoundingClientRect()` and use it here — measurement scope IS the row.)

`handleBlockBeforeInput` — first line becomes `if (!findActiveRow(store)) return`.

`handleEnter` — `const active = findActiveRow(store)`; `const {index: blockIndex} = active` (unchanged otherwise — it never used the div).

After these changes the `container` parameter is unused in `handleDelete`, `handleEnter`, `handleBlockArrowLeftRight`, and `handleArrowUpDown` — remove it from those signatures and update the call sites inside `enableBlockEdit` (the `listen(container, ...)` wiring itself stays).

- [x] **Step 2.5: Decide on rowRect**

Given the parenthetical above and that `caretOnFirstLine`/`caretIndex`/`placeCaretAtX` already use the row scope, the rect should too. Add to `TokenHandle`:

```ts
	rect(): DOMRect | undefined {
		return this.#measureScope()?.getBoundingClientRect()
	}
```

and use `handle.rect()` / `prev.rect()` / `next.rect()` instead of `element()?.getBoundingClientRect()` in `handleArrowUpDown`.

- [x] **Step 3: Test + commit**

Run: `pnpm -F core test` → all green (block keyboard specs are the gate)

```bash
git add -A packages/core
git commit -m "refactor(keyboard): blockEdit navigates and places carets via token handles"
```

---

## Sub-phase 1c — deletions + guard

### Task 10: delete the old public surface

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.ts`
- Modify: `packages/core/src/features/tokens/index.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts`

- [x] **Step 1: Verify nothing outside tokens still uses the old API**

```bash
grep -rn "tokens\.locate\|tokens\.nodeFor\|tokens\.nodes()\|from '../tokens/caret'\|from '../tokens/textOffsets'\|reconcileTextSurfaces\|TokenNode\|Lookup" packages/core/src --include='*.ts' | grep -v "src/features/tokens/"
```

Expected: empty output. Any hit is an unmigrated consumer — fix it first.

- [x] **Step 2: Privatize locate/nodeFor/nodes**

In `TokenModel.ts` rename `locate` → `#locate`, `nodeFor` → `#nodeFor`, `nodes` → `#nodes` and update the internal callers (`handleAt`, `#boundaryContext`, `reconcileSurfaces`, `placeCaret`). TS private-name methods can't be referenced in the `#boundaryContext` object literal via `this.#locate` inside arrow functions — they can (arrow functions close over `this`), so:

```ts
	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.current(),
			index: this.index(),
			locate: node => this.#locate(node),
			nodeFor: address => this.#nodeFor(address),
			nodes: () => this.#nodes(),
		}
	}
```

- [x] **Step 3: Trim the tokens barrel**

In `packages/core/src/features/tokens/index.ts` delete these lines:

```ts
export {reconcileTextSurfaces} from './reconcileTextSurfaces'
export type {TokenNode, Lookup} from './domTypes'
```

(`reconcileTextSurfaces.spec.ts` imports the free function from `./reconcileTextSurfaces` directly — unaffected.)

- [x] **Step 4: Update TokenModel.index.spec.ts**

Its ~13 `locate`/`nodeFor`/`nodes()` references become facade calls. Mapping:
- `store.tokens.locate(el)` asserting `kind === 'token'` + `node.tokenElement` → `store.tokens.handleAt(el)` asserting a `TokenHandle` with `handle.element()`
- `store.tokens.locate(ctrl)` asserting `kind === 'control'` → `expect(store.tokens.handleAt(ctrl)).toBe('control')`
- `store.tokens.nodeFor(address)` → `store.tokens.handleFor(address)`
- `[...store.tokens.nodes()]` length/content assertions → `[...store.tokens.handles()]` with `handle.address()`/`handle.element()`

Assertions about `textElement`/`rowElement`/`childSequenceHost` internals: where the *behavior* is what matters (e.g. "text surface is indexed"), assert via `handle.hasTextSurface()`; for row/childSequenceHost structure, move those cases into `buildIndex.spec.ts` (which legitimately tests internals) if not already covered there — check first; most are.

- [x] **Step 5: Test + commit**

Run: `pnpm -F core test` → all green

```bash
git add -A packages/core
git commit -m "refactor(tokens)!: remove locate/nodeFor/nodes and TokenNode from the public surface"
```

---

### Task 11: encapsulation guard

**Files:**
- Create: `scripts/check-dom-encapsulation.sh`
- Modify: `package.json` (root)

- [x] **Step 1: Write the guard script**

Create `scripts/check-dom-encapsulation.sh`:

```bash
#!/usr/bin/env bash
# Raw selection/range/walker DOM APIs are allowed only inside features/tokens.
# Spec: docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md
set -uo pipefail

violations=$(grep -rn --include='*.ts' \
	-e 'window\.getSelection' \
	-e 'createRange' \
	-e 'createTreeWalker' \
	-e 'caretRangeFromPoint' \
	-e 'caretPositionFromPoint' \
	-e "from '.*tokens/caret'" \
	-e "from '.*tokens/textOffsets'" \
	-e "from '.*tokens/boundary'" \
	packages/core/src \
	| grep -v 'packages/core/src/features/tokens/' \
	| grep -v '\.spec\.ts')

if [ -n "$violations" ]; then
	echo 'DOM encapsulation violations (raw selection APIs outside features/tokens):'
	echo "$violations"
	exit 1
fi
echo 'DOM encapsulation: clean'
```

```bash
chmod +x scripts/check-dom-encapsulation.sh
```

- [x] **Step 2: Wire it into package.json**

In root `package.json` scripts add:

```json
"check:encapsulation": "bash scripts/check-dom-encapsulation.sh",
```

- [x] **Step 3: Run it; fix or document any stragglers**

Run: `pnpm run check:encapsulation`
Expected: `DOM encapsulation: clean`. Known possible straggler: `TriggerFinder`'s `fallbackAnchor()` (Task 6) uses `window.getSelection`. Resolve it here, don't suppress it: preferred fix is updating `TriggerFinder.spec.ts` to mount a Store (copy the mount helper from `TokenModel.facade.spec.ts`) and pass `store.tokens`, then delete `fallbackAnchor`. Adding grep exclusions to the script is not an acceptable resolution.

- [x] **Step 4: Full suite + commit**

Run: `pnpm -F core test && pnpm run check:encapsulation` → both green

```bash
git add -A
git commit -m "chore: DOM encapsulation guard — selection APIs only inside features/tokens"
```

---

### Task 12: hand off to Phase 2 planning

Phase 1 is not "done" until the next phase is planned — this keeps the spec's phase chain unbroken.

- [x] **Step 1: Verify all Phase 1 gates**

Run: `pnpm -F core test && pnpm run check:encapsulation`
Expected: both green. All checkboxes in Tasks 1–11 ticked.

- [x] **Step 2: Write the Phase 2 implementation plan**

Using the **superpowers:writing-plans** skill, write the Phase 2 (incremental parser) plan against the *now-landed* codebase, from the spec `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md` (section "Phase 2 — parser-threaded identity"). Scope: `parse(value, previous?)`, stable token ids, the `{textChanged, added, removed, shifted}` changeset with `full` fallback, handle registry re-keying from path to id, equivalence property spec, incremental-typing benchmark. Save to `docs/superpowers/plans/YYYY-MM-DD-tokenmodel-incremental-parser-phase2.md`.

**The Phase 2 plan MUST end with the same kind of handoff task: "write the Phase 3 (fine-grained commit) plan via writing-plans".** Phase 3's plan then ends the chain (no Phase 4).

- [x] **Step 3: Commit the Phase 2 plan**

```bash
git add docs/superpowers/plans/
git commit -m "docs(tokens): Phase 2 implementation plan — incremental parser with stable identity"
```

---

## Done criteria (gates from the spec)

- 1a: `pnpm -F core test` green including TokenHandle + facade parity corpus — old code untouched until parity proven ✓ (Tasks 1–4)
- 1b: suite green after each consumer commit; consumers contain no raw selection DOM ✓ (Tasks 5–9, one consumer per commit)
- 1c: grep-clean old surface; guard script wired ✓ (Tasks 10–11)
- Handoff: Phase 2 plan written via writing-plans and committed; its final task hands off to Phase 3 ✓ (Task 12)
