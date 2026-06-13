# One Fresh Truth — Phase 4: Kill TokenAddress (the semver-major core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `TokenAddress = {path, token}` and the four-lookup surface. The whole identity check collapses to a `TokenHandle` reached by `handle(id)` + `handleAt(node)`. `MarkController` is re-backed by a handle (its `value`/`meta`/`slot`/`readOnly` become LIVE reads of the current token; `update()` against a pending or dead handle is a fail-closed no-op returning `false`); `placeCaret` and `SelectionController.placeAtAddress` take a handle instead of an address; `useMarkInfo` ships `id`/`path()` (its end-user staleness warning dies). This is **SEMVER-MAJOR / breaking** — expected and intended.

**Architecture:** Today identity is carried by `TokenAddress = {path, token}` — a path PLUS a live token object — and resolved by a hand-duplicated idiom (`handleFor(address)` to mount-check by path, `handleOf(address.token) !== handle` to identity-check by id). That idiom appears three times (`SelectionController.#resolveAddress`, `#applyPreferredAddress`, `TokenModel.placeCaret`'s address form) and the captured-address fallback (`MarkController.#resolveCaptured` + the `pathOf` DFS) is a fourth copy. The address embeds a stale object that every consumer must hand-bridge. After Phase 1 every reconciled token carries a stable `token.id` plain field (stamped by reconcile, verified: `tokenIdentity.ts` writes `token.id = id`); after Phase 3 `tokens()` is the always-fresh tree. So the path-and-token address is now pure overhead: a token's `id` IS its identity, and `handle(id)` resolves it fail-closed in one read. Phase 4 replaces the address with the handle everywhere: a consumer holding a render-tree token resolves `handle(token.id)`; the live handle's `token()` carries current content and positions, and its existence (non-`undefined`, non-dead) IS the whole validity check.

The deepest cut is the boundary facade. `TokenView.address` (the `{path, token}` the facade carries per bound node) and `BoundaryContext.resolveAddress` (the path-and-identity consistency check) are DERIVED FRESH from the live handle (`#view` builds `address: handle.address()`; `#resolveAddress` checks `resolvePath(tokens(), address.path) === address.token`). Because the view's address is rebuilt from the handle's CURRENT `#token`/`#path` on every read, this is an internal self-consistency check, not an end-user address. Phase 4 re-backs it on the handle directly: `TokenView.address` → `TokenView.token` (the fresh current token, `handle.token()`); `resolveAddress(address)` → `tokenOf(view)` returning `view.token` while the handle is live (and `undefined` mid-window via the pending latch the handle layer already enforces). No external behavior changes — the same token objects resolve, now without the path round-trip.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full core suite). To run ONE spec: `pnpm -w exec vitest run --project core <path-or-pattern>`. Storybook page specs (the react/vue vitest projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck` (recursive `tsc --noEmit` / `vue-tsc --noEmit` across all packages — this is what catches the deleted `TokenAddress` export, the dropped `handleFor`/`handleOf`, and the re-shaped `MarkInfo`). Encapsulation guard: `pnpm run check:encapsulation`. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of `.ts`/`.tsx` files** (`.vue` SFCs DO end with a newline — match each file).

**Commits in a shared checkout:** other agents work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times. If a pre-commit hook reflows a file you did not edit (MM, cosmetic-only vs HEAD), `git reset HEAD -- <file>` rather than commit churn.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 4: "`handle(id)` + `handleAt(node)` only; `placeCaret` handle form; MarkController re-backed by a handle, live-read parity tables; TokenAddress deleted from editorContracts; `useMarkInfo` ships `path()`/id (its end-user staleness warning dies)"; §Public API → `handle(id: Id)` / `handleAt(node)`; §MarkController semantics → "Re-backed by a handle (deletes `#resolveCaptured`, the `pathOf` DFS, the 11-line justification comment). `value/meta/slot/readOnly` become **live reads** of the current token … `update()` against a pending or dead id is a fail-closed no-op returning `false`"; §Pending-window read matrix → `handle(id)`/`handleAt(node)` serve `undefined` mid-window; "What dies" → "`TokenAddress = {path, token}` + `#resolveAddress` + the triple-duplicated validity idiom" / "Four lookups → `handle(id)` + `handleAt(node)`"; "Reversal triggers" → "third-party TokenAddress dependence surfacing in Phase 4 → a deprecated `{path, id}` shim for one major version" — NOT triggered unless a real dependent surfaces; do not pre-build the shim).

**Background facts (probe-verified against post-Phase-3 HEAD, do not re-derive):**

- **Every reconciled token carries `token.id`.** `parser/types.ts` declares `id?: number` on both `TextToken` and `MarkToken` ("Stable identity id, stamped by reconcile … Absent on freshly parsed, never-reconciled trees"). `tokenIdentity.ts` writes `token.id = id` and `to.id = id` during reconcile. So a token reached through `tokens()`, `at(i)`, the render tree, or an adapter prop ALWAYS has a stamped `id` (the parser's raw, never-reconciled output does not — but no consumer holds that). `handle(id)` takes the stamped `number`.
- **The live node layer is keyed by id.** `TokenModel.#nodes: Map<number, TokenHandle>` (mutated only through the pipeline). `TokenHandle` exposes `readonly id: number`. The pipeline already resolves `deps.nodes.get(change.id)` on the text branch. So `handle(id)` = a latch-gated `#nodes.get(id)`.
- **`handleOf(token)` IS already `handle(token.id)` modulo the id peek.** Today: `handleOf` calls `this.#identity.idFor(token)` (a read-only WeakMap peek that returns `undefined` for foreign tokens) then `#nodes.get(id)`, gated by `this.#pipeline.pending()`. Phase 4 replaces the `idFor` peek with `token.id` directly (the plain field; foreign tokens lacking an id read `undefined`) and renames the entry point to `handle(id)` taking the id, not the token. The pending-latch gate is UNCHANGED.
- **The four lookups today (grep-verified, COMPLETE):**
  - `handleFor(address): TokenHandle | undefined` — `this.#pipeline.byPath().get(pathKey(address.path))`. **Dies** (address-keyed; no replacement — id-keyed `handle(id)` subsumes it).
  - `handleAt(node): TokenHandle | 'control' | undefined` — DOM-walk via `#locate`. **Kept verbatim** (it is one of the two survivors).
  - `handleOf(token): TokenHandle | undefined` — id-bridged, latch-gated. **Becomes `handle(id)`** (takes the id, not the token).
  - `tokenAt(position): TokenHandle | undefined` — `textTargetAt(...).node.handle`. **Untouched** (a Phase-5 deletion target — leave it; it does not use TokenAddress).
- **The triple-duplicated validity idiom (grep-verified, COMPLETE — 3 production copies + 1 captured-address copy):**
  - `SelectionController.#resolveAddress`: `const handle = this.tokens.handleFor(address); if (!handle || this.tokens.handleOf(address.token) !== handle) return undefined`.
  - `SelectionController.#applyPreferredAddress`: same two lines, `return false`.
  - `TokenModel.placeCaret` (address form): `const handle = this.handleFor(target.address); if (!handle || this.handleOf(target.address.token) !== handle) return false`.
  - `MarkController.#resolve` / `#resolveCaptured`: the captured-address fallback (`resolvePath(tokens(), this.address.path) === this.address.token`) is the same check spelled with `resolvePath`.
  Each collapses to: resolve the handle once (`handle(id)` or store it), check it is live. No path round-trip, no object-identity re-check (the handle IS the identity).
- **`placeAtAddress` call sites (grep-verified, COMPLETE — 3):**
  - `SelectionController.focusFirst`: `this.placeAtAddress({path: [0], token: first}, 'start')` where `first = this.tokens.at(0)`.
  - `arrowNav.shiftFocus`: `store.selection.placeAtAddress({path: siblingPath, token: sibling}, ...)` where `sibling = resolvePath(store.tokens.tokens(), siblingPath)`.
  - `blockEdit.focusRow`: `store.selection.placeAtAddress({path: [rowIndex], token}, caret)`.
  All three hand a `{path, token}` built from a fresh `tokens()` read. The PATH is incidental — only the token's identity and the boundary side matter. They become `placeAtHandle(handle, boundary)` where `handle = store.tokens.handle(token.id)`.
- **`placeCaret`'s address form (grep-verified):** `placeCaret(target: number | {address: TokenAddress; offset: number})`. The address form is reached ONLY from `SelectionController.#applyPreferredAddress` (`this.tokens.placeCaret({address, offset: ...})`). It becomes `placeCaret(target: number | {handle: TokenHandle; offset: number})`.
- **`#preferredAddress` (SelectionController):** a captured `TokenAddress` set by `#resolveAddress` and consumed by `#applyPreferredAddress` to disambiguate which token at a shared boundary to place into. It carries identity across the `range` signal write → `#applyRange` → `#placeCollapsed` chain. Becomes `#preferredHandle: TokenHandle | undefined`.
- **`MarkController` (grep-verified):** constructor `(store, address: TokenAddress, snapshot: MarkSnapshot)`. `fromToken` resolves `handleOf(token)?.address() ?? #addressInTree(store, token)` (the `pathOf` DFS). `value`/`meta`/`slot`/`readOnly` getters read `this.snapshot` (a FROZEN capture). `#resolve` bridges `handleOf(this.address.token)?.token() ?? #resolveCaptured()`. After Phase 4: constructor `(store, handle: TokenHandle)`; `fromToken` resolves `store.tokens.handle(token.id)` (throws if the token has no id or no live handle — same failure surface as today's `pathOf` throw); the four getters read `handle.token()` LIVE (`#liveMark()` helper returns the current mark token or `undefined`); `#resolve` returns `handle.token()` iff it is a live, non-read-only mark, else `undefined`. `#resolveCaptured`, `pathOf`, the captured `address`, and the `snapshot` constructor param all die — `MarkController` no longer imports `MarkSnapshot`. The `MarkSnapshot` TYPE in `editorContracts` and its public export are LEFT IN PLACE (only `TokenAddress` is named for deletion by the spec; `MarkSnapshot` becomes internally unreferenced but stays exported — do NOT delete it this phase, and do NOT let its now-orphaned status trip a "remove unused" reflex). It remains the documented mark-read shape (sibling of `MarkPatch`) and may regrow a consumer in Phase 5's `selection()` work.
- **The boundary facade's `address` usage (grep-verified — `boundary.ts` + `TokenModel.ts` `#view`/`#resolveAddress`/`#viewOf`/`#boundaryContext`):** `TokenView` carries `address: TokenAddress`. `BoundaryContext.resolveAddress(address)` and `viewOf(token)` are the facade's identity hooks. The boundary functions (`rawPositionFromBoundary`, `fromTokenChildBoundary`, `textTargetAt`, `markBoundaryAt`, `lookupTokenDescendant`) call `ctx.resolveAddress(node.address)` to get the fresh token for a bound view. Because `#view` builds the address from `handle.address()` (the live handle's CURRENT token/path) and `#resolveAddress` rejects only mid-window/foreign, the whole round-trip is replaceable by reading `view.token` (the fresh `handle.token()`) directly, with a liveness gate for the mid-window case. Phase 4 re-shapes: `TokenView.address` → `TokenView.token: Token` (set to `handle.token()` in `#view`); `BoundaryContext.resolveAddress(address)` → `tokenOf(view: TokenView): Token | undefined` (returns `view.token` — already fresh; `undefined` only when the handle layer is mid-window, which `#view` already excludes by returning `undefined` for unbound handles). `viewOf(token)` stays (id-bridged: `handle(token.id)` then `#view`) — the boundary still needs a token→view lookup for `fromTokenChildBoundary`'s text-element probe.
- **`useMarkInfo` (react `.tsx` + vue `.ts`) ships `MarkInfo`:** today `{address, depth, hasNestedMarks, key}`. `depth = address.path.length - 1`; `key = address.path.join('.')`. The provider (`Token.tsx` `<TokenContext value={{store, token, address: {path, token}}}>`; `Token.vue` `provide(TOKEN_KEY, toRef(() => ({path, token})))`) carries the render-time path BY CONSTRUCTION (the parent maps the tree and knows each index). Phase 4: `MarkInfo` becomes `{id, path, depth, hasNestedMarks, key}` (`id = token.id`, `path` the render-time path, `depth`/`key`/`hasNestedMarks` derived as today from `path`/`token`). The `address`-staleness JSDoc warning on both hooks is DELETED. The providers carry `{path, token}` still (they need the token to render and the path to derive `path`/`depth`/`key`); only the `MarkInfo` SHAPE and the `TokenAddress` type name change.
- **`MarkInfo` consumers (grep-verified, COMPLETE):** `useMarkInfo()` results read `.depth`, `.hasNestedMarks`, `.key` (storybook `nested.react.spec.tsx`, `nested.vue.spec.ts`, `Nested.react.stories.tsx`, `Nested.vue.stories`). NONE read `.address`. So dropping `address` from `MarkInfo` breaks no consumer; adding `id`/`path` is additive for them.
- **Public exports (`packages/core/index.ts`):** `export type {TokenPath, TokenAddress, Range, RawSelection, MarkPatch, MarkSnapshot, MarkInfo}`. `TokenAddress` is DELETED from this list (semver-major). `TokenPath` STAYS (a handle's `path()` returns it; the providers and `MarkInfo.path` use it). The react `TokenContext` and vue `tokenKey` import `TokenAddress` — they switch to a local `{path, token}` shape or `TokenPath` + `Token` (Task 9).
- **`LiveNode.TokenChange` uses `TokenAddress`:** `{kind: 'moved'; previousAddress: TokenAddress}` and `update()` builds `previousAddress: {path, token}`. The `TokenHandle.address(): Computed<TokenAddress>` getter also returns it. These are INTERNAL handle plumbing, NOT the public address surface this phase kills. **Leave them** — but since `TokenAddress` the TYPE is deleted from `editorContracts`, `LiveNode` defines a LOCAL `TokenSnapshot = {path: TokenPath; token: Token}` type for `previousAddress`/`address()` (Task 2). `address()` is a Phase-5 deletion target (the spec's dead-surface list: `handle.changed/.dead/.text/.caretRect/.placeCaretAtBoundary/address()`); this phase keeps it working under the local type, not the deleted public one. `handle.path()` is ADDED this phase (the public path read the spec names: `TokenHandle = {id, token(), path(), alive(), element(), ...}`).
- **`handle.alive()` does not exist yet.** The spec's handle face is `{id, token(), path(), alive(), element(), ...}`. Today `TokenHandle` has `dead: Computed<boolean>` (the inverse). Phase 4 ADDS `path(): TokenPath` (reads `#path`) and `alive(): boolean` (`!this.#dead()` AND bound — see Task 2 for the exact predicate). `dead` stays (Phase-5 deletion target). `id` is already public.
- **No `handle(` name collision.** `TokenModel` has `handleFor`/`handleAt`/`handleOf`/`handles`/`tokenAt` but no bare `handle`. The name is free.
- **`pathKey` becomes unused after `handleFor` dies.** `TokenModel` imports `pathEquals, pathKey, resolvePath` from `tokenIndex`. After Task 5 `handleFor` (the only `pathKey` user) is gone and `#resolveAddress` (the only `resolvePath` user in TokenModel) is gone; `pathEquals` stays (`#childSequenceHostsFor`). Drop `pathKey`/`resolvePath` from the import then (typecheck flags unused imports? — no, but `oxlint`/the build may; remove them to keep the import honest). `tokenIndex.ts` KEEPS `pathKey`/`resolvePath` (other users: `arrowNav` and `MarkController` used `resolvePath`; after Phase 4 verify with grep — if zero remain, leave the functions defined but unexported-by-use is fine; do NOT delete `tokenIndex.ts` functions this phase unless grep shows zero references).

---

### Task 1: Add `handle(id)` to the model — the id-keyed fail-closed lookup

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (add `handle(id)`; keep `handleOf` as a thin shim for one task so nothing breaks yet)
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts` (pin `handle(id)` semantics)

This task is PURELY ADDITIVE: it introduces `handle(id)` alongside the existing four lookups so the suite stays green. Later tasks migrate callers off `handleFor`/`handleOf` onto `handle(id)`/the handle, then delete the dead lookups.

- [ ] **Step 1: Write the failing tests**

Append a new sibling top-level describe to `TokenModel.index.spec.ts` (after the `TokenModel.tokens() / at()` describe; `mountInline` is module-scoped and reusable):

```ts
describe('TokenModel.handle(id) — the id-keyed fail-closed lookup', () => {
	it('handle(id) returns the live handle for a reconciled token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.tokens()[0].id
		expect(id).toBeTypeOf('number')
		const handle = store.tokens.handle(id!)
		expect(handle).toBeInstanceOf(TokenHandle)
		expect(handle?.element()).toBe(span)
		container.remove()
	})

	it('handle(id) returns undefined for an id with no live node', () => {
		const {store, container} = mountInline('hello')
		expect(store.tokens.handle(999999)).toBeUndefined()
		container.remove()
	})

	it('handle(id) returns undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		expect(store.tokens.handle(0)).toBeUndefined()
	})
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Expected: the 3 new tests FAIL (`store.tokens.handle` is `undefined` — not a function). All pre-existing tests pass.

- [ ] **Step 3: Add `handle(id)` to the model**

In `TokenModel.ts`, add directly after the existing `handleOf` method (~line 223, after its closing brace), a new method. Keep `handleOf` in place for now — Task 5 deletes it once callers migrate:

```ts
	/**
	 * Resolve a token id to its live handle, or `undefined`. The id-keyed read
	 * over the live node layer — fails closed while a structural apply awaits its
	 * bind (the layer is one generation stale, so a handle would let mutations act
	 * on a tree the DOM never showed). THE identity lookup: a consumer holding a
	 * render-tree token resolves `handle(token.id)`; the handle's `token()` carries
	 * current content and positions, and its existence IS the validity check.
	 */
	handle(id: number): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		return this.#nodes.get(id)
	}
```

- [ ] **Step 4: Run to verify green**

Run: `pnpm -w exec vitest run --project core TokenModel.index.spec`
Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Full core suite (additive — must stay green)**

Run: `pnpm -F core test`
Expected: full pass.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(tokens): add handle(id) — the id-keyed fail-closed lookup" -- packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/TokenModel.index.spec.ts
```

---

### Task 2: Add `path()` and `alive()` to TokenHandle; localize the internal address snapshot

**Files:**
- Modify: `packages/core/src/features/tokens/model/LiveNode.ts` (add `path()`/`alive()`; define local `TokenSnapshot`; drop the `TokenAddress` import)
- Modify: `packages/core/src/features/tokens/model/LiveNode.spec.ts` (pin `path()`/`alive()`)

The spec's handle face is `{id, token(), path(), alive(), element(), …}`. `id` and `token()` exist. This task adds `path()` (the public read of the handle's tree position) and `alive()` (live + bound), and severs `LiveNode`'s dependence on the soon-deleted public `TokenAddress` type by defining a local `TokenSnapshot` for the internal `previousAddress`/`address()` plumbing (a Phase-5 deletion target, kept working here).

- [ ] **Step 1: Write the failing tests**

In `LiveNode.spec.ts`, read the existing mount/handle-construction pattern at the top of the file, then append inside the top-level `describe` (match the file's existing fixture style — if the file constructs a `TokenHandle` directly via `new TokenHandle(id, token, path)`, reuse that; if it mounts a Store, reuse that). Add:

```ts
	it('path() returns the handle tree position; alive() is true while bound', () => {
		const {store, span} = mountInline('hello')
		const handle = store.tokens.handleAt(span)
		if (!handle || handle === 'control') throw new Error('expected handle')
		expect(handle.path()).toEqual([0])
		expect(handle.alive()).toBe(true)
	})

	it('alive() is false once the handle is killed', () => {
		// Block layout: capture row 1's handle, then shrink to one row so bind kills it.
		const {store, container} = mountBlock('alpha\n\nbeta\n\n')
		const handle = store.tokens.handle(store.tokens.tokens()[1].id!)
		if (!handle) throw new Error('expected handle for row 1')
		const secondRow = container.children[1]
		if (!(secondRow instanceof HTMLElement)) throw new Error('expected HTMLElement')
		secondRow.remove()
		store.value.current('alpha\n\n')
		store.host.rendered()
		expect(handle.alive()).toBe(false)
	})
```

(If `LiveNode.spec.ts` has no `mountInline`/`mountBlock` helper, copy the `mountInline`/`mountBlock` helpers verbatim from `TokenHandle.spec.ts` lines 6–46 into this spec's top — they are self-contained and import only `Store`. Verify the imports `{Store}` and `{TokenHandle}` are present; add them if missing.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm -w exec vitest run --project core LiveNode.spec`
Expected: the 2 new tests FAIL (`handle.path` / `handle.alive` not functions).

- [ ] **Step 3: Define the local `TokenSnapshot`; drop the `TokenAddress` import**

In `LiveNode.ts`, change the import line 1 from:

```ts
import type {TokenAddress, TokenPath} from '../../../shared/editorContracts'
```

to:

```ts
import type {TokenPath} from '../../../shared/editorContracts'
```

Add, right after the imports (before `export type TokenChange`), a local snapshot type (this is the internal `{path, token}` the move event and `address()` carry — formerly `TokenAddress`, now LiveNode-private since the public type dies):

```ts
/** @internal A handle's tree position + the token there, at a moment in time. Internal plumbing for the `moved` event and the (Phase-5-doomed) `address()` getter — NOT the deleted public address. */
export type TokenSnapshot = {readonly path: TokenPath; readonly token: Token}
```

Replace the `TokenChange` `moved` variant (line ~18) from:

```ts
	| {kind: 'moved'; previousAddress: TokenAddress}
```

to:

```ts
	| {kind: 'moved'; previousAddress: TokenSnapshot}
```

Replace the `address` getter (lines ~73-76) from:

```ts
	/** Derived on read: a fresh `{path, token}` per evaluation of this node's state. */
	readonly address: Computed<TokenAddress> = computed(() => {
		this.dirty()
		return {path: [...this.#path], token: this.#token}
	})
```

to:

```ts
	/** Derived on read: a fresh `{path, token}` snapshot per evaluation of this node's state. @deprecated Phase-5 deletion target — prefer `path()` + `token()`. */
	readonly address: Computed<TokenSnapshot> = computed(() => {
		this.dirty()
		return {path: [...this.#path], token: this.#token}
	})
```

In `update()` (line ~207), change:

```ts
		const previousAddress: TokenAddress = {path: this.#path, token: prevToken}
```

to:

```ts
		const previousAddress: TokenSnapshot = {path: this.#path, token: prevToken}
```

- [ ] **Step 4: Add `path()` and `alive()`**

In `LiveNode.ts`, add directly after the `address` getter (the deprecated snapshot one) and before the `element` getter (~line 77):

```ts
	/** The handle's current tree position. A live read; tracks reconcile moves. */
	path(): TokenPath {
		this.dirty()
		return [...this.#path]
	}

	/** Live AND bound: not killed and currently holding a DOM element. The whole validity check a holder of this handle needs. */
	alive(): boolean {
		return !this.#dead() && this.#tokenElement != null
	}
```

- [ ] **Step 5: Run to verify green**

Run: `pnpm -w exec vitest run --project core LiveNode.spec`
Expected: all tests pass, including the 2 new ones.

- [ ] **Step 6: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass — `TokenChange.moved.previousAddress` is the same `{path, token}` shape under a new type name; `address()` unchanged in behavior.

Run: `pnpm run typecheck`
Expected: clean — `LiveNode` no longer imports `TokenAddress` (it is still exported from `editorContracts` for now; deleted in Task 8). `boundary.ts` still imports `TokenAddress` — migrated in Task 7. No dangling reference yet.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(tokens): TokenHandle.path()/alive(); localize address snapshot type" -- packages/core/src/features/tokens/model/LiveNode.ts packages/core/src/features/tokens/model/LiveNode.spec.ts
```

---

### Task 3: Re-back MarkController by a handle — live reads + fail-closed no-op

**Files:**
- Modify: `packages/core/src/features/tokens/MarkController.ts`
- Modify: `packages/core/src/features/tokens/MarkController.spec.ts` (pin the live-read parity tables; migrate the existing cases off the snapshot)

This is the heart of the phase. `MarkController` stops capturing a frozen `{address, snapshot}` and holds a `TokenHandle`. `value`/`meta`/`slot`/`readOnly` become LIVE reads of `handle.token()`. `update()`/`remove()` against a pending or dead handle return a fail-closed no-op (`false` / silent). `#resolveCaptured`, `pathOf`, and the captured address all die.

- [ ] **Step 1: Write the failing parity-table tests**

Append to `MarkController.spec.ts` a new describe pinning the LIVE-read semantics (the spec's §MarkController semantics). Reuse the module-scoped `mountedSetup` helper (text `he` [0,2], mark `@[x]` [2,6], text `llo` [6,9]):

```ts
describe('MarkController live-read parity (handle-backed)', () => {
	afterEach(() => {
		document.body.replaceChildren()
	})

	// value / meta / slot / readOnly are LIVE reads of the current token — they
	// track text-path commits WITHOUT re-capturing the controller.
	it('value tracks the current token across a text-path edit', () => {
		const {store, controller} = mountedSetup()
		expect(controller.value).toBe('x')
		// Text-path edit before the mark shifts its position but not its value.
		store.edit.replace({start: 0, end: 0}, 'XX')
		expect(store.value.current()).toBe('XXhe@[x]llo')
		// The controller's value is a LIVE read of the (shifted, same-value) token.
		expect(controller.value).toBe('x')
	})

	it('update() reflects a value change made through the controller itself (live read)', () => {
		const {store, controller} = mountedSetup()
		controller.update({value: 'y'})
		expect(store.value.current()).toBe('he@[y]llo')
		// After the structural commit re-binds, the live read sees the new value.
		const container = document.querySelector('div')!
		const text1 = document.createElement('span')
		const markEl = document.createElement('span')
		markEl.append(document.createTextNode('y'))
		const text2 = document.createElement('span')
		container.replaceChildren(text1, markEl, text2)
		store.host.rendered()
		expect(controller.value).toBe('y')
	})

	it('meta and slot are live reads (parity table)', () => {
		const store = new Store()
		store.props.set({
			defaultValue: 'a @[v](m)',
			options: [{markup: '@[__value__](__meta__)'}],
			Mark: () => null,
		})
		const container = document.createElement('div')
		container.append(document.createElement('span'), document.createElement('span'))
		document.body.append(container)
		store.host.container(container)
		store.host.rendered()
		const token = store.tokens.tokens().find(t => t.type === 'mark')!
		const controller = MarkController.fromToken(store, token)
		expect(controller.value).toBe('v')
		expect(controller.meta).toBe('m')
		expect(controller.slot).toBeUndefined()
	})

	it('readOnly is a live read of props.readOnly()', () => {
		const {store, controller} = mountedSetup()
		expect(controller.readOnly).toBe(false)
		store.props.set({readOnly: true})
		expect(controller.readOnly).toBe(true)
	})

	it('update() against a dead handle is a fail-closed no-op returning false', () => {
		const {store, controller} = mountedSetup()
		// Structurally remove the mark and re-bind so its handle is killed.
		store.edit.replace({start: 2, end: 6}, '')
		expect(store.value.current()).toBe('hello')
		const container = document.querySelector('div')!
		container.replaceChildren(document.createElement('span'))
		store.host.rendered()

		const result = controller.update({value: 'bad'})
		expect(result).toBe(false)
		expect(store.value.current()).toBe('hello')
	})

	it('update() while a structural apply awaits its bind is a fail-closed no-op returning false', () => {
		const {store, controller} = mountedSetup()
		// Trigger a structural commit but do NOT render() — the latch is closed.
		store.value.current('different @[x]')
		// handle(id) fails closed mid-window, so the live read sees no mark.
		const result = controller.update({value: 'bad'})
		expect(result).toBe(false)
	})
})
```

(NOTE: the existing `MarkController across text-path commits (identity bridge)` describe already covers `update()`/`remove()` mutating the SHIFTED range; those cases stay green because the handle's `token()` IS the shifted token — the live read replaces the explicit bridge. The existing `fails closed when the mark is gone from the value` and `does not mutate in read-only mode` cases also stay green. Run the WHOLE spec, not just the new describe.)

- [ ] **Step 2: Run to verify the new tests fail (and capture which existing ones need migration)**

Run: `pnpm -w exec vitest run --project core MarkController.spec`
Expected: the new `update()` no-op tests FAIL on the `expect(result).toBe(false)` line (`update` currently returns `void`/`undefined`, not `false`). The new live-read tests may PASS or FAIL depending on the snapshot capture — note which. This is the red baseline.

- [ ] **Step 3: Rewrite `MarkController.ts`**

Replace the ENTIRE contents of `packages/core/src/features/tokens/MarkController.ts` with:

```ts
import type {MarkToken} from '.'
import type {MarkPatch} from '../../shared/editorContracts'
import type {Store} from '../../store'
import type {TokenHandle} from './model/LiveNode'
import {annotate} from './parser/utils/annotate'

/**
 * Handle-backed mark command surface. The controller holds a {@link TokenHandle},
 * not a frozen `{address, snapshot}` capture: `value`/`meta`/`slot`/`readOnly`
 * are LIVE reads of the handle's current token, so they track text-path commits
 * (and the controller's own updates after re-bind) without re-capture. `update`/
 * `remove` resolve the live mark first; against a pending (mid-window) or dead
 * handle, or in read-only mode, they are a fail-closed no-op.
 */
export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly handle: TokenHandle
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// The adapter hands in a render-tree token; bridge by its stable id (the
		// Phase-1 plain field) to the live handle. A token outside the current tree
		// (no id, or no live node) has no controller — same failure surface as the
		// old pathOf throw.
		if (token.id === undefined) throw new Error('Cannot create MarkController for a token without an id')
		const handle = store.tokens.handle(token.id)
		if (!handle) throw new Error('Cannot create MarkController for a token outside the current tree')
		return new MarkController(store, handle)
	}

	/** The live mark token at this handle, or undefined (dead, mid-window, or no longer a mark). */
	#liveMark(): MarkToken | undefined {
		if (!this.handle.alive()) return undefined
		const token = this.handle.token()
		return token.type === 'mark' ? token : undefined
	}

	get value(): string {
		return this.#liveMark()?.value ?? ''
	}

	get meta(): string | undefined {
		return this.#liveMark()?.meta
	}

	get slot(): string | undefined {
		return this.#liveMark()?.slot?.content
	}

	get readOnly(): boolean {
		return this.store.props.readOnly()
	}

	remove(): boolean {
		const token = this.#resolve()
		if (!token) return false
		this.store.value.replace(token.position, '')
		return true
	}

	update(patch: MarkPatch): boolean {
		const token = this.#resolve()
		if (!token) return false

		const value = patch.value ?? token.value
		const meta =
			patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : token.meta
		const slot =
			patch.slot?.kind === 'clear'
				? undefined
				: patch.slot?.kind === 'set'
					? patch.slot.value
					: token.slot?.content
		const serialized = this.#serialize(token, {value, meta, slot})

		this.store.value.replace(token.position, serialized)
		return true
	}

	#serialize(token: MarkToken, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(token.descriptor.markup, {
			value: fields.value,
			meta: token.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: token.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	/** The live mark to mutate, or undefined in read-only mode / against a dead or mid-window handle. */
	#resolve(): MarkToken | undefined {
		if (this.store.props.readOnly()) return undefined
		return this.#liveMark()
	}
}
```

(Note: `MarkSnapshot` and `TokenAddress`/`TokenPath` are no longer imported here. `remove`/`update` now RETURN `boolean` — the spec's fail-closed-returns-`false` contract. The `MarkToken`/`Token` import from `'.'` narrows to just `MarkToken`. `resolvePath` is gone. The 11-line justification comment, `#resolveCaptured`, `#addressInTree`, and the `pathOf` DFS are deleted.)

- [ ] **Step 4: Run the full MarkController spec**

Run: `pnpm -w exec vitest run --project core MarkController.spec`
Expected: full pass — the new live-read + no-op tests green; the existing identity-bridge cases green (the handle's `token()` IS the shifted/current token, so `update`/`remove` hit the correct range; the structural-removal and read-only cases no-op).

If the existing `same-slot replacement inherits identity` case (line ~204) regresses: the handle is killed and re-created with the inherited id at bind. After `store.host.rendered()`, `store.tokens.handle(inheritedId)` must return the new handle — but the CONTROLLER holds the OLD (killed) handle object. The fail-closed contract says this should no-op (the old handle is dead). VERIFY: read the case's assertion — it expects `update({value: 'probe'})` to SUCCEED (`'different @[probe]'`). Under handle-backing the controller holds the killed handle, so it would FAIL closed. **This is a deliberate semver-major behavior change** (the spec: "`update()` against a pending or dead id is a fail-closed no-op"). The case must be AMENDED: a controller captured before a structural identity-inheriting commit no longer auto-bridges across the kill — the consumer re-derives the controller from the fresh token (`useMark`'s `useMemo` re-runs on the new token object). Rewrite the case to RE-CREATE the controller from the post-commit token and assert success:

```ts
	it('a controller re-derived after a same-slot structural replacement applies to the inherited-id mark', () => {
		// Semver-major change (Phase 4): a controller is handle-backed, so one
		// captured BEFORE a structural commit holds the killed handle and fails
		// closed. The adapter re-derives it from the fresh token (useMark's useMemo
		// re-runs on the new token object) — the re-derived controller bridges by
		// the inherited id to the new live handle.
		const {store} = mountedSetup()
		store.value.current('different @[x]')
		const container = document.querySelector('div')!
		const text = document.createElement('span')
		const markEl = document.createElement('span')
		markEl.append(document.createTextNode('x'))
		container.replaceChildren(text, markEl)
		store.host.rendered()

		const freshToken = store.tokens.tokens().find(t => t.type === 'mark')!
		const controller = MarkController.fromToken(store, freshToken)
		expect(controller.update({value: 'probe'})).toBe(true)
		expect(store.value.current()).toBe('different @[probe]')
	})
```

Also AMEND the `update() after a preceding text edit mutates the shifted (correct) range` case and its siblings (`remove() after`, `survives several consecutive text-path commits`): these capture the controller, then text-edit (TEXT path — the handle is NOT killed, only `update()`d in place), then mutate. Under handle-backing the SAME handle survives a text-path commit (`update(token, path)` refreshes `#token` without killing), so `handle.token()` is the shifted mark and these cases STAY GREEN unchanged. VERIFY by running — if green, leave them. Their `expect(store.tokens.handleOf(token)?.token())` line (line ~147) references `handleOf`, which Task 5 deletes; for NOW `handleOf` still exists, so it passes. Task 5's grep will catch it — migrate that assertion line to `store.tokens.handle(token.id!)?.token()` in Task 5, NOT here (keep this task's diff to MarkController + its spec).

- [ ] **Step 5: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean — `MarkController` no longer references `TokenAddress`/`MarkSnapshot`/`resolvePath`. `MarkController.remove`/`update` returning `boolean` is a widening (callers ignore the return today); verify no caller relied on `void`. The adapter `useMark` returns the controller as-is (no return-type assertion).

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor(tokens): re-back MarkController by a handle — live reads, fail-closed no-op" -- packages/core/src/features/tokens/MarkController.ts packages/core/src/features/tokens/MarkController.spec.ts
```

---

### Task 4: Re-back SelectionController on handles — `placeAtHandle`, `#preferredHandle`

**Files:**
- Modify: `packages/core/src/features/selection/SelectionController.ts`

`SelectionController` carries two copies of the validity idiom (`#resolveAddress`, `#applyPreferredAddress`) and a `placeAtAddress` entry point. All three collapse onto a handle. `#preferredAddress` becomes `#preferredHandle`. `placeAtAddress(address, boundary)` becomes `placeAtHandle(handle, boundary)`.

- [ ] **Step 1: Run the selection baseline**

Run: `pnpm -w exec vitest run --project core SelectionController.spec`
Expected: full pass (the pre-change baseline).

- [ ] **Step 2: Migrate the imports**

In `SelectionController.ts`, change line 3 from:

```ts
import type {Range, RawSelection, TokenAddress} from '../../shared/editorContracts'
```

to:

```ts
import type {Range, RawSelection} from '../../shared/editorContracts'
```

Add an import of `TokenHandle` (it is exported from `'../tokens'` — verify: `tokens/index.ts` `export {TokenHandle}`). The file imports `type {TokenModel} from '../tokens'` on line 10; extend it:

```ts
import type {TokenHandle, TokenModel} from '../tokens'
```

- [ ] **Step 3: Migrate `#preferredAddress` → `#preferredHandle`**

Change line 28 from:

```ts
	#preferredAddress: TokenAddress | undefined
```

to:

```ts
	#preferredHandle: TokenHandle | undefined
```

- [ ] **Step 4: Migrate `focusFirst`**

Change `focusFirst` (~line 65) from:

```ts
	focusFirst(): void {
		const first = this.tokens.at(0)
		if (first && this.placeAtAddress({path: [0], token: first}, 'start')) return
		this.host.container()?.focus()
	}
```

to:

```ts
	focusFirst(): void {
		const first = this.tokens.at(0)
		const handle = first?.id !== undefined ? this.tokens.handle(first.id) : undefined
		if (handle && this.placeAtHandle(handle, 'start')) return
		this.host.container()?.focus()
	}
```

- [ ] **Step 5: Migrate `placeAtAddress` → `placeAtHandle`**

Change `placeAtAddress` (~line 75) from:

```ts
	placeAtAddress(address: TokenAddress, boundary: 'start' | 'end' = 'start'): boolean {
		const resolved = this.#resolveAddress(address, boundary)
		if (!resolved) return false
		if (!this.range(resolved)) this.#applyRange()
		return true
	}
```

to:

```ts
	placeAtHandle(handle: TokenHandle, boundary: 'start' | 'end' = 'start'): boolean {
		const resolved = this.#resolveHandle(handle, boundary)
		if (!resolved) return false
		if (!this.range(resolved)) this.#applyRange()
		return true
	}
```

- [ ] **Step 6: Migrate `#resolveAddress` → `#resolveHandle`**

Change `#resolveAddress` (~line 107) from:

```ts
	#resolveAddress(address: TokenAddress, boundary: 'start' | 'end'): Range | undefined {
		// Mount-check via the bound layer, identity via the id bridge: a stale
		// tree() token resolves to its live handle, a replaced or foreign one
		// fails closed (handleOf is also latch-gated through structural windows).
		const handle = this.tokens.handleFor(address)
		if (!handle || this.tokens.handleOf(address.token) !== handle) return undefined
		const position = handle.token().position
		const pos = boundary === 'end' ? position.end : position.start
		this.#preferredAddress = address
		return {start: pos, end: pos}
	}
```

to:

```ts
	#resolveHandle(handle: TokenHandle, boundary: 'start' | 'end'): Range | undefined {
		// The handle IS the identity AND the mount check: a live handle's token()
		// carries current positions; a dead or mid-window handle fails closed.
		if (!handle.alive()) return undefined
		const position = handle.token().position
		const pos = boundary === 'end' ? position.end : position.start
		this.#preferredHandle = handle
		return {start: pos, end: pos}
	}
```

- [ ] **Step 7: Migrate `#applyPreferredAddress` → `#applyPreferredHandle`**

Change `#applyPreferredAddress` (~line 119) from:

```ts
	#applyPreferredAddress(rawPosition: number): boolean {
		const address = this.#preferredAddress
		this.#preferredAddress = undefined
		if (!address) return false
		const handle = this.tokens.handleFor(address)
		if (!handle || this.tokens.handleOf(address.token) !== handle) return false
		return this.tokens.placeCaret({address, offset: rawPosition - handle.token().position.start})
	}
```

to:

```ts
	#applyPreferredHandle(rawPosition: number): boolean {
		const handle = this.#preferredHandle
		this.#preferredHandle = undefined
		if (!handle || !handle.alive()) return false
		return this.tokens.placeCaret({handle, offset: rawPosition - handle.token().position.start})
	}
```

- [ ] **Step 8: Update the `#placeCollapsed` caller**

Change `#placeCollapsed` (~line 128) from:

```ts
	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredAddress(rawPosition)) return true
		return this.tokens.placeCaret(rawPosition)
	}
```

to:

```ts
	#placeCollapsed(rawPosition: number): boolean {
		if (this.#applyPreferredHandle(rawPosition)) return true
		return this.tokens.placeCaret(rawPosition)
	}
```

(This task calls `this.tokens.placeCaret({handle, offset})` — the handle form. `placeCaret` still has the ADDRESS form until Task 6; this is a forward reference. Sequencing: Task 6 adds the handle form to `placeCaret` BEFORE this code runs in the suite. To keep THIS task green standalone, Task 6 must land first OR this task temporarily keeps the address form. **Resolution: reorder — do Task 6 (placeCaret handle form) conceptually first.** Since the plan is executed in order, MOVE the `placeCaret` handle-form change into THIS task as Step 8b below, then Task 6 only deletes the address form. This keeps each task green.)

- [ ] **Step 8b: Add the handle form to `placeCaret` (so this task is green standalone)**

In `TokenModel.ts`, change the `placeCaret` signature and address-branch (~line 384) from:

```ts
	placeCaret(target: number | {address: TokenAddress; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		// Id-bridged resolution: the address's token may be a stale tree() object
		// after text-path commits — accept it iff its identity currently lives at
		// the addressed path. handleOf's latch gate keeps this fail-closed while
		// a structural apply awaits its bind.
		const handle = this.handleFor(target.address)
		if (!handle || this.handleOf(target.address.token) !== handle) return false
		const bindings = handle.node()
		if (!bindings) return false
```

to:

```ts
	placeCaret(target: number | {handle: TokenHandle; offset: number}): boolean {
		if (typeof target === 'number') return this.#placeAtRawPosition(target)

		// The handle IS the resolution: a live handle carries the current bindings;
		// a dead or mid-window handle fails closed.
		const handle = target.handle
		if (!handle.alive()) return false
		const bindings = handle.node()
		if (!bindings) return false
```

(The rest of `placeCaret`'s body — `handle.token().type === 'mark' && !bindings.textElement` etc. — is unchanged: it already reads `handle`, not `target.address`. Just verify lines ~396-405 reference `handle`/`bindings`/`target.offset` and not `target.address`.)

- [ ] **Step 9: Run selection + facade + caret specs**

Run: `pnpm -w exec vitest run --project core SelectionController.spec`
Expected: full pass.

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass (the placeCaret handle form preserves the facade's caret placement).

Run: `pnpm -w exec vitest run --project core caret.spec`
Expected: full pass.

- [ ] **Step 10: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass.

Run: `pnpm run typecheck`
Expected: clean. (`SelectionController` no longer references `TokenAddress`/`handleFor`/`handleOf`. `placeCaret`'s address form is gone — its only external caller was `#applyPreferredAddress`, now migrated. `TokenModel` still has `handleFor`/`handleOf` for the OTHER callers, deleted in Task 5.)

- [ ] **Step 11: Commit**

```bash
git commit -m "refactor(selection): placeAtHandle/#preferredHandle; placeCaret handle form" -- packages/core/src/features/selection/SelectionController.ts packages/core/src/features/tokens/model/TokenModel.ts
```

---

### Task 5: Migrate the keyboard call sites; delete `handleFor`/`handleOf`

**Files:**
- Modify: `packages/core/src/features/keyboard/arrowNav.ts`
- Modify: `packages/core/src/features/keyboard/blockEdit.ts`
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (delete `handleFor`/`handleOf`; tidy imports)
- Modify: `packages/core/src/features/tokens/MarkController.spec.ts` (the lone `handleOf` assertion line in the identity-bridge describe)
- Modify: `packages/core/src/features/tokens/model/TokenModel.spec.ts` (`handleFor`/`handleOf` spec reads)
- Modify: `packages/core/src/features/tokens/TokenHandle.spec.ts` (`handleFor` spec reads)
- Modify: `packages/core/src/features/tokens/TokenModel.index.spec.ts` (`handleFor` spec reads)

The keyboard consumers are the last `placeAtAddress`/`handleOf` production callers. After they migrate, `handleFor` and `handleOf` have zero production references and are deleted; the specs that probe them migrate to `handle(id)`/`placeAtHandle`.

- [ ] **Step 1: `arrowNav.ts`**

In `shiftFocus` (~line 50-61), the current code resolves a sibling token by path then calls `placeAtAddress`. Replace the tail (from `const path = address.path` through the `return store.selection.placeAtAddress(...)`) — read the current lines 35, 50-61:

```ts
	const isFocusedOnMarkElement = active === handle.element() && !handle.hasTextSurface()
	const address = handle.address()
	// The handle IS the fresh read: its token carries current positions.
	const token = handle.token()
```

`handle.address()` is now the deprecated snapshot (still works); but we want the PATH. Change line 36 from:

```ts
	const address = handle.address()
```

to:

```ts
	const path = handle.path()
```

Then change the sibling-resolution tail (~lines 50-61) from:

```ts
	const path = address.path
	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const sibling = resolvePath(store.tokens.tokens(), siblingPath)
	if (!sibling) return false

	event.preventDefault()
	// Address-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries. (The sibling rides along for
	// placeAtAddress's identity check; tokens() makes it the fresh object.)
	return store.selection.placeAtAddress({path: siblingPath, token: sibling}, direction === 'prev' ? 'end' : 'start')
```

to:

```ts
	const siblingIndex = direction === 'prev' ? path[path.length - 1] - 1 : path[path.length - 1] + 1
	const siblingPath = [...path.slice(0, -1), siblingIndex]
	const sibling = resolvePath(store.tokens.tokens(), siblingPath)
	if (!sibling || sibling.id === undefined) return false
	const siblingHandle = store.tokens.handle(sibling.id)
	if (!siblingHandle) return false

	event.preventDefault()
	// Handle-based placement disambiguates the sibling from any neighbouring
	// token that shares a boundary position. Position-only placement would pick
	// the wrong token at text↔mark boundaries. The sibling's id bridges to its
	// live handle; placeAtHandle reads the handle's current positions.
	return store.selection.placeAtHandle(siblingHandle, direction === 'prev' ? 'end' : 'start')
```

(`resolvePath` import on line 4 STAYS — still used to find the sibling token by path. `handle.path()` replaces `handle.address().path`; line 36 was the only `address` use.)

- [ ] **Step 2: `blockEdit.ts` — `focusRow`**

In `focusRow` (~line 154-165), change from:

```ts
function focusRow(store: KbCtx, token: Token, rowIndex: number, caret: 'start' | 'end'): void {
	if (token.type === 'mark') {
		// A row's path is its index by construction; the (fresh) token rides
		// along for placeAtAddress's identity check.
		if (store.selection.placeAtAddress({path: [rowIndex], token}, caret)) return
	}

	const row = rowHandle(store, rowIndex)
	if (!row) return
	row.focus()
	row.placeCaret(caret === 'start' ? 0 : Infinity)
}
```

to:

```ts
function focusRow(store: KbCtx, token: Token, rowIndex: number, caret: 'start' | 'end'): void {
	if (token.type === 'mark' && token.id !== undefined) {
		// Bridge the row token by its id to its live handle; placeAtHandle reads
		// the handle's current positions to disambiguate a shared boundary.
		const handle = store.tokens.handle(token.id)
		if (handle && store.selection.placeAtHandle(handle, caret)) return
	}

	const row = rowHandle(store, rowIndex)
	if (!row) return
	row.focus()
	row.placeCaret(caret === 'start' ? 0 : Infinity)
}
```

(`rowHandle` already uses `store.tokens.handleOf(row)` at line 28 — change that too, next step.)

- [ ] **Step 3: `blockEdit.ts` — `rowHandle` (the last `handleOf` production caller)**

In `rowHandle` (~line 23-29), change from:

```ts
function rowHandle(store: KbCtx, rowIndex: number): TokenHandle | undefined {
	// Row identity from the fresh reconciled tree, liveness from the id bridge:
	// tokens() carries the current row object; handleOf maps it to the live
	// handle (undefined while a structural apply is unbound — fail-closed).
	const row = store.tokens.at(rowIndex)
	return row ? store.tokens.handleOf(row) : undefined
}
```

to:

```ts
function rowHandle(store: KbCtx, rowIndex: number): TokenHandle | undefined {
	// Row identity from the fresh reconciled tree, liveness from the id bridge:
	// at(i) carries the current row object; handle(id) maps it to the live handle
	// (undefined while a structural apply is unbound — fail-closed).
	const row = store.tokens.at(rowIndex)
	return row?.id !== undefined ? store.tokens.handle(row.id) : undefined
}
```

- [ ] **Step 4: Verify zero production `handleFor`/`handleOf` references remain**

Run:

```bash
grep -rn "handleFor\|handleOf" packages/core/src --include="*.ts" | grep -v "\.spec\."
```

Expected: ONLY the `TokenModel.ts` METHOD DEFINITIONS (`handleFor(address)` ~line 194, `handleOf(token)` ~line 218) and any JSDoc mentioning them. ZERO call sites. If a call site remains, migrate it before deleting.

- [ ] **Step 5: Delete `handleFor` and `handleOf` from `TokenModel.ts`**

Delete the entire `handleFor` method (~lines 193-196):

```ts
	/** Live handle of the token bound at `address.path`, or undefined if not bound. */
	handleFor(address: TokenAddress): TokenHandle | undefined {
		return this.#pipeline.byPath().get(pathKey(address.path))
	}
```

Delete the entire `handleOf` method (~lines 209-223, the JSDoc block + body):

```ts
	/**
	 * Bridge a (possibly stale) token object to its live handle via the stable
	 * identity id. Fails closed while a structural apply awaits its bind — the
	 * node layer is one generation stale there, and handing out a handle would
	 * let mutations act on a tree the DOM never showed. `handleFor`/`handleAt`
	 * stay ungated by design: they resolve through the CURRENT maps (address-
	 * and DOM-keyed, not stale-token-keyed), matching the old shell's behavior
	 * during the same window.
	 */
	handleOf(token: Token): TokenHandle | undefined {
		if (this.#pipeline.pending()) return undefined
		// Read-only id peek: probing a foreign token must not allocate an id.
		const id = this.#identity.idFor(token)
		return id === undefined ? undefined : this.#nodes.get(id)
	}
```

Now tidy the `tokenIndex` import (~line 16). `pathKey` was used ONLY by `handleFor`; `resolvePath` ONLY by `#resolveAddress` (deleted in Task 7 — but check: if Task 7 has not run yet, `#resolveAddress` still uses `resolvePath`). **Sequencing:** `#resolveAddress` is deleted in Task 7, so `resolvePath` is still used in `TokenModel.ts` until then. Change line 16 from:

```ts
import {pathEquals, pathKey, resolvePath} from '../tokenIndex'
```

to:

```ts
import {pathEquals, resolvePath} from '../tokenIndex'
```

(Drop only `pathKey` here — `resolvePath` survives until Task 7. `pathEquals` survives — `#childSequenceHostsFor`.) Verify `pathKey` has no other use in `TokenModel.ts`:

```bash
grep -n "pathKey" packages/core/src/features/tokens/model/TokenModel.ts
```

Expected: ZERO hits after the edit.

- [ ] **Step 6: Migrate the spec `handleFor`/`handleOf` reads**

In `TokenModel.index.spec.ts`:
- The `handleFor(address) returns the handle bound at that path` test (~line 81-87) probes `handleFor`. Rewrite it to `handle(id)`:

```ts
	it('handle(id) returns the handle for that token id', () => {
		const {store, container, span} = mountInline('hello')
		const id = store.tokens.tokens()[0].id!

		expect(store.tokens.handle(id)?.element()).toBe(span)
		container.remove()
	})
```

- The `handleAt and handleFor return undefined before any commit has run` test (~line 99-107): drop the `handleFor` line (it referenced `createTextToken`); keep the `handleAt` assertion. If `createTextToken` becomes an unused import after this, remove it:

```ts
	it('handleAt returns undefined before any commit has run', () => {
		const store = new Store()
		store.props.set({defaultValue: 'hello'})
		const span = document.createElement('span')

		expect(store.tokens.handleAt(span)).toBeUndefined()
	})
```

Then check `createTextToken` usage in the file:

```bash
grep -n "createTextToken" packages/core/src/features/tokens/TokenModel.index.spec.ts
```

If zero hits remain, delete its import line (`import {createTextToken} from './parser/utils/createTextToken'`).

In `TokenHandle.spec.ts`:
- `handles() yields one handle per bound token, handleFor returns the same object` (~line 74-86) — rewrite the `handleFor` half to `handle(id)`:

```ts
	it('handles() yields one handle per bound token, handle(id) returns the same object', () => {
		const {store} = mountInline('hello')

		// Call handles() BEFORE any handle(id)/handleAt — must still yield one handle
		const allBefore = [...store.tokens.handles()]
		expect(allBefore).toHaveLength(1)

		// handle(id) must return the SAME handle object already yielded by handles()
		const id = store.tokens.tokens()[0].id!
		const handle = store.tokens.handle(id)
		expect(handle?.path()).toEqual([0])
		expect(handle).toBe(allBefore[0])
	})
```

- The `kills handles whose token disappears` test (~line 111, 146) uses `handleFor({path:[1], token: ...})`. Replace each `store.tokens.handleFor({path: [1], token: store.tokens.tokens()[1]})` with `store.tokens.handle(store.tokens.tokens()[1].id!)`, and the `handleFor({path: [2], ...})` similarly with `handle(store.tokens.tokens()[2].id!)`.
- The `handle survives a structural shift` test (~line 158, 189): same replacements — `handleFor({path: [1], token: tokens()[1]})` → `handle(tokens()[1].id!)`; `handleFor({path: [2], token: tokens()[2]})` → `handle(tokens()[2].id!)`. The `handle.address().path` assertions (lines 179, 186) reference the deprecated `address()` snapshot — change them to `handle.path()` (line 179: `expect(handle.path()).toEqual([2])`) and `moved.previousAddress.path` (line 186) STAYS (the `moved` change still carries `previousAddress`).

In `TokenModel.spec.ts` (the `model/` one — `packages/core/src/features/tokens/model/TokenModel.spec.ts`), the `handleFor resolves by path and handles() iterates the bound layer` test is currently (lines ~232-240):

```ts
		it('handleFor resolves by path and handles() iterates the bound layer', () => {
			const {model, text2} = mountNewInline()

			expect(model.handleFor({path: [2], token: model.tokens()[2]})?.element()).toBe(text2)
			expect(model.handleFor({path: [9], token: model.tokens()[0]})).toBeUndefined()
			const all = [...model.handles()]
			expect(all).toHaveLength(3)
			expect(all.map(h => h.address().path)).toEqual([[0], [1], [2]])
		})
```

Rewrite it to (title + the two `handleFor` reads → `handle(id)`; the mismatched `{path: [9], token: tokens()[0]}` case becomes a non-existent id `999999` with the same "no handle" intent; the `h.address().path` map → `h.path()`):

```ts
		it('handle(id) resolves by token id and handles() iterates the bound layer', () => {
			const {model, text2} = mountNewInline()

			expect(model.handle(model.tokens()[2].id!)?.element()).toBe(text2)
			expect(model.handle(999999)).toBeUndefined()
			const all = [...model.handles()]
			expect(all).toHaveLength(3)
			expect(all.map(h => h.path())).toEqual([[0], [1], [2]])
		})
```

- The nested-child case (~line 309): `model.handleFor({path: [1, 0], token: mark.children[0]})` → `model.handle(mark.children[0].id!)`.
- The `handleAt ... model.handleOf(model.tokens()[1])` assertion (~line 226): `model.handleOf(model.tokens()[1])` → `model.handle(model.tokens()[1].id!)`.

In `MarkController.spec.ts`:
- The `update() after a preceding text edit` case's sanity line (~line 147): `expect(store.tokens.handleOf(token)?.token()).not.toBe(token)` → `expect(store.tokens.handle(token.id!)?.token()).not.toBe(token)`.
- The `still fails closed once the mark is structurally removed` case (~line 197): `expect(store.tokens.handleOf(token)).toBeUndefined()` → `expect(store.tokens.handle(token.id!)).toBeUndefined()`.

- [ ] **Step 7: Run the affected specs**

Run each, expecting full pass:

```bash
pnpm -w exec vitest run --project core TokenModel.index.spec
pnpm -w exec vitest run --project core TokenHandle.spec
pnpm -w exec vitest run --project core "model/TokenModel.spec"
pnpm -w exec vitest run --project core MarkController.spec
```

- [ ] **Step 8: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass (`arrowNav`/`blockEdit` exercised via keyboard + storybook specs; full run covers them).

Run: `pnpm run typecheck`
Expected: clean — no `handleFor`/`handleOf` member on `TokenModel`; no `pathKey` import dangling.

Run: `grep -rn "handleFor\|handleOf" packages/core/src`
Expected: ZERO hits (production AND spec). Any remaining hit is a missed migration — fix it.

- [ ] **Step 9: Commit**

```bash
git commit -m "refactor(tokens): keyboard reads handle(id)/placeAtHandle; delete handleFor/handleOf" -- packages/core/src/features/keyboard/arrowNav.ts packages/core/src/features/keyboard/blockEdit.ts packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/TokenModel.index.spec.ts packages/core/src/features/tokens/TokenHandle.spec.ts packages/core/src/features/tokens/model/TokenModel.spec.ts packages/core/src/features/tokens/MarkController.spec.ts
```

---

### Task 6: Delete the dead `placeCaret` address branch references (cleanup)

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (confirm no `TokenAddress` remains in `placeCaret`; tidy the JSDoc)

Task 4 (Step 8b) already converted `placeCaret`'s signature to the handle form. This task is a verification + JSDoc tidy — `placeCaret`'s doc still describes the "address form". Make the doc match the handle form, and confirm `TokenAddress` no longer appears in `TokenModel.ts` except the import line (deleted in Task 8).

- [ ] **Step 1: Update the `placeCaret` JSDoc**

In `TokenModel.ts`, the `placeCaret` JSDoc (~lines 374-383) reads:

```ts
	/**
	 * Place a collapsed caret. Number form resolves the best target (text
	 * surface containing the position, else a mark boundary exactly there);
	 * address form targets a specific token (callers use it to disambiguate
	 * tokens sharing a boundary position).
	 *
	 * **Address form — `offset` for mark tokens without a text surface:**
	 * `offset <= 0` selects the start child boundary of the token element,
	 * `offset > 0` the end — a binary selector, not a character offset.
	 */
```

Replace with:

```ts
	/**
	 * Place a collapsed caret. Number form resolves the best target (text
	 * surface containing the position, else a mark boundary exactly there);
	 * handle form targets a specific token's live handle (callers use it to
	 * disambiguate tokens sharing a boundary position).
	 *
	 * **Handle form — `offset` for mark tokens without a text surface:**
	 * `offset <= 0` selects the start child boundary of the token element,
	 * `offset > 0` the end — a binary selector, not a character offset.
	 */
```

- [ ] **Step 2: Confirm `TokenAddress` is gone from the body**

Run:

```bash
grep -n "TokenAddress\|target.address\|\.address(" packages/core/src/features/tokens/model/TokenModel.ts
```

Expected: ONLY the line-1 import (`import type {DomRef, RawSelection, TokenAddress, TokenPath} ...`) and possibly `#resolveAddress`/`#viewOf` (migrated in Task 7) — but NO `target.address` and NO `placeCaret` body reference. If `placeCaret` still references `target.address`, Task 4 Step 8b was incomplete — fix it.

- [ ] **Step 3: Typecheck + the caret/facade specs**

Run: `pnpm run typecheck`
Expected: clean.

Run: `pnpm -w exec vitest run --project core caret.spec`
Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass each.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(tokens): placeCaret JSDoc — handle form" -- packages/core/src/features/tokens/model/TokenModel.ts
```

---

### Task 7: Re-back the boundary facade on the handle — delete `#resolveAddress`, `address` views

**Files:**
- Modify: `packages/core/src/features/tokens/boundary.ts` (`TokenView.address` → `TokenView.token`; `resolveAddress` → `tokenOf`)
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (`#view`, `#resolveAddress` delete, `#viewOf`, `#boundaryContext`)

The boundary facade carries `address` per view and re-checks it against `tokens()`. Both derive from the live handle, so they collapse onto the handle's fresh token. This is the last internal `TokenAddress` user in core; after it, only the type definition + public export remain (Task 8).

- [ ] **Step 1: Capture the facade baseline**

Run: `pnpm -w exec vitest run --project core TokenModel.facade.spec`
Expected: full pass (the behavior this task must preserve byte-for-byte).

- [ ] **Step 2: Re-shape `TokenView` and `BoundaryContext` in `boundary.ts`**

In `boundary.ts`, change the import (line 1) from:

```ts
import type {TokenAddress} from '../../shared/editorContracts'
```

to: (delete it — `boundary.ts` no longer needs `TokenAddress`; it already imports `Token`)

```ts
```

(Remove the line entirely. Verify `Token` is imported — line 3 `import type {Token} from './parser/types'` stays.)

Change `TokenView` (lines 6-14) from:

```ts
/** A bound token as the facade reads it: fresh address over the live DOM bindings, plus the handle itself. */
export type TokenView = {
	readonly handle: TokenHandle
	readonly address: TokenAddress
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}
```

to:

```ts
/** A bound token as the facade reads it: the fresh current token over the live DOM bindings, plus the handle itself. */
export type TokenView = {
	readonly handle: TokenHandle
	readonly token: Token
	readonly tokenElement: HTMLElement
	readonly textElement?: HTMLElement
	readonly rowElement?: HTMLElement
	readonly childSequenceHost?: HTMLElement
}
```

Change `BoundaryContext` (lines 18-32) from:

```ts
export type BoundaryContext = {
	container: HTMLElement | undefined
	tokens: readonly Token[]
	/**
	 * Fail-closed address check: the address's token object must still sit at
	 * its path in the CURRENT tree. Views carry fresh tokens by construction,
	 * so this only rejects during the structural reconcile → bind window
	 * (node layer one generation stale) and for foreign addresses.
	 */
	resolveAddress(address: TokenAddress): Token | undefined
	/** Id-bridged view of a current-tree token's bound node, if any. */
	viewOf(token: Token): TokenView | undefined
	locate(node: Node): Lookup | undefined
	nodes(): IterableIterator<TokenView>
}
```

to:

```ts
export type BoundaryContext = {
	container: HTMLElement | undefined
	tokens: readonly Token[]
	/**
	 * The view's fresh current token, or `undefined` if its handle is no longer
	 * live. Views carry `handle.token()` by construction, so this only rejects
	 * during the structural reconcile → bind window (the node layer is one
	 * generation stale) and for killed handles.
	 */
	tokenOf(view: TokenView): Token | undefined
	/** Id-bridged view of a current-tree token's bound node, if any. */
	viewOf(token: Token): TokenView | undefined
	locate(node: Node): Lookup | undefined
	nodes(): IterableIterator<TokenView>
}
```

- [ ] **Step 3: Migrate `boundary.ts`'s `resolveAddress` call sites to `tokenOf`**

There are 5 call sites in `boundary.ts` (grep-verified): `rawPositionFromBoundary` (line 48), `fromTokenChildBoundary` (lines 116, 117), `textTargetAt` (line 139), `markBoundaryAt` (line 155). Each takes a `node.address` / `before.address` / `after.address` and returns the resolved token. Replace each `ctx.resolveAddress(X.address)` with `ctx.tokenOf(X)`:

- Line 48 — change `const token = ctx.resolveAddress(lookup.node.address)` to `const token = ctx.tokenOf(lookup.node)`.
- Lines 116-117 — change:

```ts
		const beforeToken = ctx.resolveAddress(before.address)
		const afterToken = ctx.resolveAddress(after.address)
```

to:

```ts
		const beforeToken = ctx.tokenOf(before)
		const afterToken = ctx.tokenOf(after)
```

- Line 139 (`textTargetAt`) — change `const resolved = ctx.resolveAddress(node.address)` to `const resolved = ctx.tokenOf(node)`. Also update the `Pick` type on line 133 from `Pick<BoundaryContext, 'nodes' | 'resolveAddress'>` to `Pick<BoundaryContext, 'nodes' | 'tokenOf'>`.
- Line 155 (`markBoundaryAt`) — change `const resolved = ctx.resolveAddress(node.address)` to `const resolved = ctx.tokenOf(node)`. Update its `Pick` on line 151 from `Pick<BoundaryContext, 'nodes' | 'resolveAddress'>` to `Pick<BoundaryContext, 'nodes' | 'tokenOf'>`.

(The `textTarget`/`markBoundaryAt` callers in `TokenModel.ts` — `#placeAtRawPosition`, `selectRange` — pass `this.#boundaryContext()`, which still satisfies the narrowed `Pick`. No change there.)

- [ ] **Step 4: Migrate `TokenModel.ts`'s `#view`/`#viewOf`/`#boundaryContext`; delete `#resolveAddress`**

In `TokenModel.ts`, change `#view` (~lines 258-263) from:

```ts
	/** View of a handle for the boundary facade: fresh address over the live bindings. */
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, address: handle.address(), ...bindings}
	}
```

to:

```ts
	/** View of a handle for the boundary facade: the fresh current token over the live bindings. */
	#view(handle: TokenHandle): TokenView | undefined {
		const bindings = handle.node()
		if (!bindings) return undefined
		return {handle, token: handle.token(), ...bindings}
	}
```

Delete the entire `#resolveAddress` method (~lines 272-281):

```ts
	/**
	 * Fail-closed address check against the CURRENT reconciled tree (path AND
	 * object identity must match). Node-layer views carry fresh token objects,
	 * so this only rejects while a structural apply awaits its bind (the layer
	 * is one generation stale) and for foreign or removed addresses.
	 */
	#resolveAddress(address: TokenAddress): Token | undefined {
		const current = resolvePath(this.tokens(), address.path)
		return current === address.token ? current : undefined
	}
```

Add, in its place, a `#tokenOf` returning the view's fresh token while live (the handle's `node()` is non-undefined for a bound view, so a view in hand is already live; the `undefined` case is the mid-window/killed handle, which `#view` already excludes by returning `undefined`). The replacement is trivial — the view ALREADY carries the fresh token:

```ts
	/** The view's fresh current token while its handle is live (views are built from live handles, so this is total for an in-hand view). */
	#tokenOf(view: TokenView): Token | undefined {
		return view.handle.alive() ? view.token : undefined
	}
```

Change `#boundaryContext` (~lines 290-299) from:

```ts
	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.tokens(),
			resolveAddress: address => this.#resolveAddress(address),
			viewOf: token => this.#viewOf(token),
			locate: node => this.#locate(node),
			nodes: () => this.#views(),
		}
	}
```

to:

```ts
	#boundaryContext(): BoundaryContext {
		return {
			container: this.host.container() ?? undefined,
			tokens: this.tokens(),
			tokenOf: view => this.#tokenOf(view),
			viewOf: token => this.#viewOf(token),
			locate: node => this.#locate(node),
			nodes: () => this.#views(),
		}
	}
```

`#viewOf` (~lines 283-288) stays — but it currently id-bridges via `this.#identity.idFor(token)`. Replace that peek with `token.id` (the plain field) and `this.handle(token.id)` for consistency, since `handle(id)` is now the lookup:

```ts
	/** Id-bridged view of a current-tree token's bound node (boundary internals). */
	#viewOf(token: Token): TokenView | undefined {
		const handle = token.id === undefined ? undefined : this.handle(token.id)
		return handle ? this.#view(handle) : undefined
	}
```

Now tidy `resolvePath` import — `#resolveAddress` was its last user in `TokenModel.ts`. Run:

```bash
grep -n "resolvePath" packages/core/src/features/tokens/model/TokenModel.ts
```

If ZERO hits remain, change line 16 from `import {pathEquals, resolvePath} from '../tokenIndex'` to `import {pathEquals} from '../tokenIndex'`.

- [ ] **Step 5: Run the facade + caret + selection specs**

Run, expecting full pass each:

```bash
pnpm -w exec vitest run --project core TokenModel.facade.spec
pnpm -w exec vitest run --project core caret.spec
pnpm -w exec vitest run --project core SelectionController.spec
pnpm -w exec vitest run --project core TokenModel.spec
```

- [ ] **Step 6: Full core suite + typecheck**

Run: `pnpm -F core test`
Expected: full pass — the boundary resolves the same fresh tokens, now via `view.token` instead of the address round-trip.

Run: `pnpm run typecheck`
Expected: clean — `boundary.ts` and `TokenModel.ts` no longer reference `TokenAddress`/`resolveAddress`. Any spec or helper that constructed a `TokenView` literal with `address:` (search `boundary.spec` if it exists) must switch to `token:` — grep:

```bash
grep -rn "address:" packages/core/src/features/tokens --include="*.spec.ts"
```

Expected: ZERO hits constructing a `TokenView`/address literal (the `MarkInfo` `address:` lives in adapters, not core specs). Fix any core-spec TokenView literal to `token:`.

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(tokens): boundary facade reads view.token; delete #resolveAddress" -- packages/core/src/features/tokens/boundary.ts packages/core/src/features/tokens/model/TokenModel.ts
```

---

### Task 8: Delete `TokenAddress` from `editorContracts`; re-shape `MarkInfo`; drop the public export

**Files:**
- Modify: `packages/core/src/shared/editorContracts.ts` (delete `TokenAddress`; re-shape `MarkInfo`)
- Modify: `packages/core/index.ts` (drop the `TokenAddress` export)
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (drop the `TokenAddress` import)

With every internal user migrated, `TokenAddress` the TYPE is deleted. `MarkInfo` loses its `address` field and gains `id`/`path`.

- [ ] **Step 1: Verify zero `TokenAddress` references in core (except the definition + exports)**

Run:

```bash
grep -rn "TokenAddress" packages/core/src
```

Expected: ONLY `editorContracts.ts` (the `type TokenAddress` definition + the `MarkInfo.address` field). If `TokenModel.ts` line 1 still imports it, that is expected (removed in Step 4). NO other `src` file. If `boundary.ts`/`LiveNode.ts`/`MarkController.ts`/`SelectionController.ts` still reference it, a prior task is incomplete — fix before proceeding.

- [ ] **Step 2: Delete `TokenAddress` and re-shape `MarkInfo` in `editorContracts.ts`**

In `editorContracts.ts`, delete (lines 5-8):

```ts
export type TokenAddress = {
	readonly path: TokenPath
	readonly token: Token
}
```

Re-shape `MarkInfo` (lines 37-42) from:

```ts
export type MarkInfo = {
	readonly address: TokenAddress
	readonly depth: number
	readonly hasNestedMarks: boolean
	readonly key: string
}
```

to:

```ts
export type MarkInfo = {
	/** The mark token's stable identity id (use with `store.tokens.handle(id)` for the live handle). */
	readonly id: number
	/** The mark's render-time tree path (one index per nesting level). */
	readonly path: TokenPath
	readonly depth: number
	readonly hasNestedMarks: boolean
	readonly key: string
}
```

The `Token` import on line 1 (`import type {Token} from '../features/tokens/parser/types'`) was used by `TokenAddress`. Check if `MarkInfo`/anything else still needs it:

```bash
grep -n "Token\b" packages/core/src/shared/editorContracts.ts
```

If `Token` is now unused (only `TokenPath` referenced), delete line 1. If still used, keep it. (`TokenPath` is defined locally in this file — line 3 — so `MarkInfo.path: TokenPath` needs no import.)

- [ ] **Step 3: Drop the `TokenAddress` public export**

In `packages/core/index.ts`, in the `editorContracts` type re-export block (~lines 22-31), delete the `TokenAddress,` line:

```ts
export type {
	TokenPath,
	Range,
	RawSelection,
	MarkPatch,
	MarkSnapshot,
	MarkInfo,
} from './src/shared/editorContracts'
```

(`TokenPath` STAYS — the providers, `MarkInfo.path`, and `handle.path()` use it.)

- [ ] **Step 4: Drop the `TokenAddress` import from `TokenModel.ts`**

In `TokenModel.ts`, change line 1 from:

```ts
import type {DomRef, RawSelection, TokenAddress, TokenPath} from '../../../shared/editorContracts'
```

to:

```ts
import type {DomRef, RawSelection, TokenPath} from '../../../shared/editorContracts'
```

- [ ] **Step 5: Typecheck — the breaking surface surfaces in the adapters**

Run: `pnpm run typecheck`
Expected: the CORE typechecks clean. The ADAPTERS (`packages/react/markput`, `packages/vue/markput`) FAIL — `TokenContext.ts` and `tokenKey.ts` import `TokenAddress` from `@markput/core`, and `useMarkInfo` builds the old `MarkInfo` shape. THIS IS THE PREDICTED RED — Task 9 fixes the adapters. (If core itself fails, a reference was missed — fix in core before moving on. Distinguish: core errors mention `packages/core/...`; adapter errors mention `packages/react/...`/`packages/vue/...`.)

- [ ] **Step 6: Commit the core half**

```bash
git commit -m "feat(core)!: delete TokenAddress; MarkInfo ships id/path (semver-major)" -- packages/core/src/shared/editorContracts.ts packages/core/index.ts packages/core/src/features/tokens/model/TokenModel.ts
```

(The `!` marks the breaking change. The adapters are red until Task 9 — committed together as the semver-major cut spans both, but path-scoped here to keep the core change atomic and reviewable. The branch is not green between Task 8 and Task 9; that is acceptable WITHIN the semver-major boundary — note it in the Task 9 handoff.)

---

### Task 9: Re-shape the adapters — `useMarkInfo` ships `id`/`path`, drop the staleness warning

**Files:**
- Modify: `packages/react/markput/src/lib/providers/TokenContext.ts` (drop `TokenAddress`; carry `{path, token}` via local types)
- Modify: `packages/vue/markput/src/lib/providers/tokenKey.ts` (same)
- Modify: `packages/react/markput/src/lib/hooks/useMarkInfo.tsx` (ship `id`/`path`; delete the staleness warning)
- Modify: `packages/vue/markput/src/lib/hooks/useMarkInfo.ts` (same)

The adapters provided a `TokenAddress` (`{path, token}`) at render time and `useMarkInfo` returned it as `MarkInfo.address`. Now `MarkInfo` ships `id`/`path` instead, derived from the render-time path the provider already carries. The providers switch from the deleted `TokenAddress` to local `{path, token}` shapes (`TokenPath` + `Token`, both still exported from core).

- [ ] **Step 1: React `TokenContext.ts`**

Replace the contents of `packages/react/markput/src/lib/providers/TokenContext.ts` with:

```ts
import type {Store, Token, TokenPath} from '@markput/core'
import {createContext, useContext} from 'react'

export type TokenContextValue = {
	readonly store: Store
	readonly token: Token
	/** Render-time tree path: arrives from the tree map by construction (the parent knows each child's index). */
	readonly path: TokenPath
}

export const TokenContext = createContext<TokenContextValue | undefined>(undefined)
TokenContext.displayName = 'TokenProvider'

export function useToken(): Token {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value.token
}

export function useTokenContext(): TokenContextValue {
	const value = useContext(TokenContext)
	if (value === undefined) {
		throw new Error('Token not found. Make sure to wrap component in TokenContext.Provider.')
	}
	return value
}
```

(`address: TokenAddress` → `path: TokenPath`; the `Token` import stays. No trailing newline — match the original `.ts`.)

- [ ] **Step 2: React `Token.tsx` provider value**

In `packages/react/markput/src/components/Token.tsx`, the provider (~line 32) reads `<TokenContext value={{store, token, address: {path, token}}}>`. Change it to:

```tsx
		<TokenContext value={{store, token, path}}>
```

- [ ] **Step 3: React `useMarkInfo.tsx`**

Replace the contents of `packages/react/markput/src/lib/hooks/useMarkInfo.tsx` with:

```tsx
import type {MarkInfo} from '@markput/core'

import {useTokenContext} from '../providers/TokenContext'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const {token, path} = useTokenContext()
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
	if (token.id === undefined) throw new Error('useMarkInfo: mark token has no id (not reconciled)')

	return {
		id: token.id,
		path,
		// One path segment per nesting level: a top-level token has depth 0.
		depth: path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
		key: path.join('.'),
	}
}
```

(The staleness JSDoc warning is DELETED. `address.path` → `path`. `id` added.)

- [ ] **Step 4: Vue `tokenKey.ts`**

Replace the contents of `packages/vue/markput/src/lib/providers/tokenKey.ts` with:

```ts
import type {Token, TokenPath} from '@markput/core'
import type {InjectionKey, Ref} from 'vue'

/** Render-time token context: the path arrives from the tree map by construction. */
export type TokenContext = {readonly path: TokenPath; readonly token: Token}

export const TOKEN_KEY: InjectionKey<Ref<TokenContext>> = Symbol('MarkputToken')
```

(No trailing newline — match the original `.ts`. The injected value is still a `Ref<{path, token}>`; only the type name changes from `TokenAddress` to a local `TokenContext`.)

- [ ] **Step 5: Vue `Token.vue` provider value**

In `packages/vue/markput/src/components/Token.vue`, the provide (~line 24-26) reads `provide(TOKEN_KEY, toRef(() => ({path: props.path, token: props.token})))`. The shape is unchanged (`{path, token}`) — it now satisfies the local `TokenContext` type. No code change needed, but VERIFY it still typechecks (the `toRef` value `{path, token}` matches `TokenContext`). If `vue-tsc` flags it, no change is required beyond Step 4's type.

- [ ] **Step 6: Vue `useMarkInfo.ts`**

Replace the contents of `packages/vue/markput/src/lib/hooks/useMarkInfo.ts` with:

```ts
import type {MarkInfo} from '@markput/core'
import {inject} from 'vue'

import {TOKEN_KEY} from '../providers/tokenKey'

/** Mark metadata for the surrounding mark token context. */
export const useMarkInfo = (): MarkInfo => {
	const contextRef = inject(TOKEN_KEY)
	if (!contextRef) throw new Error('Token not found. Make sure to use useMarkInfo inside a Token provider.')

	const {path, token} = contextRef.value
	if (token.type !== 'mark') throw new Error('useMarkInfo must be called within a mark token context')
	if (token.id === undefined) throw new Error('useMarkInfo: mark token has no id (not reconciled)')

	return {
		id: token.id,
		path,
		// One path segment per nesting level: a top-level token has depth 0.
		depth: path.length - 1,
		hasNestedMarks: token.children.some(child => child.type === 'mark'),
		key: path.join('.'),
	}
}
```

(The staleness JSDoc warning is DELETED. `address.token`/`address.path` → `token`/`path`. `id` added. The `.ts` file has no trailing newline — match the original.)

- [ ] **Step 7: Check `useMark.ts` (vue) — it reads `addressRef.value.token`**

In `packages/vue/markput/src/lib/hooks/useMark.ts` (~line 17), it reads `const token = addressRef.value.token`. The injected value is still `{path, token}`, so `addressRef.value.token` is unchanged — VERIFY it typechecks under the renamed `TokenContext` type. The variable name `addressRef` is cosmetic; leave it or rename to `contextRef` for clarity (optional — if renaming, update both the `inject` assignment and the `.value.token` read). React `useMark.tsx` reads `const {store, token} = useTokenContext()` — `token` still exists on `TokenContextValue`, no change.

- [ ] **Step 8: Typecheck — now fully green**

Run: `pnpm run typecheck`
Expected: clean across ALL packages — core, react, vue. The adapters no longer import `TokenAddress`; `MarkInfo` consumers read `id`/`path`/`depth`/`hasNestedMarks`/`key`.

- [ ] **Step 9: Storybook page specs (the real adapter render path + MarkInfo consumers)**

Run: `pnpm -F storybook test`
Expected: full pass — `nested.react.spec.tsx`/`nested.vue.spec.ts` read `mark.depth`/`.hasNestedMarks`/`.key` (unchanged values: `depth = path.length - 1`, `key = path.join('.')` — identical to the old `address.path`-derived ones). No consumer read `.address`, so dropping it breaks nothing.

If iterating, isolate:

```bash
pnpm -F storybook test:react
pnpm -F storybook test:vue
```

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(adapters)!: useMarkInfo ships id/path; drop TokenAddress + staleness warning" -- packages/react/markput/src/lib/providers/TokenContext.ts packages/react/markput/src/components/Token.tsx packages/react/markput/src/lib/hooks/useMarkInfo.tsx packages/vue/markput/src/lib/providers/tokenKey.ts packages/vue/markput/src/components/Token.vue packages/vue/markput/src/lib/hooks/useMarkInfo.ts packages/vue/markput/src/lib/hooks/useMark.ts
```

(Include `useMark.ts` only if Step 7 renamed `addressRef`; otherwise drop it from the path list. Verify with `git status` before committing.)

---

### Task 10: Pin the MarkController live-read parity tables; update the README

**Files:**
- Modify: `packages/core/src/features/tokens/MarkController.spec.ts` (consolidate the parity tables into one labeled describe — documentation-as-test)
- Modify: `packages/core/src/features/tokens/README.md` (the §MarkController semantics block + the handle face)

Task 3 already added the live-read tests. This task LABELS them as THE parity tables the spec's §MarkController semantics names, ensuring the breaking contract is pinned and discoverable, and updates the README to the handle-backed model.

- [ ] **Step 1: Add the parity-table doc comment to the MarkController live-read describe**

In `MarkController.spec.ts`, add a leading doc comment above the `describe('MarkController live-read parity (handle-backed)', …)` block (added in Task 3):

```ts
/**
 * MarkController live-read parity tables (spec §MarkController semantics).
 *
 * The controller is HANDLE-BACKED: value/meta/slot/readOnly are LIVE reads of
 * the current token, not a frozen snapshot. The parity table:
 *
 *   read       | live source                          | mid-window / dead
 *   -----------|--------------------------------------|-------------------
 *   value      | handle.token().value                 | '' (no live mark)
 *   meta       | handle.token().meta                  | undefined
 *   slot       | handle.token().slot?.content         | undefined
 *   readOnly   | store.props.readOnly()               | (always live)
 *   update()   | mutate the live mark's range         | false (fail-closed)
 *   remove()   | replace the live mark's range with ''| false (fail-closed)
 *
 * SEMVER-MAJOR: a controller captured before a structural commit that kills its
 * handle no longer auto-bridges — it fails closed; the adapter re-derives it
 * from the fresh token (useMark's useMemo re-runs on the new token object).
 */
```

- [ ] **Step 2: Run MarkController.spec**

Run: `pnpm -w exec vitest run --project core MarkController.spec`
Expected: full pass (the comment is documentation; no behavior change).

- [ ] **Step 3: Update the README**

In `packages/core/src/features/tokens/README.md`, find the MarkController / handle-face sections (grep for `MarkController`, `address`, `handleFor`, `handleOf`, `TokenAddress`):

```bash
grep -n "MarkController\|TokenAddress\|handleFor\|handleOf\|address\|placeAtAddress\|alive\|path()" packages/core/src/features/tokens/README.md
```

For each hit:
- Replace any `handleFor(address)` / `handleOf(token)` / `TokenAddress` / `placeAtAddress` reference with the new surface: `handle(id)` + `handleAt(node)` are the two lookups; `placeAtHandle(handle)` / `placeCaret({handle, offset})` are the placements; the handle face is `{id, token(), path(), alive(), element(), …}`.
- If a "MarkController" section describes a captured snapshot/address, rewrite it to: "MarkController is handle-backed; `value`/`meta`/`slot`/`readOnly` are live reads of the current token; `update()`/`remove()` fail closed (return `false`) against a dead or mid-window handle."
- If a "handle resolution" / "four lookups" section exists, collapse it to the two survivors with a one-line note that the address surface was removed in Phase 4 (semver-major).

(Do NOT attempt the full ≤150-line README rewrite — that is the rolling rider. Keep edits surgical to the Phase-4 surface. If the README has no MarkController/lookup section to update, add a short "### Mark commands" block stating the handle-backed contract above.)

- [ ] **Step 4: Encapsulation guard + full core**

Run: `pnpm run check:encapsulation`
Expected: pass.

Run: `pnpm -F core test`
Expected: full pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(tokens): pin MarkController live-read parity tables; README handle-backed surface" -- packages/core/src/features/tokens/MarkController.spec.ts packages/core/src/features/tokens/README.md
```

---

### Task 11: Full verification

- [ ] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # full core suite — handle(id)/handleAt the only lookups; MarkController handle-backed; boundary on view.token
pnpm -F storybook test       # react + vue page specs incl. nested MarkInfo consumers (id/path/depth/key) + render-count/empty-row gates
pnpm run typecheck           # recursive tsc/vue-tsc — zero TokenAddress, zero handleFor/handleOf, MarkInfo ships id/path across all packages
pnpm run check:encapsulation
```

- [ ] **Step 2: Confirm the deletions and renames landed**

Run: `grep -rn "TokenAddress" packages/core/src packages/react/markput/src packages/vue/markput/src`
Expected: ZERO hits — the type is gone from definition, exports, internal users, and adapters.

Run: `grep -rn "handleFor\|handleOf\|#resolveAddress\|#resolveCaptured\|pathOf\|placeAtAddress" packages/core/src packages/react/markput/src packages/vue/markput/src`
Expected: ZERO hits — the four-lookup idiom, the captured-address fallback, the pathOf DFS, and placeAtAddress are deleted.

Run: `grep -rn "handle(\|placeAtHandle\|\.alive()\|\.path()" packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/selection/SelectionController.ts`
Expected: the new `handle(id)` lookup, `placeAtHandle`, `alive()`, and `path()` are present and used.

Run: `grep -rn "id:\|path:" packages/core/src/shared/editorContracts.ts`
Expected: `MarkInfo` now carries `id` and `path` (and no `address`).

- [ ] **Step 3: Confirm clean and report**

`git status` must be clean (everything committed task-by-task, path-scoped). Report: the core suite pass count, the storybook react/vue counts, and confirm typecheck + encapsulation guard green. State explicitly that `TokenAddress` is deleted (semver-major), `handle(id)` + `handleAt(node)` are the only two lookups, `MarkController` is handle-backed with live reads + fail-closed `update()`/`remove()` returning `false`, `placeCaret`/`placeAtHandle` take handles, `useMarkInfo` ships `id`/`path` (staleness warning gone), the boundary facade reads `view.token`, and the pending-window matrix holds (`handle(id)`/`handleAt(node)` fail closed mid-window; `tokens()` stays always-fresh from Phase 3).

---

### Task 12: Write the Phase 5 plan (phase chaining)

- [ ] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase5.md` for **Phase 5 — de-reactify + surface deletion (1–2 days)** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`, Phase 5): convert the handle getters from per-node reactive `Computed`s to PLAIN getters (the win-4 trade — "handle getters stay methods, so per-node signals can return behind them additively"); DELETE the dead surface members the spec's "What dies" table names (`tokenAt`, `handles()`, `caretFromPoint`, `handle.changed`/`.dead`/`.text`/`.caretRect`/`.placeCaretAtBoundary`, the now-deprecated `address()`) and the per-node dirty signals + reactive getters + isolation specs; replace the six selection micro-reads + the `!== false` tri-state (`readSelection`/`selectionRect`/`selectionAnchor`/`isSelectionCollapsed`/`selectionIntersects`/`selectionFocusNode`) with one `selection(): SelectionSnapshot | undefined` snapshot. Ground the plan by reading FIRST, with fresh eyes, the POST-Phase-4 code: `packages/core/src/features/tokens/model/LiveNode.ts` (the `dirty` signal, the `Computed` getters `token`/`address`/`element`/`text`, `dead`, and the now-added plain `path()`/`alive()`), `packages/core/src/features/tokens/model/TokenModel.ts` (`tokenAt`, `handles()`, `caretFromPoint`, the six selection micro-reads), the isolation specs (grep `dirty`/`isolation` under `packages/core/src/features/tokens`), and the selection consumers across core + the adapters that read the six micro-reads (`SelectionController`, `ClipboardController`, overlay). Decide the EXACT `SelectionSnapshot` shape and which of the six reads each consumer needs. No placeholder steps — every step shows exact code; bite-sized TDD; frequent path-scoped commits; the required plan header. The LAST task of the Phase 5 plan must be "write the Phase 6 plan" (phase chaining). Verification commands MUST follow this plan's Tech Stack note: `pnpm -F core test`, `pnpm -F storybook test` / `test:react` / `test:vue`, `pnpm run typecheck`, `pnpm run check:encapsulation` — NEVER `pnpm -F react test` or `pnpm -F vue test` (silent no-ops).

- [ ] **Step 2: Commit the plan**

```bash
git commit -m "docs(plan): one-fresh-truth phase 5 — de-reactify + surface deletion" -- docs/superpowers/plans/2026-06-13-one-fresh-truth-phase5.md
```
