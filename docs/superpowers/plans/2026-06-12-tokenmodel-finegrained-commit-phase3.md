# TokenModel Fine-Grained Commit (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 3 of `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md` — changeset-routed commits: pure text edits patch the DOM directly (no adapter re-render, no full re-index), structural edits invalidate the renderer; dev-mode divergence detector; render-count gates. **This plan ends the phase chain — its final task is the overall completion check, no Phase 4 handoff.**

**Architecture:** Routing happens at the signal layer, not via a new event. `TokenModel` gains a `structure` computed whose **reference only changes when the changeset is structural** — both adapters (React `useSyncExternalStore`, Vue `effect`+`shallowRef`) naturally skip re-rendering when their snapshot is reference-equal, which is this codebase's idiomatic equivalent of the spec's sketched `structureInvalidated` event (deliberate refinement; the spec called its contract a "Sketch"). On the text path, a new `#patchCommit()` refreshes the existing DOM index in place (paths are unchanged by definition of the text path), patches `textContent` for changed text tokens, syncs handles, and fires `indexed` — the adapter never runs.

**Routing decision (locks the question left open in Phase 2's README):** text path ⇔ `changeset.kind === 'delta'` AND `added`/`removed` empty AND every `textChanged` id belongs to a **text** token. A `textChanged` **mark** routes STRUCTURAL — mark components render `value`/`meta` as framework props, so a mark content change requires the renderer (conservative and correct for custom Mark components).

**Key facts from the landed codebase (verified during planning):**
- React: `Container` subscribes to `s.tokens.current` through `useMarkput` (`packages/react/markput/src/lib/hooks/useMarkput.ts` — `useSyncExternalStore` over a `computed` + `watch`); re-render is skipped when `getSnapshot()` returns a reference-equal value. `host.rendered()` fires from `useLayoutEffect` in Container. Vue mirrors this with `effect` + `shallowRef` (`packages/vue/markput/src/lib/hooks/useMarkput.ts`).
- Text tokens render as `<Span value={content} />` — content is a **prop**, not JSX children (`packages/core/src/features/slots/resolveSlot.ts:59-60`); the visible text is written by `reconcileTextSurfaces` (`packages/core/src/features/tokens/reconcileTextSurfaces.ts`), whose `textContent` write is **already conditional** (line 17). React never touches `textContent`, so a patched surface cannot be clobbered by a later React render. A custom `Span` that renders `{value}` as children makes the vdom go stale on the text path — the divergence detector plus the conditional patch keep the DOM correct, and the next structural render re-syncs the vdom; document this in Task 6.
- `TokenModel.#commit()` (`TokenModel.ts:~470`): buildIndex → `#byId` rebuild → `batch(syncHandles + domVersion++)` → `indexed()`. `changeset()` exists, nothing consumes it yet. `#reconciled` is the computed producing `{tokens, changeset}`.
- SelectionController watches `tokens.indexed` → `#reconcileSurfaces()` + `#applyRange()`; caret restoration relies on the range signal + `#applyRange`, and the browser's own caret is already correct after a contentEditable keystroke.
- Core specs simulate the adapter manually (`host.rendered()` after hand-built DOM) — perfect for reference-stability specs; React render-count specs live in the storybook project (`packages/storybook/src/pages/**/*.react.spec.tsx`, vitest-browser-react).

**Conventions:** repo root `/Users/ruliny/Git/marked-input`; `pnpm -F core test`, filtered `pnpm -w exec vitest run --project core <fragment>`; react project `pnpm -w exec vitest run --project react`; typecheck `pnpm -F core typecheck`; guard `pnpm run check:encapsulation`. Style: tabs, single quotes, no semicolons, no trailing newline. One task per commit.

---

### Task 1: routing classifier + `structure` computed (TDD, core only)

**Files:**
- Create: `packages/core/src/features/tokens/commitRouting.ts`
- Create: `packages/core/src/features/tokens/commitRouting.spec.ts`
- Modify: `packages/core/src/features/tokens/TokenModel.ts`

- [ ] **Step 1: Failing spec**

`commitRouting.spec.ts` — pure unit tests for the classifier plus mounted tests for the computed:

```ts
// classifier (pure): full → structural; delta with added/removed → structural;
// delta textChanged containing a MARK id → structural; delta with only
// text-token textChanged/shifted → text path.
// computed (mounted, mountWithMark pattern from TokenModel.facade.spec.ts):
//  - const before = store.tokens.structure()
//  - tail text edit via edit.replace → structure() REFERENCE-EQUAL to before
//    (toBe), while current() is a new array
//  - structural edit (insert a new mark via replace) → structure() is a NEW
//    reference whose content deep-equals current()
```

Write as real code; pin fixtures as the existing specs do. The classifier needs token-type lookup for textChanged ids — pass it the reconciled tree + changeset (`isTextPath(tokens, changeset, idOf)`); use `idOf` to map ids back (build a Map<number, Token> over the tree).

- [ ] **Step 2: Implement**

`commitRouting.ts`:

```ts
import type {Token} from './parser/types'
import type {Changeset} from './tokenIdentity'

/**
 * Text path ⇔ delta with no added/removed and every textChanged id is a TEXT
 * token. A textChanged MARK routes structural: mark components render
 * value/meta as framework props, so the renderer must run.
 */
export function isTextPath(tokens: readonly Token[], changeset: Changeset, idOf: (t: Token) => number): boolean {
	if (changeset.kind !== 'delta') return false
	if (changeset.added.length > 0 || changeset.removed.length > 0) return false
	if (changeset.textChanged.length === 0 && changeset.shifted.length === 0) return true
	const textChanged = new Set(changeset.textChanged)
	let pending = textChanged.size
	const stack = [...tokens]
	while (stack.length > 0 && pending > 0) {
		const token = stack.pop()
		if (!token) break
		if (textChanged.has(idOf(token))) {
			if (token.type !== 'text') return false
			pending--
		}
		if (token.type === 'mark') stack.push(...token.children)
	}
	return true
}
```

TokenModel: add the `structure` computed — reference-stable across text-path commits:

```ts
	#lastStructure: Token[] | undefined

	/**
	 * Renderer contract: the token tree for STRUCTURAL rendering. Reference-
	 * stable across text-path reconciles, so adapters subscribed via snapshot
	 * comparison (React useSyncExternalStore, Vue shallowRef) skip re-rendering
	 * on pure text edits. Refined form of the design spec's sketched
	 * structureInvalidated event — signal-idiomatic for this codebase.
	 */
	readonly structure: Computed<Token[]> = computed(() => {
		const {tokens, changeset} = this.#reconciled()
		if (this.#lastStructure && isTextPath(tokens, changeset, t => this.#identity.idOf(t))) {
			return this.#lastStructure
		}
		this.#lastStructure = tokens
		return tokens
	})
```

(Same once-per-wave purity argument as the existing PURITY NOTE — reference it. `current()` stays as-is; consumers needing live content keep using it.)

- [ ] **Step 3: Green + full suite + commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): commit routing classifier and reference-stable structure computed"
```

---

### Task 2: `#patchCommit` — the text path (TDD, core only)

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.ts`
- Create: `packages/core/src/features/tokens/TokenModel.patch.spec.ts`

- [ ] **Step 1: Failing spec**

`TokenModel.patch.spec.ts` (manual-adapter mount): mount `'he@[x]llo'`-style fixture, render once. Then a tail text edit via `edit.replace` WITHOUT calling `host.rendered()` again (the adapter wouldn't re-render — structure is reference-stable). Assert:
- the text surface's `textContent` was patched to the new content;
- `indexed` fired exactly once more (watch-spy);
- the edited token's handle fired `{kind: 'text', previous}` and `handle.text()` is fresh;
- `boundaryFor`/`tokenAt` resolve correctly at post-edit positions (index addresses refreshed in place);
- a STRUCTURAL edit still requires `host.rendered()` (no patch): after a mark-inserting replace without rendered(), the index still reflects… — pin actual current behavior: the patch path must NOT fire for structural changes (watch-spy on indexed stays quiet until rendered()).
- the editable/readOnly attributes survive (contentEditable still set on the patched surface).

- [ ] **Step 2: Implement**

In TokenModel's constructor `host.onMounted`, alongside the existing rendered-watch:

```ts
			watch(this.#reconciled, ({tokens, changeset}) => {
				if (!this.#hasCommitted) return // first paint must come from the adapter
				if (!isTextPath(tokens, changeset, t => this.#identity.idOf(t))) return // structural: adapter re-renders (structure ref changed) → rendered() → #commit
				this.#patchCommit()
			})
```

`#patchCommit()` (guarded by the same `#committing` re-entry flag):
1. Refresh index addresses in place: paths are unchanged on the text path, so for each `[key, node]` of `#byPath`, compute `address = this.index().addressFor(node.path)`; build new `TokenNode`s (the type is readonly) preserving the element references; rebuild `#byPath`/`#byElement`/`#byId` from these (`#byElement` re-set for tokenElement/rowElement/childSequenceHost as buildIndex does — extract a tiny shared helper from buildIndex if duplication looms, e.g. export `indexNodeElements(node, byElement)`).
2. Patch text: for each id in `changeset.textChanged`, `const node = #byId.get(id)`; conditional write `if (node?.textElement && node.textElement.textContent !== content) node.textElement.textContent = content` (content from the refreshed address token). This is `reconcileTextSurfaces`' write, scoped to changed ids — the sweep's contentEditable/tabindex responsibilities stay with the existing `reconcileSurfaces` wiring (SelectionController's watches still call it on `indexed`; that satisfies the spec's "dissolution": the text path no longer relies on the full sweep for content, and the sweep's remaining writes are all conditional/cheap).
3. `batch(() => { this.#syncHandles(); this.#domVersion(this.#domVersion() + 1) })` — same as `#commit`.
4. `this.indexed()`.
5. Track `#hasCommitted = true` set in `#commit()`.

Caret note (document in code): on the text path the browser's caret is already correct (the keystroke happened in that surface); `indexed` still triggers SelectionController's `#applyRange`, which re-places from the range signal exactly as it does today after a full commit — behavior unchanged, so IME/composition risk is not increased by this task (Non-goal in the design spec).

Edge to handle: `#patchCommit` runs only when a container exists and `#byPath` is non-empty; otherwise wait for the adapter.

- [ ] **Step 3: Green + full suite + typecheck + commit**

The FULL suite is the regression gate — every existing spec calls `host.rendered()` manually after DOM changes; the new watch must not double-commit (rendered() after a patch re-runs `#commit` — idempotent by construction; verify no spec breaks).

```bash
git add -A packages/core
git commit -m "feat(tokens): patch commits — text-path edits update DOM and index without the renderer"
```

---

### Task 3: divergence detector

**Files:**
- Modify: `packages/core/src/features/tokens/TokenModel.ts` (or a small `divergence.ts`)
- Test: extend `TokenModel.patch.spec.ts`

- [ ] **Step 1: Failing spec**

A test that manually corrupts a text surface (`span.textContent = 'WRONG'`) and triggers a commit → expect the detector to throw with the token's path/address in the message. And a happy-path test that normal commits never throw.

- [ ] **Step 2: Implement**

```ts
const VERIFY_DOM = import.meta.env?.DEV ?? true // bundlers strip in prod builds; always on in vitest
```

(Verify how `import.meta.env` behaves in the vite lib build — if unavailable, use `process.env.NODE_ENV !== 'production'` guarded by typeof, or a module flag set true and rely on the library build docs; pick what the build actually supports and document.) After every `#commit` AND `#patchCommit`: iterate `#byPath`, for each node with a `textElement`, resolve its token; if `textContent !== content`, throw `new Error('TokenModel divergence at [path]: DOM "<...>" ≠ model "<...>"')`. Run it INSIDE the committing guard so the throw fails loud, as the design spec demands.

- [ ] **Step 3: Green ×full suite (detector active across every existing spec — that's the point) + commit**

```bash
git add -A packages/core
git commit -m "feat(tokens): dev-mode divergence detector — DOM text must match the model after every commit"
```

---

### Task 4: adapters subscribe to `structure`

**Files:**
- Modify: `packages/react/markput/src/components/Container.tsx` (the `s.tokens.current` subscription → `s.tokens.structure`)
- Modify: the Vue equivalent (`packages/vue/markput/src/.../Container.vue` — find the `tokens.current` consumption; same swap)
- Test: existing storybook specs are the regression gate

- [ ] **Step 1: Swap the subscription in both adapters**

Read each Container first. Only the STRUCTURAL render subscription changes; anything reading token content for rendering (e.g. `<Span value={token.content}>`)… NOTE: token objects inside `structure()` are stale on the text path BY DESIGN (content prop stale; textContent patched directly). Verify `Token.tsx` doesn't read anything that must be fresh on the text path (key derivation, address registration). If Token registers addresses from the stale tree, confirm `handleAt`/index refresh (Task 2's in-place address rebuild) keeps lookups working — core patch spec already asserts this; the storybook suites assert end-to-end.

- [ ] **Step 2: Run the react + vue storybook suites**

`pnpm -w exec vitest run --project react` and `--project vue` — green. Plus full core suite.

- [ ] **Step 3: Commit**

```bash
git add -A packages
git commit -m "feat(adapters): containers render from tokens.structure — text edits skip the framework"
```

---

### Task 5: render-count gates

**Files:**
- Extend: `packages/core/src/features/tokens/commitRouting.spec.ts` (core watch-spy: structure ref stability already covered in Task 1 — add an end-to-end count: N text edits → structure watcher fired 0 times, indexed fired N times)
- Create: a React render-count spec in `packages/storybook/src/pages/` following the existing `*.react.spec.tsx` patterns: custom `Span` component with a `vi.fn()` render spy passed via the public prop; type a character into the rendered editor (vitest-browser-react interaction); assert spy call count does NOT increase for a pure text keystroke, then perform a structural edit (complete a markup) and assert it DOES re-render.

- [ ] **Step 1: Write both specs (failing only if Tasks 1–4 are wrong — these are the design-spec gates: text edit → 0 renderer invocations, structural → ≥1)**
- [ ] **Step 2: Green; investigate honestly if the React spec shows extra renders (useSyncExternalStore re-snapshot without commit is allowed; assert COMMITTED re-renders via the spy, not snapshot calls)**
- [ ] **Step 3: Commit**

```bash
git add -A packages
git commit -m "test: render-count gates — text edits bypass the renderer, structural edits invoke it"
```

---

### Task 6: docs + flags

**Files:**
- Modify: `packages/core/src/features/tokens/README.md`
- Modify: `packages/core/src/features/tokens/commitRouting.ts` (FINE_GRAINED escape hatch if not already)

- [ ] **Step 1:** Add a `FINE_GRAINED = true` module flag (same pattern/JSDoc as `INCREMENTAL`) gating the `#patchCommit` watch — build-time A/B hatch.
- [ ] **Step 2:** README Phase 3 section: routing rule as implemented (incl. the mark-textChanged→structural decision), `structure` vs `current` contract for adapter authors (custom Span children staleness caveat + why the divergence detector keeps it honest), `#patchCommit` mechanics, divergence detector, both flags. Resolve the Phase 2 README's open "Phase 3 decision" note — it's decided now.
- [ ] **Step 3:** Gates: full core + react + vue suites, typecheck, encapsulation. Commit:

```bash
git add -A packages
git commit -m "docs(tokens): fine-grained commit documentation and FINE_GRAINED flag"
```

---

### Task 7: overall completion check — END OF CHAIN

No Phase 4. This task closes the spec.

- [ ] **Step 1: Run every gate from the design spec's phasing table**
  - Phase 1: `pnpm -F core test` + `pnpm run check:encapsulation`
  - Phase 2: equivalence property specs green ×3; bench numbers present in `parser.bench.result.json`
  - Phase 3: render-count specs green; divergence detector active across the suite
  - All: `pnpm -F core typecheck`, react + vue project suites
- [ ] **Step 2: Mark the spec implemented** — add a `**Status:** Implemented (Phases 1–3 complete, YYYY-MM-DD)` line to `docs/superpowers/specs/2026-06-11-tokenmodel-dom-encapsulation-design.md` and tick any remaining plan checkboxes across the three plan files.
- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: TokenModel DOM encapsulation spec implemented — phases 1-3 complete"
```

---

## Done criteria (design-spec Phase 3 gates)

- Routing: text path patches without renderer; `added`/`removed` (and mark-content changes) invalidate it ✓ (Tasks 1–2, 4)
- Divergence detector active in all tests ✓ (Task 3)
- Render-count: text edit → 0 committed renderer invocations; structural → ≥1 ✓ (Task 5)
- Chain closed: spec marked implemented ✓ (Task 7)
