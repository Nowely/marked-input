# TokenModel Fine-Grained Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or workflow-orchestrated equivalent (implement → dual review → judge → fix per task). Steps use checkbox (`- [x]`) syntax.

**Goal:** Implement `docs/superpowers/specs/2026-06-12-tokenmodel-finegrained-consolidation-design.md` — LiveNode id-keyed layer as the single source of truth, one commit pipeline with zero flags, minimal renamed public API, deletion of all dual mechanisms, and deep reconcile bringing block-mode typing onto the text path.

**Architecture:** Clean-room rewrite (Approach B with containment): B1 builds `features/tokens/model/` additively with its own TDD suite while the old core and its 672-test suite stay untouched and green; B2 is ONE atomic cutover commit (shell swap + consumer/adapter migration + old-file deletion + spec adaptation) landing only when everything is green; B3 adds deep reconcile on the settled core, property-gated.

**Read the spec FIRST in every task.** It contains the decided contracts (LiveNode shape, pipeline branches, pendingStructural latch, API surface, kill list, old-spec dispositions, descend conditions, changeset evolution). This plan adds file-level mechanics; the spec is authority on contracts.

**Standing context for every task:**
- Repo `/Users/ruliny/Git/marked-input`, branch `b0`. Style: tabs, single quotes, no semicolons, `import type`, NO trailing newline. Lint-staged on commit.
- Commands: core `pnpm -F core test` (672 green at start); filtered `pnpm -w exec vitest run --project core <fragment>`; react `pnpm -w exec vitest run --project react` (217); vue `--project vue` (199); typecheck `pnpm -F core typecheck`; guard `pnpm run check:encapsulation`; bench `pnpm -F core run test:bench` (browser; parser.profile.bench.ts failure is pre-existing, ignore).
- Existing landmarks: `TokenModel.ts` (~685 lines: handles registry, #rebuildIndex/#patchCommit, facade), `patchCommit.ts` (preparePatch/assertNoDivergence/VERIFY_DOM), `commitRouting.ts` (isTextPath/FINE_GRAINED), `tokenIdentity.ts` (reconcile/changeset/idOf/idFor), `incrementalParse.ts` (INCREMENTAL), `buildIndex.ts` (+indexNodeElements), `reconcileTextSurfaces.ts`, `tokenIndex.ts` (createTokenIndex/pathKey/pathEquals/resolvePath), `domTypes.ts` (TokenNode/Lookup), `boundary.ts` (BoundaryContext over locate/nodeFor/nodes), `caret.ts`, `textOffsets.ts`, `MarkController.ts` (id-bridged), `TokenHandle.ts`. Adapters: react+vue Containers on `tokens.structure`, Token/menus on `tokens.structureIndex`, useMarkInfo aligned, useMark via MarkController.
- The signals runtime (`shared/signals/signal.ts`): `signal({initial})`, `computed`, `event<T>()`, `watch`, `batch`, equality cutoff on computeds (same-reference return → no downstream invalidation), effects flush at batchDepth 0. Verified facts from Phases 1–3: computeds run at most once per change wave; `watch(event, cb)` receives `(payload, oldValue)`.

---

## B1 — clean-room core (old suite untouched; every task additive)

### Task 1: `model/LiveNode.ts` — the node record + its handle face (TDD)

**Files:** Create `packages/core/src/features/tokens/model/LiveNode.ts`, `model/LiveNode.spec.ts`.

- [x] **Step 1 — failing spec.** Cover the contract from the spec §LiveNode: creation from `(id, token, path)`; `dirty` per-node signal; handle getters (`token()`, `address()` = `{path, token}` derived, `element()`, `text()`, `dead()`) tracking ONLY this node's `dirty`; the **fine-grained isolation gate**: two nodes, bump A's dirty → B's computeds don't re-evaluate (assert via an evaluation-counting computed wrapper or watch-spy on B); commands (`placeCaret`/`placeCaretAtBoundary`/`placeCaretAtX`/`focus`) no-op false when no elements bound or dead; measurement methods (`textLength`/`caretIndex`/`caretRect`/`rect`/`caretOnFirstLine`/`caretOnLastLine`/`hasTextSurface`) over the bound elements (adapt the bodies from `TokenHandle.ts` — they are correct; this is a move, not a redesign); dead contract (kill → unmounted event once, stale reads return last token, commands false, never resurrected); `changed: Event<TokenChange>` with kinds `text`/`moved`/`unmounted` (drop the never-emitted `mounted` variant — the type shrinks).
- [x] **Step 2 — implement.** One class (suggested name `TokenHandle`, kept — it IS the public face; the file hosts the mutable node state inside it). Internal mutable fields: `token`, `path`, element bindings; `update(token, path)` (internal) sets fields, fires `text`/`moved` per the same comparison logic as today's `sync`, bumps `dirty`; `bindElements(...)`/`unbind()` internal setters; `kill()` as today. Address derived on read (`{path: [...this.path], token: this.token}`). No global version, no snapshots, no `HandleHost`.
- [x] **Step 3 — green (filtered), full suite still green (nothing imports model/), commit** `feat(tokens): LiveNode — single live record per token with per-node reactivity`.

### Task 2: `model/bind.ts` — the structural DOM walk (TDD)

**Files:** Create `model/bind.ts`, `model/bind.spec.ts`.

- [x] **Step 1 — failing spec.** Adapt scenarios from `buildIndex.spec.ts` (inline, block rows, child-sequence hosts, control elements, all-or-nothing bail) to the new contract: `bind(input)` receives `{container, tokens, idFor, nodes: Map<number, TokenHandle>, controlElements, childSequenceHostsFor, isBlock, editable: {editable, readOnly}}` and RETURNS `{byPath, byElement, controlRoots}` while MUTATING the node map: creates handles for new ids (`new TokenHandle(id, token, path)`), updates existing (token/path/elements via `update`+`bindElements`), kills+removes ids absent from the new tree, applies contentEditable/tabindex to **newly bound** text surfaces and mark roots (mount-time application — absorb the per-node logic of `reconcileTextSurfaces.ts`, conditional writes preserved). Walk logic: adapt `buildIndex.ts` (same frame/stack walk, same row semantics) — this is an adaptation, not a redesign; keep its tests' semantics intact.
- [x] **Step 2 — implement** (pure function + the node-map mutations; no TokenModel dependency).
- [x] **Step 3 — green, full suite green, commit** `feat(tokens): bind — structural DOM walk onto the live node layer`.

### Task 3: `model/commit.ts` — the one pipeline (TDD)

**Files:** Create `model/commit.ts`, `model/commit.spec.ts`.

- [x] **Step 1 — failing spec.** Scenarios (carry over from `TokenModel.patch.spec.ts` + `commitRouting.spec.ts` routing cases, restated against the new seam): text-path apply without renderer (in-place node updates, conditional textContent patch, ONLY changed nodes' dirty bumped — reuse the isolation gate, `changed(changeset)` fired once, DOM consistent); structural apply (tree signal reassigned → simulated renderer rebuilds DOM → `rendered()` → bind runs → `changed` fired after bind); `pendingStructural` latch (between structural reconcile and bind, id-bridged resolve returns undefined — mutation fails closed; latch clears after bind); escalation (a text-path apply that finds a missing target/unresolvable path falls back to the structural branch); cold start (first commit = structural with full bind); divergence detector throws on hand-corrupted DOM in dev (white-box where self-healing prevents black-box, as today — port the rationale).
- [x] **Step 2 — implement.** `createCommitPipeline(deps)` returning `{apply(reconcileResult), onRendered(), tree: Computed<Token[]>, changed: Event<Changeset>, pending(): boolean, ...}` — deps injected (container getter, node map, parse/reconcile access, editable-state getter). Routing inline (~5 lines): `const textPath = changeset.kind === 'delta' && changeset.added.length === 0 && changeset.removed.length === 0` plus a DEV assertion that textChanged ids are text tokens. Divergence check (port `assertNoDivergence` minus the dead VERIFY_DOM bundler prose — keep the `import.meta.env?.DEV ?? true` guard with its verified one-paragraph comment). No flags.
- [x] **Step 3 — green, full suite green, commit** `feat(tokens): commit — one pipeline, text and structural branches of a single apply`.

### Task 4: `model/TokenModel.ts` — the thin public shell (TDD)

**Files:** Create `model/TokenModel.ts`, `model/TokenModel.spec.ts`.

- [x] **Step 1 — failing spec.** The 12-member public surface from the spec §API: `tree`/`changed`; `handleFor/handleAt/tokenAt/handles/handleOf`; facade reads+commands (delegate to `boundary.ts`/`caret.ts` reading the NODE LAYER — port `#boundaryContext` to a nodes-backed context: `locate` via byElement walk-up, `nodeFor` via byPath, `nodes()` over the map); `control()/children()` refs (port as-is); selection reads (port as-is). Assert parity on a fixture against the OLD TokenModel where cheap (mount two stores — old via Store, new via the construction seam — same DOM shape, compare `boundaryFor` probes); plus `handleOf` (fresh token → handle; stale token (pre-edit object) → same handle via id; foreign → undefined, no id allocation — use `idFor`).
- [x] **Step 2 — implement** the shell: constructs identity tracker, parse pipeline (`incrementalParse` minus flag — windowed always, full on cold/unstable as internal branches), reconcile, commit pipeline; wires `host.onMounted` (rendered → onRendered; value watch → apply). Export a `createTokenModel(value, props, host)` construction seam compatible with Store's wiring expectations (read `store/Store.ts` first).
- [x] **Step 3 — green, full suite STILL green (old core untouched), typecheck clean, commit** `feat(tokens): model shell — tree, changed, handles and facade over the live node layer`.

---

## B2 — the atomic cutover

### Task 5: cutover (ONE commit)

**Files:** Modify `store/Store.ts` (wire new model), every internal consumer, both adapters, the tokens barrel; delete old files; adapt specs per the spec §Old-spec disposition.

- [x] **Step 1 — wire + migrate.** Store constructs the new TokenModel. Consumer migration map (grep-verify each, this list was current at planning):
  - `SelectionController.ts`: `tokens.indexed` watch → `tokens.changed`; `#reconcileSurfaces`/`reconcileSurfaces()` calls → delete (replaced by an internal editable setter the model exposes to its own prop-watch wiring — decide: model watches `props.readOnly` + an injected `isUserSelecting` signal itself, OR SelectionController calls a scoped `tokens.setEditable({...})`; pick the one that keeps SelectionController policy-only and document).
  - `keyboard/blockEdit.ts`, `arrowNav.ts`, `inputRange.ts`, `input.ts`, `overlay/*`, `clipboard/*`, `block/BlockController.ts`, `slots/*`: facade calls survive verbatim; `tokens.current()` reads → `tokens.tree()` where structural, or node-layer reads where positional (grep `tokens.current\(`); `tokens.index()` uses → handle/byPath equivalents (`addressFor([i])` in blockEdit → `tokens.handleFor`-style lookup or a kept `addressFor` facade helper — decide smallest surface that avoids re-adding an index object).
  - React+Vue: `structure` → `tree`; `structureIndex` lookups → `handleOf(token)`; `useMarkInfo` accordingly. MarkController: `freshAddressFor` call → the internal bridge the new model exposes (or `handleOf(token)?.address()` — pick and document; preserve fail-closed under `pendingStructural`).
- [x] **Step 2 — delete:** `patchCommit.ts`, `commitRouting.ts`, `reconcileTextSurfaces.ts`, `domTypes.ts`, `createTokenIndex` (+`TokenIndex` type) from `tokenIndex.ts` (keep path utils), old `TokenModel.ts`, old `TokenHandle.ts`, `INCREMENTAL` flag from `incrementalParse.ts`. Barrel: export the new surface (`TokenHandle`, `TokenChange`, `Changeset`, `EditHint`, `MarkController`, parser utils as today) — nothing dead.
- [x] **Step 3 — adapt specs** per disposition (keep / adapt / replace lists in the spec §Old-spec disposition). The replaced `TokenModel.patch.spec.ts` scenarios must already exist in `model/commit.spec.ts` — verify coverage equivalence before deleting, list any gap and close it.
- [x] **Step 4 — gates, all green in ONE commit:** core (672-equivalent — count may shift with adapted specs; NOTHING skipped), react 217, vue 199, typecheck, encapsulation guard, bench run (no regression vs `parser.bench.result.json` last entry; note browser hand-recording constraint). Commit `refactor(tokens)!: cutover to the live node core — one source of truth, zero flags`.
- [x] **Step 5 — README rewrite** (separate commit, same task): `features/tokens/README.md` rewritten to describe ONLY the consolidated architecture (no phase archaeology): LiveNode layer, one pipeline, API surface, descend rules placeholder (B3 updates it), flags section reduced to the dev detector. Keep parser/bench sections. Also regenerate website typedoc if API docs reference renamed members (`pnpm -F website typecheck` or the typedoc script — check how it regenerates). Commit `docs(tokens): consolidated architecture documentation`.

---

## B3 — deep reconcile (block typing onto the text path)

### Task 6: deep descend + changeset evolution (TDD, property-gated)

**Files:** Modify `tokenIdentity.ts` (+spec), `model/commit.ts` (dev assertion), barrel types; extend both property specs.

- [x] **Step 1 — failing specs.** Unit (tokenIdentity.spec.ts): in-slot edit on `'#[ab]tail'`-class and slot-leading `'__slot__\n\n'`-class fixtures (pin against real parser output as the file already does) → child text gets `textChanged` with stable id; the mark lands in `updated` with SAME id and updated token; mark handle still receives `text` change at the handle layer (that wiring is commit.ts's — assert at the right seam); descend REFUSED when: value/meta differ, child count differs, child type mismatch, edit touches outside the slot (each → today's mark-level textChanged). Rename `shifted` → `updated` across the type + all existing assertions (mechanical; old `shifted` semantics are a subset).
- [x] **Step 2 — implement** in `reconcile`'s middle/suffix pairing: when an id-matched mark fails `tokensEqualShifted` only inside the slot (conditions 1–4 of spec §Descend), recurse pairwise over children scoped to the slot window; emit child buckets; put the mark in `updated`. Add the `===` fast path to `tokensEqual`/`tokensEqualShifted` while here (one line, spec'd in the consolidation motivation).
- [x] **Step 3 — property extensions:** in-slot edit class added to the slot + slot-leading property runs (output ≡ full parse — invariant unchanged; child ids stable across in-slot edits; mark id stable). 3 consecutive runs + one 1000-iteration soak (temporary bump, restore).
- [x] **Step 4 — routing:** commit.ts already routes on added/removed only; verify the dev assertion (textChanged ⊆ text tokens) still holds BY CONSTRUCTION and keep it dev-only. Full gates + commit `feat(tokens): deep reconcile — in-slot edits emit child-level changes, marks become updates`.

### Task 7: block render-count gate + docs close-out

- [x] **Step 1 — block gate.** New storybook spec (react; copy `renderCount.react.spec.tsx` patterns) with a block-layout story: real keystroke into a row → Span/Mark spy delta 0, DOM patched; structural edit (new row) → delta > 0. If the existing block stories lack a suitable fixture, add a minimal one following the existing story conventions. Vue mirror if cheap (note if skipped).
- [x] **Step 2 — README §descend rules** filled in (B3 landed); memory of the Phase 2 "inline-only bypass" caveat updated to "render bypass covers block typing; parse stays full for block markups".
- [x] **Step 3 — full gates everywhere + commit** `test: block typing joins the render bypass — gate and docs`.

### Task 8: completion check

- [x] Run EVERY gate (core/react/vue suites, typecheck, guard, properties ×3, bench, both render gates incl. block). Spot-check the kill list is fully dead (grep: `structureIndex|FINE_GRAINED|INCREMENTAL\b|reconcileTextSurfaces|createTokenIndex|TokenNode|preparePatch|patchCommit|commitRouting|freshAddressFor|changeset\(\)|\.indexed\b`— each must return only historical docs/plans). Update the consolidation spec Status to `Implemented (YYYY-MM-DD)`. Tick this plan's checkboxes. Commit `docs: consolidation implemented — one source of truth, fine-grained throughout`.

---

## Done criteria

- One source of truth (LiveNode), one pipeline, zero flags; kill-list grep clean ✓ (T1–T5, T8)
- Minimal public surface exactly as spec'd; adapters simpler (handleOf) ✓ (T4–T5)
- Fine-grained isolation gate green (edit A → B silent); O(change) producer behavior ✓ (T1, T3)
- All pre-existing gates green (properties, parity, render counts, bench, divergence, guard) ✓ (T5, T8)
- Block typing on the text path with its own render gate ✓ (T6–T7)
