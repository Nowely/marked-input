# One Fresh Truth — Phase 2: Reconcile-Side Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move routing and change-resolution from commit time to reconcile time. Reconcile already walks the tree pairing tokens; have it thread the `(id, token, path)` of every changed token through that same walk and emit one structural result `{tokens, structural, changes, removedIds}`. The commit pipeline then reads `changes` directly — deleting the O(tree) `collectChanged` DFS and the runtime escalation type-walk — and routes on reconcile's `structural` boolean (the commit-time `pendingStructural` fold guard STAYS, as the only commit-side override). The PUBLIC `changed` event becomes `Event<void>`; its one internal payload consumer (BlockController's prune watch) reads `removedIds` from a new internal accessor.

**Architecture:** Today `tokenIdentity.reconcile` emits `{tokens, changeset}` where `changeset` is the four id buckets (`textChanged`/`added`/`removed`/`updated`); commit.ts then re-derives `(token, path)` for each changed id with a fresh depth-first `collectChanged` walk of the output tree, and decides routing by sniffing `added.length === 0 && removed.length === 0` plus a per-id `entry.token.type !== 'text'` escalation check inside `commitText`. Phase 2 collapses both: reconcile owns the `(id, token, path)` triple because it is already at each token with its index path in hand (the prefix/suffix/middle walks and `tryDescend`/`pairSlotChildren` recursion), and reconcile already knows — from which bucket a token lands in — whether the change is structural. The new `ReconcileResult` is `{tokens, structural: boolean, changes: TokenChangeEntry[], removedIds: number[]}` where `TokenChangeEntry = {id, token, path, kind: 'text' | 'update' | 'add'}` (`kind` carries the routing semantics the buckets used to: `text` ⇔ patch a text surface, `update` ⇔ refresh node position only, `add` ⇔ a newly added subtree token forcing structural). `structural` is `true` iff any `add` change or any `removedIds` exists OR a refused-descend mark would have been `textChanged` (a mark in `text` kind escalates — reconcile sets `structural` for it directly, killing the commit-time type-walk). The commit text branch iterates `changes` with their paths already resolved; `commitStructural` is reached when `result.structural` (or the pending-fold guard) says so. Public `tokens.changed` drops to `Event<void>` — consumers re-read; BlockController's prune reads `tokens.removedIds()` (last commit's removed ids) inside its `void` watch.

**Tech Stack:** TypeScript, vitest in REAL Chromium browser mode. Run patterns: `pnpm -F core test` (full) or `pnpm -F core test -- <pattern>` (the pattern often does NOT filter through the pnpm wrapper — the full suite runs, just slower; that is fine). Storybook page specs (the react/vue projects): `pnpm -F storybook test` (full), `pnpm -F storybook test:react`, `pnpm -F storybook test:vue`; to filter: `pnpm -w exec vitest run --project react --project vue <pattern>`. **WARNING: `pnpm -F react test` and `pnpm -F vue test` are SILENT NO-OPS** — `@markput/react`/`@markput/vue` have NO test script; pnpm exits 0 with no output. The react/vue vitest projects ARE the storybook page specs above. Typecheck: `pnpm run typecheck`. Encapsulation guard: `pnpm run check:encapsulation`. Conventions: tabs, single quotes, no semicolons, `import type`, **no trailing newline at end of files**.

**Commits in a shared checkout:** other agents work concurrently in the SAME working tree on DISJOINT files. ALWAYS commit path-scoped: `git commit -m <message> -- <explicit paths>` (commits ONLY those paths even if other files are staged). NEVER `git add -A` / `git add .` / a bare `git commit`. On an `index.lock` error, wait ~2s and retry up to 5 times.

**Spec:** `docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md` (Phase 2; §Internal changeset; "What dies" → "Escalation-as-routing + `collectChanged` O(tree) DFS").

**Background facts (probe-verified against post-Phase-1 code, do not re-derive):**
- **`reconcile`'s walk already visits every changed token at its path.** The prefix walk (`tokenIdentity.ts` ~line 244), suffix walk (~257), and middle loop (~289) iterate `out`/`next` by top-level index `i` — that index IS the top-level path component. `tryDescend` (~141) and `pairSlotChildren` (~189) recurse into slot children by their local index; threading a `basePath` through them reconstructs each child's full path with zero extra walk. The four buckets are filled at exactly these sites: `textChanged.push(ensureId(token))`, `added`/`removed` via `collectIds`, `updated.push(ensureId(nextMark))` and `collectIds(kids[…], updated)`.
- **`collectChanged` (commit.ts ~242-259) re-derives what reconcile already computed.** It is a second full DFS over the output tree, keyed on `deps.idFor`, allocating `{token, path}` on every needed id. Its only callers are inside `commitText` (line 144). Deleting it removes commit's only structural re-walk; `deps.idFor` STAYS because `bind` (commit.ts line 225 → bind.ts `collectTree`) still needs it for the structural branch's own DOM-aligned path walk.
- **The escalation type-walk is the `entry.token.type !== 'text'` check (commit.ts line 162)** plus the `added.length === 0 && removed.length === 0` routing gate (lines 105-106). A `textChanged` MARK is a refused deep-descend (value/meta/outside-slot/child-structure changed): mark components render value/meta as framework props, so it must route structural. Today commit discovers this at runtime per id. Phase 2 moves the decision into reconcile: a refused-descend mark sets `structural = true` directly (its change entry carries `kind: 'text'` for handle-event continuity but does not gate routing). The `commit.spec` escalation cases (`a textChanged MARK routes structural`, `a textChanged id absent from the new tree routes structural`, the missing-handle / missing-surface self-heal cases) are rewritten to assert the SAME observable outcomes through the new shape, never deleted.
- **The `pendingStructural` fold guard STAYS (commit.ts lines 102-103, 200-201).** While a structural apply awaits its bind the node layer is one generation stale, so every apply in that window must fold into the pending structural pass regardless of what reconcile says — `apply` keeps `if (!pendingStructural && !result.structural) { … text branch … }`. That is the one commit-side routing override the spec preserves.
- **Public `changed` payload consumers (grep-verified, the COMPLETE list):**
  - `SelectionController.ts:45` — `watch(this.tokens.changed, () => this.#applyRange())`: IGNORES the payload already. Only its type changes.
  - `BlockController.ts:39-42` — `watch(this.tokens.changed, changeset => { if (changeset.kind !== 'delta') return; for (const id of changeset.removed) this.#stores.delete(id) })`: the ONLY payload reader. Migrates to a `void` watch reading `this.tokens.removedIds()`.
  - That is all. `handle.changed` (LiveNode `TokenChange` — `{kind: 'text'|'moved'|'unmounted'}`) is a SEPARATE per-node event, NOT the model-level changed; every `handle.changed` site (bind.spec, LiveNode.spec, TokenHandle.spec) is untouched by this phase.
- **`Changeset` is exported** from `tokens/index.ts:15` (`export type {Changeset, EditHint}`). After Phase 2 the four-bucket `Changeset` type is gone; the export line drops `Changeset` (keeps `EditHint`). No production code outside the token layer imports `Changeset` (grep-verified — only `commit.ts`, `TokenModel.ts`, `tokenIdentity.ts`, and their specs reference it).
- **`commit.spec.ts` and `TokenModel.changed.spec.ts` are DELIBERATELY rewritten** (spec acceptance bar: "`commit.spec` … rewritten deliberately, never silently"). They are the only specs that deep-assert the four-bucket payload; their render-count gates (text edits → tree watcher 0 / changed N; structural → tree watcher 1) and pending-latch / divergence / re-entry / timeout cases stay, re-expressed against `result.structural` + `result.changes` + a `void` changed event.
- **Render-count AND remount gates stay UNCHANGED and green:** `renderCount.react.spec.tsx`, `renderCount.vue.spec.ts` (incl. the Phase-1 `Remount gates: identity keys` describes) and the `render-count gates` describe in `TokenModel.changed.spec.ts` assert tree-watcher counts and mount-spy counts — both untouched by the changeset-shape change. Do NOT edit any storybook spec in this phase.

---

### Task 1: New `ReconcileResult` shape — type + the `full`/cold-start path

**Files:**
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts` (the type block ~28-41; the cold-start return ~116-120; the delta return ~318-321 — minimal, just to compile against the new shape; the walk threading is Task 2)
- Modify: `packages/core/src/features/tokens/tokenIdentity.spec.ts` (append a describe pinning the new fields on a cold start and a simple delta)

This task introduces the new result type and makes reconcile return it, deriving `changes`/`removedIds`/`structural` from the EXISTING four buckets as a temporary bridge (Task 2 threads the paths through the walk and deletes the bridge). Cheap, compiles green, keeps every existing id-bucket assertion alive one more task.

- [x] **Step 1: Write the failing tests**

Append at the end of `tokenIdentity.spec.ts` (after the `token.id plain field` describe), as a new top-level describe. `parser` is the module-level `new Parser(['@[__value__]'])`:

```ts
describe('reconcile structural result (phase 2)', () => {
	it('cold start: structural true, every token an add change at its path, no removals', () => {
		const tracker = createIdentityTracker()
		const slotted = new Parser(['#[__slot__]'])
		const result = tracker.reconcile(slotted.parse('#[ab]tail'))

		expect(result.structural).toBe(true)
		expect(result.removedIds).toEqual([])
		// '#[ab]tail' → text '' [0,0], mark '#[ab]' {child 'ab'}, text 'tail'
		// one add entry per token of the whole tree, each at its tree path
		const paths = result.changes.map(c => c.path)
		expect(paths).toContainEqual([0])
		expect(paths).toContainEqual([1])
		expect(paths).toContainEqual([1, 0])
		expect(paths).toContainEqual([2])
		for (const change of result.changes) {
			expect(change.kind).toBe('add')
			expect(change.id).toBe(change.token.id)
		}
	})

	it('a tail text edit: structural false, one text change at the tail path', () => {
		const tracker = createIdentityTracker()
		tracker.reconcile(parser.parse('he@[x]llo'))
		const result = tracker.reconcile(parser.parse('he@[x]llo!'), {start: 9, end: 9, insertedLength: 1})

		expect(result.structural).toBe(false)
		expect(result.removedIds).toEqual([])
		const text = result.changes.filter(c => c.kind === 'text')
		expect(text).toHaveLength(1)
		expect(text[0].path).toEqual([2])
		expect(text[0].token.content).toBe('llo!')
		expect(text[0].id).toBe(result.tokens[2].id)
	})

	it('a removed mark: structural true, the mark id (and child id) in removedIds', () => {
		const tracker = createIdentityTracker()
		const first = tracker.reconcile(parser.parse('he@[x]llo')).tokens
		const markId = first[1].id
		const result = tracker.reconcile(parser.parse('hello'), {start: 2, end: 6, insertedLength: 0})

		expect(result.structural).toBe(true)
		expect(result.removedIds).toContain(markId)
	})
})
```

- [x] **Step 2: Run to verify they fail**

Run: `pnpm -F core test -- tokenIdentity.spec`
Expected: the 3 new tests FAIL (`result.structural`/`result.changes`/`result.removedIds` are `undefined`; `result.changeset` still exists). All pre-existing tokenIdentity tests pass.

- [x] **Step 3: Add the new types and a bridge from the existing buckets**

In `tokenIdentity.ts`, REPLACE the `Changeset` / `ReconcileResult` block (lines 11-41 — the `Delta buckets` doc comment, the `Changeset` union, and `ReconcileResult`) with:

```ts
/**
 * One change to the reconciled tree, resolved AT RECONCILE TIME (Phase 2): the
 * id, the new token object, and its tree path — so the commit pipeline patches
 * without a second tree walk. `kind` carries the routing the old id-buckets did:
 *
 * - `text`   the token's rendered text content changed. A TEXT token → patch its
 *            surface. A MARK with this kind is a REFUSED deep-descend (value/meta
 *            /outside-slot/child-structure changed); it sets `structural` (mark
 *            components render value/meta as framework props) but keeps the entry
 *            for handle-event continuity (the inherited id fires `text`).
 * - `update` position-only refresh (a suffix shift or an in-slot child move):
 *            update the node's token/path, no surface patch, no render.
 * - `add`    a token new to the tree (no previous id). Forces `structural`.
 */
export type TokenChangeEntry = {
	readonly id: number
	readonly token: Token
	readonly path: TokenPath
	readonly kind: 'text' | 'update' | 'add'
}

export type EditHint = {
	/** Replaced range in the PREVIOUS value. */
	readonly start: number
	readonly end: number
	readonly insertedLength: number
}

/**
 * The reconcile output (Phase 2 — routing decided here, not at commit time):
 *
 * - `tokens`     the reconciled tree (ids stamped, prev objects reused).
 * - `structural` the renderer must run: a token was added or removed, or a mark
 *                refused its deep-descend. The commit text branch is taken iff
 *                this is false AND no structural apply is pending (the fold guard).
 * - `changes`    every changed token as `(id, token, path)` + routing kind, in
 *                tree order — the commit branch reads them directly.
 * - `removedIds` ids gone from the tree (subtree included) — the prune feed.
 */
export type ReconcileResult = {
	tokens: Token[]
	structural: boolean
	changes: TokenChangeEntry[]
	removedIds: number[]
}
```

Add the `TokenPath` import at the top of the file (after the existing `parser/types` import):

```ts
import type {TokenPath} from '../../shared/editorContracts'
```

Now wire the two return sites to the new shape via a TEMPORARY bridge over the existing buckets (Task 2 deletes the bridge). The four bucket arrays (`textChanged`, `added`, `updated`, and the local `removed`) and `out` are all still in scope at the delta return. Just before the cold-start return (replace lines 116-120):

```ts
				if (!prev) {
					next.forEach(ensureId)
					previous = next
					const changes: TokenChangeEntry[] = []
					collectAddChanges(next, [], changes)
					return {tokens: next, structural: true, changes, removedIds: []}
				}
```

Replace the delta return (lines 318-321) with:

```ts
				out.forEach(ensureId)
				previous = out
				return bridge(out, textChanged, added, updated, removed)
```

(Keep the `out.forEach(ensureId)` and `previous = out` exactly where they were — the snippet above shows them moving into the return region; do not duplicate them.)

Add these two bridge helpers as module-level functions at the bottom of the file (after `sameDescriptor`):

```ts
/** Cold start: every token of the tree is an `add` change at its path. */
function collectAddChanges(tokens: readonly Token[], basePath: TokenPath, out: TokenChangeEntry[]): void {
	tokens.forEach((token, i) => {
		const path = [...basePath, i]
		// id was stamped by ensureId before this runs
		out.push({id: token.id ?? 0, token, path, kind: 'add'})
		if (token.type === 'mark') collectAddChanges(token.children, path, out)
	})
}

/**
 * TEMPORARY Phase-2 bridge: rebuild `changes`/`structural`/`removedIds` from the
 * legacy id buckets by re-walking the output tree for paths. Task 2 threads the
 * paths through the reconcile walk itself and DELETES this — the buckets and this
 * function vanish together.
 */
function bridge(
	out: readonly Token[],
	textChanged: readonly number[],
	added: readonly number[],
	updated: readonly number[],
	removed: readonly number[]
): ReconcileResult {
	const byId = new Map<number, {token: Token; path: TokenPath}>()
	const walk = (tokens: readonly Token[], basePath: TokenPath): void => {
		tokens.forEach((token, i) => {
			const path = [...basePath, i]
			if (token.id !== undefined) byId.set(token.id, {token, path})
			if (token.type === 'mark') walk(token.children, path)
		})
	}
	walk(out, [])
	const changes: TokenChangeEntry[] = []
	let structural = removed.length > 0
	for (const id of added) {
		const hit = byId.get(id)
		if (hit) changes.push({id, token: hit.token, path: hit.path, kind: 'add'})
		structural = true
	}
	for (const id of textChanged) {
		const hit = byId.get(id)
		if (!hit) continue
		changes.push({id, token: hit.token, path: hit.path, kind: 'text'})
		// a textChanged MARK is a refused descend → structural (commit's old type-walk)
		if (hit.token.type !== 'text') structural = true
	}
	for (const id of updated) {
		const hit = byId.get(id)
		if (hit) changes.push({id, token: hit.token, path: hit.path, kind: 'update'})
	}
	return {tokens: out, structural, changes, removedIds: [...removed]}
}
```

NOTE: this task keeps the bucket-filling code (`textChanged.push`, `added`, `updated`, `removed`, `collectIds`) UNTOUCHED — the bridge consumes them. The buckets and bridge die together in Task 2.

- [x] **Step 4: Run to verify green**

Run: `pnpm -F core test -- tokenIdentity.spec`
Expected: the 3 new tests pass. Pre-existing tokenIdentity tests will now FAIL TO COMPILE / fail at runtime wherever they read `result.changeset` — that is EXPECTED and fixed in Step 5 (the property spec reads `result.changeset.kind`; the spec file reads it too). If a test fails for any reason OTHER than `changeset` being undefined, STOP and report.

- [x] **Step 5: Migrate the in-file changeset reads — `tokenIdentity.spec.ts` and the property spec**

The reconcile-shape change breaks the spec sites that read `result.changeset`. Migrate them to the new fields (these are the SAME assertions, re-expressed):

`tokenIdentity.spec.ts` — wherever a test reads `result.changeset` (the deep-reconcile/descend describes assert `changeset.updated`/`textChanged`/`added`/`removed` by id), translate per this map:
- `changeset.added` (ids) → `result.changes.filter(c => c.kind === 'add').map(c => c.id)`
- `changeset.textChanged` (ids) → `result.changes.filter(c => c.kind === 'text').map(c => c.id)`
- `changeset.updated` (ids) → `result.changes.filter(c => c.kind === 'update').map(c => c.id)`
- `changeset.removed` (ids) → `result.removedIds`
- `changeset.kind === 'delta'` guards → `!result.structural` where the test means "text path", else drop the guard and read the arrays directly.

Run `pnpm -F core test -- tokenIdentity.spec` and fix each failing assertion mechanically by the map above. Do NOT change what is asserted — only how it is read. (If a descend test asserts "the mark is in `updated`, not `textChanged`", that becomes "an `update` change for the mark id exists, no `text` change for it".)

`tokenIdentity.property.spec.ts` — in `assertReconcileEquivalence` (~433-453), the block destructures `const {textChanged, added, removed, updated} = result.changeset`. Replace with:

```ts
	// 2. Change id invariants (Phase 2: routing kinds, not buckets).
	const newIds = collectTreeIds(result.tokens, tracker)
	const added = result.changes.filter(c => c.kind === 'add').map(c => c.id)
	const textChanged = result.changes.filter(c => c.kind === 'text').map(c => c.id)
	const updated = result.changes.filter(c => c.kind === 'update').map(c => c.id)
	const removed = result.removedIds
```

and delete the now-stale `expect(result.changeset.kind).toBe('delta')` + the `if (result.changeset.kind !== 'delta') throw` guard lines directly above it. The four downstream `for (const id of …)` invariant loops, the descend invariants (`updated`/`textChanged` `.toContain`), and the `removedSet` survival loop all keep working against these local arrays unchanged.

- [x] **Step 6: Run the full core suite**

Run: `pnpm -F core test`
Expected: `tokenIdentity.spec`, `tokenIdentity.property.spec` green. `commit.ts` / `commit.spec` / `TokenModel.changed.spec` / `TokenModel.ts` / `BlockController.ts` still reference `result.changeset` / `tokens.changed: Event<Changeset>` and will FAIL TO COMPILE — that is EXPECTED (Tasks 3-6). To keep this task's commit green in isolation, this task does NOT touch those files; run ONLY the identity specs here:

Run: `pnpm -F core test -- tokenIdentity`
Expected: both identity specs fully green. The broken consumers are this task's deliberate red, handed to Tasks 3-6.

- [x] **Step 7: Commit**

```bash
git commit -m "feat(tokens): reconcile emits {structural, changes, removedIds} (bridged over the buckets)" -- packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/tokenIdentity.spec.ts packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

---

### Task 2: Thread `(id, token, path)` through the reconcile walk — delete the bridge

**Files:**
- Modify: `packages/core/src/features/tokens/tokenIdentity.ts` (the walks, `tryDescend`, `pairSlotChildren`, `collectIds`; delete the `bridge`/`collectAddChanges` helpers and the four bucket arrays)
- Modify: `packages/core/src/features/tokens/tokenIdentity.property.spec.ts` (extend with path-correctness properties)

This is the heart of Phase 2: reconcile builds `changes` DIRECTLY at each token it visits (it has the path component in hand), so the bridge's re-walk dies. The four bucket arrays become a single `changes` array plus `removedIds`; `structural` is set inline.

- [x] **Step 1: Write the path-correctness property (failing-by-construction gate)**

In `tokenIdentity.property.spec.ts`, add to `assertReconcileEquivalence` — directly AFTER the local `added`/`textChanged`/`updated`/`removed` arrays are derived (Task 1 Step 5) — a path-resolution property. Add this helper near the top-level helpers (after `collectTreeIds`):

```ts
/** Resolve a tree path to its token, or undefined if the path is invalid. */
function tokenAtPath(tokens: readonly Token[], path: readonly number[]): Token | undefined {
	let level: readonly Token[] | undefined = tokens
	let token: Token | undefined
	for (const i of path) {
		if (!level) return undefined
		token = level[i]
		if (!token) return undefined
		level = token.type === 'mark' ? token.children : undefined
	}
	return token
}
```

and add, inside `assertReconcileEquivalence` right after the new local arrays:

```ts
	// 2a. Path correctness (Phase 2): every emitted change resolves, at its path,
	//     to its own token in the OUTPUT tree, and the entry id matches.
	for (const change of result.changes) {
		const at = tokenAtPath(result.tokens, change.path)
		expect(at, `change path [${change.path.join(', ')}] must resolve in the output tree`).toBe(change.token)
		expect(change.token.id, 'change token must carry the change id').toBe(change.id)
	}
```

- [x] **Step 2: Run — verify the bridge already satisfies it**

Run: `pnpm -F core test -- tokenIdentity.property`
Expected: GREEN. The Task-1 bridge already resolves paths from the output tree, so the path property passes over the bridged result. This pins the contract BEFORE the refactor so Task 2's rewrite cannot silently break it (a red here after the rewrite is the gate firing). Commit the property now so the gate is in place:

```bash
git commit -m "test(tokens): pin reconcile change-path correctness before threading paths" -- packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

- [x] **Step 3: Replace the bucket arrays with a `changes` collector + inline `structural`**

In `tokenIdentity.ts`, inside `reconcile`, REPLACE the four bucket declarations (lines ~128-131):

```ts
				const out: Token[] = next.slice()
				const textChanged: number[] = []
				const added: number[] = []
				const updated: number[] = []
				const matchedPrev = new Set<Token>()
```

with:

```ts
				const out: Token[] = next.slice()
				const changes: TokenChangeEntry[] = []
				const removedIds: number[] = []
				let structural = false
				const matchedPrev = new Set<Token>()
```

Replace `collectIds` (lines ~89-93) — which pushed ids into a bucket — with a path-aware collector that emits change ENTRIES:

```ts
		/** Push the token's subtree into `changes` as `kind`, each entry at its full path. */
		const collectChanges = (token: Token, basePath: TokenPath, kind: TokenChangeEntry['kind']): void => {
			const id = ensureId(token)
			changes.push({id, token, path: basePath, kind})
			if (token.type === 'mark') {
				token.children.forEach((child, i) => collectChanges(child, [...basePath, i], kind))
			}
		}
```

(`ensureId` still stamps the subtree; `collectChanges` only walks to push entries — the recursion mirrors the old `collectIds`.)

- [x] **Step 4: Thread `basePath` through `tryDescend` and `pairSlotChildren`; rewrite the three walks**

`tryDescend` and `pairSlotChildren` gain a `basePath: TokenPath` parameter (the path of the mark being descended). Apply these edits:

**`tryDescend` signature + body** — change the signature to:

```ts
				const tryDescend = (prevMark: MarkToken, nextMark: MarkToken, basePath: TokenPath): boolean => {
```

and its tail (the descend commit, lines ~170-177) from the `pairSlotChildren(...)` + `updated.push(ensureId(nextMark))` to:

```ts
					const id = ids.get(prevMark)
					if (id !== undefined) ids.set(nextMark, id)
					pairSlotChildren(prevMark, nextMark, prevSlot, nextSlot, basePath)
					changes.push({id: ensureId(nextMark), token: nextMark, path: basePath, kind: 'update'})
					return true
```

**`pairSlotChildren` signature + body** — change the signature to:

```ts
				const pairSlotChildren = (
					prevMark: MarkToken,
					nextMark: MarkToken,
					prevSlot: NonNullable<MarkToken['slot']>,
					nextSlot: NonNullable<MarkToken['slot']>,
					basePath: TokenPath
				): void => {
```

In its head-reuse branch (lines ~210-216), replace the shifted-child `inherit` + `collectIds(kids[lo], updated)` with a path-aware update collect:

```ts
						if (headShift === 0) {
							kids[lo] = prevKids[lo]
						} else {
							inherit(prevKids[lo], kids[lo])
							collectChanges(kids[lo], [...basePath, lo], 'update')
						}
```

In its tail-reuse branch (lines ~224-229), the same with index `hi`:

```ts
						if (tailShift === 0) {
							kids[hi] = prevKids[hi]
						} else {
							inherit(prevKids[hi], kids[hi])
							collectChanges(kids[hi], [...basePath, hi], 'update')
						}
```

In its middle loop (lines ~232-239), thread the child path into the recursive descend and the text push:

```ts
					for (let i = lo; i <= hi; i++) {
						const a = prevKids[i]
						const b = kids[i]
						const childPath = [...basePath, i]
						// nested marks descend recursively under the same four conditions
						if (a.type === 'mark' && b.type === 'mark' && tryDescend(a, b, childPath)) continue
						inherit(a, b)
						changes.push({id: ensureId(b), token: b, path: childPath, kind: 'text'})
					}
```

**Suffix walk** (lines ~259-277) — replace the `shiftDelta !== 0` branch's `collectIds(next[nextTail], updated)` with a path-aware update collect (the path is the top-level index `nextTail`):

```ts
					matchedPrev.add(prev[prevTail])
					if (shiftDelta !== 0) {
						inherit(prev[prevTail], next[nextTail])
						// descendants shifted too — collect the whole subtree as update
						collectChanges(next[nextTail], [nextTail], 'update')
					} else {
						out[nextTail] = prev[prevTail]
					}
```

**Middle loop** (lines ~289-306) — thread the top-level index `i` as the path, route the descend / text / add, and set `structural` on add:

```ts
				for (let i = p; i <= nextTail; i++) {
					const candidate = i <= prevTail ? prev[i] : undefined
					const token = next[i]
					if (
						candidate !== undefined &&
						!matchedPrev.has(candidate) &&
						(candidate.type === 'mark'
							? token.type === 'mark' && sameDescriptor(candidate, token)
							: candidate.type === token.type)
					) {
						matchedPrev.add(candidate)
						if (candidate.type === 'mark' && token.type === 'mark' && tryDescend(candidate, token, [i]))
							continue
						inherit(candidate, token)
						// refused-descend MARK (value/meta/child-structure changed) renders
						// framework props → structural; a text token stays on the text path.
						if (token.type === 'mark') structural = true
						changes.push({id: ensureId(token), token, path: [i], kind: 'text'})
					} else {
						collectChanges(token, [i], 'add')
						structural = true
					}
				}
```

**Removed loop** (lines ~308-309) — replace `collectIds(t, removed)` with `removedIds` collection (+ structural). Removed tokens are NOT in `out`, so they have no output path; `removedIds` carries ids only (the prune feed needs no path):

```ts
				for (const t of prev) {
					if (matchedPrev.has(t)) continue
					collectRemovedIds(t, removedIds)
					structural = true
				}
```

Add `collectRemovedIds` as a local helper near `collectChanges`:

```ts
		/** Push the removed token's subtree ids into `removedIds` (no path — it is gone from the tree). */
		const collectRemovedIds = (token: Token, bucket: number[]): void => {
			bucket.push(ensureId(token))
			if (token.type === 'mark') token.children.forEach(child => collectRemovedIds(child, bucket))
		}
```

**Delta return** — replace Task 1's `return bridge(...)` with:

```ts
				out.forEach(ensureId)
				previous = out
				return {tokens: out, structural, changes, removedIds}
```

**Cold start** — replace Task 1's bridge-free cold-start body's `collectAddChanges(next, [], changes)` call site so it sets `structural: true` inline (the cold-start return is fine as written in Task 1; just keep `collectAddChanges` for one more step or inline it). Replace the cold-start return with:

```ts
				if (!prev) {
					next.forEach(ensureId)
					previous = next
					const changes: TokenChangeEntry[] = []
					const collect = (tokens: readonly Token[], basePath: TokenPath): void => {
						tokens.forEach((token, i) => {
							const path = [...basePath, i]
							changes.push({id: ensureId(token), token, path, kind: 'add'})
							if (token.type === 'mark') collect(token.children, path)
						})
					}
					collect(next, [])
					return {tokens: next, structural: true, changes, removedIds: []}
				}
```

**Delete the dead bridge helpers:** remove the module-level `collectAddChanges` and `bridge` functions added in Task 1 (the cold start now inlines its own `collect`; the delta path builds `changes` inline).

- [x] **Step 5: Run the identity specs**

Run: `pnpm -F core test -- tokenIdentity`
Expected: `tokenIdentity.spec` and `tokenIdentity.property` BOTH green — including the path-correctness property from Step 1 (now satisfied by the real threaded paths, not the bridge). The id-invariant loops, descend invariants, and equivalence assertion are unchanged and must stay green. If the path property fails, a threaded path is wrong — fix the offending walk; do NOT relax the property.

- [x] **Step 6: Run the full core suite (expect the consumers still red)**

Run: `pnpm -F core test -- tokenIdentity`
Expected: green. The pipeline consumers (`commit.ts`, specs) are still on the old shape and handed to Tasks 3-6 — do not touch them here.

- [x] **Step 7: Commit**

```bash
git commit -m "feat(tokens): thread (id, token, path) through the reconcile walk — delete the bridge" -- packages/core/src/features/tokens/tokenIdentity.ts packages/core/src/features/tokens/tokenIdentity.property.spec.ts
```

---

### Task 3: Commit pipeline — read `changes` directly, delete `collectChanged` + the type-walk

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.ts`

This is the consumer of Task 2. The text branch iterates `result.changes` (paths already resolved) instead of re-walking; routing reads `result.structural`; the `pendingStructural` fold guard stays. The public `changed` event becomes `Event<void>` here; the pipeline gains a `removedIds()` accessor for BlockController (Task 5).

- [x] **Step 1: Rewrite the type imports, the deps, and the pipeline interface**

In `commit.ts`, change the import (line 5) from:

```ts
import type {Changeset, ReconcileResult} from '../tokenIdentity'
```

to:

```ts
import type {ReconcileResult, TokenChangeEntry} from '../tokenIdentity'
```

Replace the `changed: Event<Changeset>` field in `CommitPipeline` (line 40) and add the accessor:

```ts
	/** THE model-level detector: fires once per commit, only after the DOM is consistent (both branches). Payloadless — consumers re-read. */
	changed: Event<void>
	/** Ids removed by the LAST committed reconcile (subtree included) — the prune feed for id-keyed stores. Empty on a re-bind. */
	removedIds(): readonly number[]
```

Delete the `type Delta = Extract<Changeset, {kind: 'delta'}>` line (48) and the entire `REBIND_CHANGESET` block (lines ~54-59) — the void event needs no payload.

- [x] **Step 2: Rewrite `apply`, the signal/event setup, and the latch state**

Replace the signal/event/latch declarations (lines ~66-85) — keep `tree`, swap the event and the pending payload for the new shape:

```ts
	const tree = signal<Token[]>({initial: []})
	const changed = event<void>()

	let byPath: ReadonlyMap<string, TokenHandle> = new Map()
	let byElement = new WeakMap<HTMLElement, TokenHandle>()
	let controlRoots = new WeakSet<HTMLElement>()

	let latest: Token[] = []

	let pendingStructural = false
	// Ids removed by the change currently being committed (read by removedIds()
	// after changed fires). A re-bind with no pending change removed nothing.
	let lastRemovedIds: readonly number[] = []
	let committing = false
```

(Keep the `// The latest RECONCILED tree …` comment above `latest` exactly as it was.)

Replace `apply` (lines ~92-116) — route on `result.structural`, keep the fold guard:

```ts
	function apply(result: ReconcileResult): void {
		if (committing) throw new Error('TokenModel commit re-entry')
		committing = true
		try {
			const {tokens, structural, changes, removedIds} = result
			latest = tokens
			// Routing decided at RECONCILE time (result.structural). The one
			// commit-side override is the fold guard: while a structural apply
			// awaits its bind the node layer is one generation stale, so EVERY
			// apply folds into the pending structural pass (fail-closed — no
			// half-patch against a tree the DOM never showed).
			if (!pendingStructural && !structural) {
				if (commitText(changes, removedIds)) return
				commitStructural(tokens, removedIds, true)
				return
			}
			commitStructural(tokens, removedIds, false)
		} finally {
			committing = false
		}
	}
```

- [x] **Step 3: Rewrite `commitText` — iterate `changes`, no walk, no type-walk escalation**

Replace `commitText` (lines ~131-190) with:

```ts
	/**
	 * Text branch: the adapter never re-renders (tree keeps its reference), so
	 * bound elements and paths stay live. Reconcile already resolved every change
	 * to (id, token, path) and decided routing — `result.structural` was false, so
	 * no entry is an `add` and the tree has no removals. Two passes: resolve every
	 * change to a live handle/surface PURELY first; ANY miss abandons the branch
	 * before a single mutation and the caller escalates structurally.
	 */
	function commitText(changes: readonly TokenChangeEntry[], removedIds: readonly number[]): boolean {
		const updates: {handle: TokenHandle; token: Token; path: TokenPath}[] = []
		const patches: {surface: HTMLElement; content: string}[] = []
		for (const change of changes) {
			const handle = deps.nodes.get(change.id)
			if (change.kind === 'update') {
				// Never bound yet (a handle materializes on the next bind) — skip,
				// not a miss: an unrendered token has no surface to patch.
				if (!handle) continue
				updates.push({handle, token: change.token, path: change.path})
				continue
			}
			// kind 'text' on the text branch is always a TEXT token (a refused-descend
			// MARK set result.structural, so we are not here). Resolve its surface.
			if (!handle) return false
			const surface = handle.node()?.textElement
			if (!surface) return false
			updates.push({handle, token: change.token, path: change.path})
			patches.push({surface, content: change.token.content})
		}

		// Commit: update the listed nodes (each bumps only its own dirty) and patch
		// the changed surfaces, in one batch so handle watchers flush against a
		// consistent DOM. Conditional writes keep untouched Text nodes alive.
		batch(() => {
			for (const {handle, token, path} of updates) handle.update(token, path)
			for (const {surface, content} of patches) {
				if (surface.textContent !== content) surface.textContent = content
			}
		})
		if (VERIFY_DOM) assertAligned()
		lastRemovedIds = removedIds
		changed()
		return true
	}
```

(The old `entry.token.type !== 'text'` escalation is GONE: reconcile set `structural` for a refused-descend mark, so `apply` already routed it to `commitStructural` before reaching here. The "unknown id" stale-tree guard survives as `if (!handle) return false` on a `text` change.)

- [x] **Step 4: Rewrite `commitStructural`, `bindAndAnnounce`, delete `collectChanged`**

Replace `commitStructural` (lines ~199-217) — it no longer carries a changeset, only the removed ids:

```ts
	function commitStructural(tokens: Token[], removedIds: readonly number[], selfHeal: boolean): void {
		pendingRemovedIds = removedIds
		pendingStructural = true
		tree(tokens)
		if (VERIFY_DOM) {
			clearTimeout(renderedTimer)
			renderedTimer = setTimeout(() => {
				if (pendingStructural && deps.container()) {
					console.warn(
						`[markput] rendered() was not called within ${renderedTimeoutMs}ms of a structural update — ` +
							'the adapter handshake is broken (host.rendered must run after every paint)'
					)
				}
			}, renderedTimeoutMs)
		}
		if (!selfHeal) return
		const container = deps.container()
		if (container) bindAndAnnounce(container)
	}
```

Add `let pendingRemovedIds: readonly number[] = []` next to `pendingStructural` (in the Step 2 latch block — add it there). Replace `bindAndAnnounce` (lines ~219-239):

```ts
	/** Shared endpoint of onRendered and escalation: one DOM+tree walk onto the node layer, then announce. */
	function bindAndAnnounce(container: HTMLElement): void {
		clearTimeout(renderedTimer)
		const result = bind({
			container,
			tokens: latest,
			idFor: deps.idFor,
			nodes: deps.nodes,
			controlElements: deps.controlElements(),
			childSequenceHostsFor: deps.childSequenceHostsFor,
			isBlock: deps.isBlock(),
			editable: deps.editableState(),
		})
		byPath = result.byPath
		byElement = result.byElement
		controlRoots = result.controlRoots
		// A re-bind with no pending structural change removed nothing.
		lastRemovedIds = pendingStructural ? pendingRemovedIds : []
		pendingStructural = false
		if (VERIFY_DOM) assertAligned()
		changed()
	}
```

DELETE the entire `collectChanged` function (lines ~241-259).

- [x] **Step 5: Wire the return object**

In the returned object (lines ~280-289), replace `changed,` (it is the same `changed` reference, now `Event<void>`) — no change to the line itself — and add the accessor:

```ts
	return {
		apply,
		onRendered,
		tree,
		changed,
		removedIds: () => lastRemovedIds,
		pending: () => pendingStructural,
		byPath: () => byPath,
		byElement: element => byElement.get(element),
		isControlRoot: element => controlRoots.has(element),
	}
```

- [x] **Step 6: Run the commit spec (expect deliberate red — rewritten in Task 4)**

Run: `pnpm -F core test -- commit.spec`
Expected: `commit.ts` COMPILES (typecheck via the test build), but `commit.spec.ts` still asserts the four-bucket payload (`changedSpy.mock.calls[0][0]` deep-equality, `result.changeset`) and FAILS. That is this task's hand-off to Task 4. Do NOT edit the spec here. If `commit.ts` itself fails to compile, fix `commit.ts` — the spec failures are expected, a compile error is not.

- [x] **Step 7: Commit**

```bash
git commit -m "feat(tokens): commit reads reconcile changes directly — delete collectChanged + the type-walk" -- packages/core/src/features/tokens/model/commit.ts
```

---

### Task 4: Rewrite `commit.spec.ts` against the new shape

**Files:**
- Modify: `packages/core/src/features/tokens/model/commit.spec.ts`

Deliberate rewrite (spec acceptance bar). Every behavior the old spec pinned stays; the assertions move from the four-bucket payload to `result.structural` + `result.changes` + a `void` changed event. The harness's `apply` returns the `ReconcileResult`, so `result.structural`/`result.changes`/`result.removedIds` are available in every test.

- [x] **Step 1: Migrate the harness and the changed-spy idiom**

The harness `apply` (lines ~37-41) already returns `result` — no change needed. The pervasive idiom `expect(changedSpy).toHaveBeenCalledWith(result.changeset)` becomes `expect(changedSpy).toHaveBeenCalledTimes(N)` (the event is `void` — there is no payload to match). Apply this mechanically across the file: every `toHaveBeenCalledWith(result.changeset)` / `toHaveBeenCalledWith({kind: …})` on `changedSpy` becomes a `toHaveBeenCalledTimes` count assertion (the surrounding test already establishes the count; where it does not, add `expect(changedSpy).toHaveBeenCalledTimes(1)`).

- [x] **Step 2: Rewrite the payload-shape assertions test-by-test**

Translate each deep-payload assertion to the new shape:

- `cold start` (line ~83) `expect(result.changeset).toEqual({kind: 'full'})` → `expect(result.structural).toBe(true)` and `expect(result.changes.every(c => c.kind === 'add')).toBe(true)`. The `changedSpy.mock.calls[0][0]` identity check (line ~94) → just `toHaveBeenCalledTimes(1)`.
- `tail text edit` (line ~127-133) — the patch/`changes` are observable via the harness; keep the DOM + handle assertions (`text2.textContent`, `tail.text()`, `tail.address()`) UNCHANGED; replace the changeset payload check with `expect(result.structural).toBe(false)` and `expect(result.changes.map(c => c.kind)).toContain('text')`.
- `no-op apply` (line ~216-225) `toHaveBeenCalledWith({kind: 'delta', …empty})` → `expect(result.structural).toBe(false)`, `expect(result.changes).toEqual([])`, `expect(changedSpy).toHaveBeenCalledTimes(1)`.
- `structural branch` added-token (line ~267-278) — keep tree-reference + pending + bind-count assertions; replace payload checks with `expect(result.structural).toBe(true)` and `expect(result.changes.some(c => c.kind === 'add')).toBe(true)`.
- `removed tokens route structural` (line ~298-311) — keep the dead/handle assertions; add `expect(result.structural).toBe(true)` and `expect(result.removedIds).toContain(markHandle.id)` (capture `markHandle.id` before the apply).
- `escalation` describe (lines ~415-541): the `textChanged MARK routes structural` case (line ~435) → `expect(result.structural).toBe(true)`; the second `changed` (idempotent re-bind, line ~451-458) `toHaveBeenLastCalledWith({kind:'delta',…empty})` → `toHaveBeenCalledTimes(2)`. The `textChanged id with no handle` (line ~464) and `text target without a surface` (line ~489) cases drive the harness with a real value and assert self-heal — keep those DOM/handle assertions, drop the payload deep-equality. The `textChanged id absent from the new tree` case (line ~524) hand-builds a changeset literal: replace the `pipeline.apply({tokens, changeset: {kind:'delta', textChanged:[99999], …}})` with the new shape `pipeline.apply({tokens, structural: false, changes: [{id: 99999, token: tokens[0], path: [0], kind: 'text'}], removedIds: []})` — same intent (a `text` change whose id has no handle abandons the text branch and self-heals structurally); assert `changedSpy` fired once and `pipeline.pending()` is false.
- `pendingStructural latch` (lines ~347-413) and the fold case (line ~367) — these assert routing/latch, not payload; the fold case's `toHaveBeenCalledWith(second.changeset)` → `toHaveBeenCalledTimes(1)`. Keep everything else.
- `deep reconcile integration` in-slot case (line ~643-693) — keep the DOM/handle/`markChanges`/`childChanges` assertions UNCHANGED (those are `handle.changed` per-node events, untouched); replace `toHaveBeenCalledWith(result.changeset)` with `toHaveBeenCalledTimes(1)` and add `expect(result.structural).toBe(false)`.
- `re-entry guard`, `divergence detector`, `rendered() timeout`, `lookups` describes — no payload reads; leave UNCHANGED.

- [x] **Step 3: Run the commit spec to green**

Run: `pnpm -F core test -- commit.spec`
Expected: full pass. If a test now over- or under-counts `changed` calls, the count is the contract — re-read the surrounding flow (text branch fires once per apply; structural fires at bind; self-heal fires immediately then the follow-up render fires an idempotent re-bind = a second call). Adjust the COUNT to the real flow, never loosen a behavioral assertion.

- [x] **Step 4: Commit**

```bash
git commit -m "test(tokens): rewrite commit.spec against {structural, changes} + void changed" -- packages/core/src/features/tokens/model/commit.spec.ts
```

---

### Task 5: Public `changed` → `Event<void>`; BlockController prune via `removedIds()`

**Files:**
- Modify: `packages/core/src/features/tokens/model/TokenModel.ts` (the `changed` field; a `removedIds` accessor)
- Modify: `packages/core/src/features/tokens/index.ts` (drop the `Changeset` export)
- Modify: `packages/core/src/features/block/BlockController.ts` (the prune watch)
- Modify: `packages/core/src/features/block/BlockController.spec.ts` (the prune test still passes through the new path — verify, adjust only if it reads the payload)

- [x] **Step 1: Migrate TokenModel.ts**

In `TokenModel.ts`, change the import (line 15) from:

```ts
import type {Changeset, EditHint, ReconcileResult} from '../tokenIdentity'
```

to:

```ts
import type {EditHint, ReconcileResult} from '../tokenIdentity'
```

Replace the `changed` field (line 68):

```ts
	/** THE model-level detector: fires once per commit, only after the DOM is consistent. Payloadless — consumers re-read. */
	readonly changed: Event<void> = this.#pipeline.changed
```

and add directly after it (mirroring the pipeline accessor onto the public shell — the internal change list the spec calls for):

```ts
	/**
	 * Internal: ids removed (subtree included) by the LAST committed reconcile —
	 * the prune feed for id-keyed UI-state stores. Read inside a `changed` watch;
	 * the public event carries no payload, so this accessor is the migration path
	 * for consumers that read the old changeset's `removed` bucket (BlockController).
	 */
	readonly removedIds = (): readonly number[] => this.#pipeline.removedIds()
```

- [x] **Step 2: Drop the `Changeset` export**

In `tokens/index.ts` (line 15), change:

```ts
export type {Changeset, EditHint} from './tokenIdentity'
```

to:

```ts
export type {EditHint, TokenChangeEntry} from './tokenIdentity'
```

(Export `TokenChangeEntry` — the new internal change type — so it is available to any consumer that later needs the change list; `Changeset` no longer exists.)

- [x] **Step 3: Migrate BlockController's prune watch**

In `BlockController.ts`, replace the prune watch (lines ~39-42):

```ts
			watch(this.tokens.changed, changeset => {
				if (changeset.kind !== 'delta') return
				for (const id of changeset.removed) this.#stores.delete(id)
			})
```

with:

```ts
			// changed is payloadless (Phase 2); the removed ids of the last commit
			// come from the model's removedIds() accessor — the prune feed.
			watch(this.tokens.changed, () => {
				for (const id of this.tokens.removedIds()) this.#stores.delete(id)
			})
```

- [x] **Step 4: Run the affected specs**

Run: `pnpm -F core test -- BlockController`
Expected: green — including the Phase-1 `prunes the store of a structurally removed token after the removal commit` test (it observes the prune through `store.block.get(token)` returning a fresh store, not through the payload, so it passes unchanged). If the spec reads `changeset.removed` anywhere, migrate that read to `store.tokens.removedIds()`; the grep in Background facts says it does not.

Run: `pnpm -F core test -- SelectionController`
Expected: green — `SelectionController.ts:45` already ignored the payload; only its type narrowed.

Run: `pnpm -F core test -- TokenModel.index`
Expected: green — `exposes the changed event` (typeof function) and `fires changed after rendered()` (call count) do not read a payload.

- [x] **Step 5: Full core suite + guards**

Run: `pnpm -F core test`
Expected: full pass. `TokenModel.changed.spec.ts` is the remaining payload-reader — handed to Task 6. If it is the ONLY failing file, proceed; if anything else fails, STOP and report.

Run: `pnpm run typecheck`
Expected: clean — no dangling `Changeset` references remain (the export, the field types, the pipeline interface all migrated).

- [x] **Step 6: Commit**

```bash
git commit -m "feat(tokens): public changed → Event<void>; BlockController prunes via removedIds()" -- packages/core/src/features/tokens/model/TokenModel.ts packages/core/src/features/tokens/index.ts packages/core/src/features/block/BlockController.ts packages/core/src/features/block/BlockController.spec.ts
```

(Only stage `BlockController.spec.ts` if Step 4 required an edit; otherwise drop it from the path list.)

---

### Task 6: Rewrite `TokenModel.changed.spec.ts` against the new shape

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.changed.spec.ts`

The last payload-reader. Its `render-count gates` describe (lines ~128-179) is UNTOUCHED (it asserts tree-watcher and changed COUNTS, not payloads). Only the `TokenModel changed event` describe (lines ~34-122) reads the four-bucket payload.

- [x] **Step 1: Rewrite the payload assertions**

Translate the `TokenModel changed event` describe:
- `the first bind announces full …` (line ~44) `expect(changedSpy.mock.calls[0][0]).toEqual({kind: 'full'})` → `expect(changedSpy).toHaveBeenCalledTimes(1)` (the event is void). Keep the id-distinctness assertions (lines ~46-51) UNCHANGED.
- `edit.replace announces a delta with the edited token in textChanged by id` (line ~54) — the changeset deep-equality (lines ~65-71) is the payload; the IDENTITY-survival assertions (`handleId(store, 1)` etc.) are the real contract. Replace the deep-equality with `expect(changedSpy).toHaveBeenCalledTimes(1)` and add `expect(store.tokens.removedIds()).toEqual([])` (a pure text edit removes nothing). Keep the handle-id survival checks. Rename the test to `edit.replace fires changed once and the edited token's handle identity survives`.
- `edit.replace before the mark …` (line ~77) — it reads `changeset.updated`/`added`/`removed` (lines ~88-94). The id-survival assertions (lines ~95-96) are the contract; the `updated`-bucket reads become handle-identity survival (already covered by `handleId(store, 1) === markId`). Replace the changeset block with `expect(changedSpy).toHaveBeenCalledTimes(1)` and `expect(store.tokens.removedIds()).toEqual([])`; keep the survival checks.
- `direct value.current set …` (line ~102) — same translation: drop the deep-equality (lines ~112-118), keep `toHaveBeenCalledTimes(1)`, `removedIds()` empty, and the mark-id survival.

The `render-count gates` describe (lines ~128-179) stays UNCHANGED — confirm by NOT editing it.

- [x] **Step 2: Run**

Run: `pnpm -F core test -- TokenModel.changed`
Expected: full pass, both describes.

- [x] **Step 3: Commit**

```bash
git commit -m "test(tokens): rewrite TokenModel.changed.spec against the void changed event" -- packages/core/src/features/tokens/TokenModel.changed.spec.ts
```

---

### Task 7: Full verification

- [x] **Step 1: All suites + guards**

Run, expecting full pass on each (do NOT use `pnpm -F react test` / `pnpm -F vue test` — silent no-ops, see Tech Stack):

```bash
pnpm -F core test            # full core suite — the Phase-1 baseline +/- the net test delta of Phases 2's added/migrated specs (no NET test loss; the 3 reconcile-shape tests + path property are added, payload deep-equalities are re-expressed in place)
pnpm -F storybook test       # react + vue page specs, incl. BOTH remount gates and the render-count gates — UNCHANGED and green
pnpm run typecheck           # recursive tsc --noEmit — zero dangling Changeset references
pnpm run check:encapsulation
```

- [x] **Step 2: Confirm the deletions landed**

Run: `grep -rn "collectChanged\|REBIND_CHANGESET\|Changeset\|\.changeset\b" packages/core/src`
Expected: ZERO hits in production code. `Changeset` (the type), `collectChanged` (the DFS), `REBIND_CHANGESET`, and any `result.changeset` read are all gone. Any remaining hit is a missed migration — fix it before reporting.

Run: `grep -rn "result.structural\|result.changes\|removedIds" packages/core/src/features/tokens/model/commit.ts`
Expected: the new routing reads are present.

- [x] **Step 3: Confirm clean and report**

`git status` must be clean (everything committed task-by-task, path-scoped). Report: the core suite pass count, the storybook react/vue counts, and confirm typecheck + encapsulation guard green.

---

### Task 8: Write the Phase 3 plan (phase chaining)

- [x] **Step 1: Invoke the superpowers:writing-plans skill** to produce `docs/superpowers/plans/2026-06-13-one-fresh-truth-phase3.md` for **Phase 3 — one fresh truth** from the spec (`docs/superpowers/specs/2026-06-13-tokenmodel-one-fresh-truth-design.md`, Phase 3): expose `tokens()`/`at()` on the public API (the always-fresh reconciled tree); migrate the 6 `freshTokens` production call sites + the ~7 core `tree()` consumer reads to `tokens()`; delete `utils/freshTokens.ts` (+ its 18 staleness comments); move `renderTree` (today's `tree` Computed) to the `markput/adapter` import as the renderer-only contract. Ground the plan by reading FIRST, with fresh eyes, the post-Phase-2 code: `packages/core/src/features/tokens/utils/freshTokens.ts` and EVERY `freshTokens(` call site (grep across `packages/core/src` — SelectionController, BlockController, and the rest), `packages/core/src/features/tokens/model/TokenModel.ts` (the `tree` Computed, `#reconciled`, the boundary facade's `#reconciled().tokens` reads), `packages/core/src/features/tokens/index.ts`, and the adapter entry points that import `tree` (`packages/react/markput/src/**`, `packages/vue/markput/src/**` — the Container/Token selectors). No placeholder steps — every step shows exact code; bite-sized TDD tasks; frequent path-scoped commits. Start with the required plan header (Goal / Architecture / Tech Stack / Commits-in-a-shared-checkout / Spec / Background facts). The LAST task of the Phase 3 plan must be "write the Phase 4 plan" (phase chaining). Verification commands MUST follow this plan's Tech Stack note: `pnpm -F core test`, `pnpm -F storybook test` / `test:react` / `test:vue`, `pnpm run typecheck`, `pnpm run check:encapsulation` — NEVER `pnpm -F react test` or `pnpm -F vue test` (silent no-ops).

- [x] **Step 2: Commit the plan**

```bash
git commit -m "docs(plan): one-fresh-truth phase 3 — one fresh truth" -- docs/superpowers/plans/2026-06-13-one-fresh-truth-phase3.md
```