# TokenModel Fine-Grained Consolidation — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pending implementation plan
**Predecessor:** `2026-06-11-tokenmodel-dom-encapsulation-design.md` (Phases 1–3, implemented). This spec supersedes its *internal architecture* while keeping its facade contract and its gates.

## Motivation

Phases 1–3 delivered the fine-grained machinery but grew **additively**: each phase bolted new mechanisms beside the old instead of replacing them. The branch now carries two token trees (`current`/`structure`), two indexes (`index`/`structureIndex`) plus three rebuilt-per-keystroke maps, two commit paths (`#rebuildIndex`/`#patchCommit`), two text-writing mechanisms (sweep + patch), three flags, orphan publics (`changeset()`, `idOf()`), unreachable defensive branches, and comment strata justifying the coexistence. Truth is smeared across overlapping structures; the producer side of the pipeline is still O(document) per keystroke under fine-grained branding.

This effort consolidates: **one source of truth, one pipeline, zero flags, minimal API, O(change) updates** — and finishes the original mission by bringing **block-mode typing onto the text path** (deep reconcile).

## Decisions

1. **Source of truth:** the id-keyed live node layer. Trees and lookups are derived views.
2. **Deletion policy:** one pipeline, zero flags. Full parse and full DOM bind survive only as internal cold-start/structural/unstable-window branches of the single pipeline. The `reconcileTextSurfaces` sweep dies (mount-time + prop-change application). `INCREMENTAL` and `FINE_GRAINED` deleted. The divergence detector survives (dev/test-only) as the last step of both pipeline branches.
3. **API surface:** minimal and renamed (breaking changes acceptable, as throughout this program).
4. **Scope:** consolidation **plus** block-layout deep reconcile in the same effort (staged B1→B2→B3).
5. **Approach:** clean-room rewrite (Approach B) with containment — new core built green in parallel, one atomic cutover commit, old suite as the acceptance net.

## Architecture

### LiveNode — the single source of truth

One id-keyed map of live records; each owns everything currently true about a token:

```ts
LiveNode {
	id                                   // stable identity (WeakMap-assigned, unchanged mechanism)
	token                                // the CURRENT parsed token (fresh content/positions)
	path                                 // current tree position
	tokenElement / textElement /         // DOM bindings (set by bind, cleared on unbind)
	rowElement / childSequenceHost
	dirty: Signal                        // per-node version — THE fine-grained unit
}
```

- `TokenHandle` becomes the public face of its LiveNode — same lifetime, reads through it. The `TokenNode`/`TokenHandle` duality, global `#domVersion`, and snapshot-sync machinery are deleted. Handle getters track **their own node's `dirty` signal only**: an untouched token's handle cannot recompute during someone else's edit.
- Derived lookups, maintained **in place by the changeset** (never rebuilt per keystroke): `byId` (the map itself), `byPath` (unchanged on the text path by definition; rebuilt only during structural bind), `byElement` (WeakMap, maintained at bind/unbind).
- The dead-handle contract is unchanged (unmounted-once, stale reads safe, commands no-op, never resurrected).

### The one pipeline

Every value change flows through a single `apply(reconcileResult)` with two branches of the same function:

```
value edit → parse (windowed; full only on cold start / unstable window / markup change)
           → reconcile → changeset
  ├─ text path (added/removed empty):
  │    update changed/updated nodes in place (token, positions),
  │    conditionally patch textContent of changed text surfaces,
  │    bump ONLY those nodes' dirty signals → fire changed(changeset)
  └─ structural:
       set tree signal (new reference) → renderer renders → rendered() →
       bind(container, tree): one DOM+tree walk —
         create/update/delete LiveNodes, set element bindings,
         apply contentEditable/tabindex to NEWLY BOUND text surfaces,
       → fire changed(changeset)
```

- **`pendingStructural` latch:** between a structural reconcile and its bind, the node layer is one generation stale. The pipeline sets an explicit latch for that window; id-bridged resolution (MarkController mutations, stale-address lookups) returns undefined while latched. This replaces the object-identity check in `resolveAddress` — the same fail-closed behavior as an explicit one-line gate instead of an emergent property.
- **Editable state:** contentEditable/tabindex are applied at bind time for new surfaces and by a scoped internal setter on `readOnly`/`isUserSelecting` prop changes (driven by SelectionController's existing watches). No per-commit sweep.
- **Divergence detector:** last step of both branches, dev/test-only; unchanged semantics (DOM text must equal model text; throw with path).
- **`indexed` watchers migrate to `changed`:** `changed(changeset)` fires in both branches only after the DOM is consistent, so SelectionController's caret re-place (`#applyRange`) watches `changed` exactly as it watched `indexed`. Its `#reconcileSurfaces` watch disappears with the sweep (replaced by the bind-time + prop-change application above).

### Public API (the whole surface)

```ts
// renderer contract
tree: Computed<Token[]>            // structural tree; reference changes ⇔ renderer must run
changed: Event<Changeset>          // THE model-level detector (replaces indexed + changeset())

// per-token live views
handleFor(address) / handleAt(node) / tokenAt(position) / handles()
handleOf(token): TokenHandle | undefined   // id-bridge for adapters' (possibly stale) token objects

// DOM↔model facade (unchanged from Phase 1)
boundaryFor / caretFromPoint / placeCaret / selectRange
readSelection / selectedContent / selectionRect / selectionAnchor /
isSelectionCollapsed / selectionIntersects / selectionFocusNode

// adapter refs (unchanged)
control() / children()
```

Removed from public: `current`, `structure` (renamed `tree`), `index`, `structureIndex`, `indexed`, `changeset()`, `idOf()`, `freshAddressFor()` (its machinery becomes the normal internal resolution path), `reconcileSurfaces()`.

### File map (target)

```
features/tokens/
	parser/  preparsing/        unchanged
	tokenIdentity.ts            reconcile + deep descend (B3); === fast path added
	incrementalParse.ts         flag removed — windowed parse IS the parse
	model/
		LiveNode.ts               node record + handle (one object)
		bind.ts                   structural DOM walk (buildIndex adapted to bind nodes)
		commit.ts                 the one pipeline: apply(reconcileResult)
		TokenModel.ts             thin shell: tree, changed, handles, facade delegation
	caret.ts  textOffsets.ts  boundary.ts   facade internals (boundary reads the node layer)
	MarkController.ts           survives; resolves via the id bridge
```

**Deleted:** `patchCommit.ts`, `commitRouting.ts` (routing becomes ~5 lines in `commit.ts`; the type-walk becomes a dev assertion), `reconcileTextSurfaces.ts`, `TokenIndex`/`createTokenIndex` (`tokenIndex.ts` shrinks to path-key utilities), `domTypes.ts` (`TokenNode`/`Lookup`), both flags, and coexistence-justifying comment strata (PURITY-NOTE-class comments collapse to one-liners where the pattern still exists).

**Adapters (React + Vue):** `Container` subscribes `tree`; `Token`/`BlockMenu`/`DragHandle`/`DropIndicator`/`useMarkInfo` use `handleOf(token)` instead of index lookups. Adapter code gets simpler than today.

## Cutover strategy (Approach B with containment)

- **B1 — clean-room build.** `model/` is additive; nothing imports it; the old suite stays green untouched. TDD: `LiveNode.spec`, `bind.spec`, `commit.spec` against real Stores via a temporary internal construction seam. Must-cover: the `pendingStructural` latch (mutation in the reconcile→bind window fails closed), mount-time editable application, and the **fine-grained gate** — edit token A, assert token B's handle never recomputes and its `changed` stays silent (the O(change) behavioral assertion).
- **B2 — atomic cutover.** One commit: TokenModel shell swaps to the new core; internal consumers (selection/keyboard/overlay/clipboard/block) and both adapters move to the minimal API; old files deleted; old specs adapted. Lands only when core + react + vue + typecheck + encapsulation guard are all green. The commit is the reviewable, revertable unit.
- **B3 — deep reconcile** on the settled core (below).

### Old-spec disposition (decided now)

- **Keep unchanged:** facade parity tables, selection/keyboard/overlay/clipboard/block consumer suites, TokenHandle behavior specs (minus snapshot-mechanics cases), property specs, both render-count gates, the typing bench.
- **Adapt (same scenarios, new API):** `TokenModel.changeset.spec` → `changed` event; `commitRouting.spec` routing cases → `commit.spec`; `TokenModel.index.spec` lookup renames.
- **Replace:** `TokenModel.patch.spec` → `commit.spec` (patch-without-render, structural-quiet-until-render, escalation, divergence scenarios all carry over).

## Deep reconcile (B3)

### Changeset evolution

```
{textChanged, added, removed, shifted}  →  {textChanged, added, removed, updated}
```

`updated` absorbs the old `shifted` (position-only) **plus** deep-descended container marks (content/positions changed; structure and rendered props unchanged; renderer-irrelevant). `textChanged` then contains text tokens **by construction**, and routing collapses to: **text path ⇔ `added`/`removed` empty**. The classifier's runtime type-walk becomes a dev-mode assertion.

### Descend conditions (all four, else today's conservative mark-level `textChanged` → structural)

1. Same descriptor (reference equality).
2. Mark's rendered props byte-unchanged: `value` and `meta` equal.
3. Only the slot interior changed: raw content outside the slot range equal modulo shift.
4. Children pair 1:1 structurally (same count, pairwise same type, same descriptor for nested marks) — recurse pairwise with prefix/suffix/middle logic scoped to the slot window.

Renderer-correctness argument = condition 2: the mark component's inputs are unchanged, `tree` doesn't move, the child text surface is patched directly. Handle-layer honesty is preserved: the mark's handle still fires `changed({kind:'text'})` (its content did change); buckets and handle events are separate layers.

Block typing end-to-end after B3: keystroke in a row → descend the row's slot mark → child `textChanged` + mark `updated` → text path → patch → **zero component re-renders**, proven by a new block render-count gate.

**Honest boundary:** block-mode *parse* remains a full parse (the windowed parser's inert-outside guard trips on `\n\n` segments — the Phase 2 caveat stands). B3 wins the render/DOM side, where the real per-keystroke cost lives.

## Gates

- **All existing gates stay green:** facade parity, equivalence properties (randomized, incl. slot-leading), both render-count gates, divergence detector across the suite, typing bench (no regression), typecheck, encapsulation guard, react + vue suites.
- **New gates:** fine-grained handle isolation (edit A → B silent); block render-count gate (block keystroke → 0 re-renders); property extensions for in-slot edit classes (output ≡ full parse; child ids stable across in-slot edits); dev assertion replacing the routing type-walk.

## Non-goals

- No change to parse-side complexity for block markups (full parse stays; documented).
- No new renderer/framework support; no IME/composition behavior changes; no public package-level API redesign beyond the listed TokenModel surface.
- No deep diffing when any descend condition fails — conservative fallback is the contract, not a gap.

## Execution note

Implementation runs as a workflow (user-opted): B1 partially parallel (LiveNode → bind/commit have dependencies), B2 one large sequential task with parallel review fan-out, B3 compact and property-gated. Per-task implement → dual review → judge → fix loops, as in Phases 1–3.
