# One Fresh Truth — Simplification Migration Design Spec

**Date:** 2026-06-13
**Status:** Approved (design), not implemented
**Predecessor:** `2026-06-12-tokenmodel-finegrained-consolidation-design.md` (Implemented). This spec supersedes its *public API and internal routing* while keeping its pipeline spine and all its gates.
**Source:** `docs/superpowers/research/2026-06-12-simpler-architecture-research.md` — winner "One Fresh Truth (Pragmatic Trim)" + grafts A–C; Graft D (alien-signals npm swap) deferred to a separate chore.

## Motivation

The consolidated core works (1,142 tests green, all four wins gate-pinned) but its concept census is ~20 and its public surface is ~2x what consumers use. The research verified the costs are not learnability-only:

- `freshTokens()` has 6 production call sites — more than `tree()` has legitimate fresh reads. The escape hatch outgrew the front door.
- The `handleFor(address)` + `handleOf(address.token) !== handle` validity idiom is hand-duplicated three times, twice by the API's own author.
- Three parallel identity systems (tokenIdentity WeakMap, Store.key KeyGenerator, BlockController `#stores`) with two verified latent defects: suffix-shifted tokens get spurious framework remounts; per-row drag/hover state silently resets.
- An unpinned re-render bug: the first keystroke into a freshly-Enter-created empty row escalates to a full framework re-render (TreeBuilder collapses the empty slot to `slot: undefined`; tryDescend refuses).
- A verified full-parse cliff: one `'- '` in prose defeats the inert-outside guard — realistic block documents are O(document) parse per keystroke despite the fast path.
- Win 4's per-node reactive machinery has ZERO production reactive consumers (grep across a full consolidation cycle).

Three root decisions cause most of the count: (a) `tree()` doubling as renderer contract AND consumer data source, (b) `TokenAddress = {path, token}` embedding a live object, (c) rows encoded as slot marks. This spec removes all three.

Acceptance bar: a feature author's mental model fits in two sentences — *"handles are fresh; the render tree is for renderers"* — and the tokens README shrinks from 422 lines toward ≤150.

## Decisions (user-resolved)

1. **Scope:** full migration, Phases 0–7 — the trim **plus** first-class rows in one spec. (The research suggested deferring rows; the user chose to include them.)
2. **alien-signals npm swap (Graft D):** separate chore, off this critical path. The token core still drops to one `renderTree` signal + one `changed` event, removing its dependence on the runtime's once-per-wave PURITY guarantee.
3. **`handle(path)` overload:** dropped. Lookups are `handle(id)` + `handleAt(node)`, period. Paths remain a read-only handle property, never an address.
4. **IME/composition baseline:** out of scope. Composition handling is currently absent and stays unpinned through this migration.

## The four wins, restated

| # | Win | Fate |
|---|-----|------|
| 1 | Hard DOM encapsulation | kept (encapsulation guard, boundary facade) |
| 2 | Stable token identity across edits | kept and strengthened (`token.id` unifies three systems) |
| 3 | Zero framework re-renders on typing, inline AND block | kept and extended (new empty-row gate; rows make block typing row-local) |
| 4 | Fine-grained per-node reactivity | **consciously traded** for fine-grained DOM patching — zero reactive consumers exist; render gates are satisfied by `renderTree` reference stability + direct textContent patching; no surveyed editor (CM6/PM/Lexical/Slate) puts signals on document nodes. Reversible: handle getters stay methods, so per-node signals can return behind them additively. |

## Public API (the whole consumer surface)

```ts
tokens(): Token[]                          // THE read — always the latest reconciled tree
at(index: number): TokenHandle | undefined
handle(id: Id): TokenHandle | undefined    // fail-closed mid-window
handleAt(node: Node): TokenHandle | undefined
changed: Event<void>                       // fires after the DOM is consistent (both branches)
selection(): SelectionSnapshot | undefined // one snapshot; replaces six micro-reads + the !== false tri-state
// commands: placeCaret(handle | position), selectRange, selectedContent, boundaryFor
```

`TokenHandle = {id, token(), path(), alive(), element(), caret/measure commands}` — plain getters, no signals.

**Adapter SPI** moves to a separate import (`markput/adapter`): `renderTree: Computed<Token[]>`, `keyOf(token) → token.id`, `rendered()`, `control()/children()`. `renderTree` is the renderer contract only — reference change ⇔ renderer must run — and is not consumer data.

### Pending-window read matrix

Between a structural reconcile and its bind, the node layer is one generation stale. One rule per read:

| Read | Mid-window serves |
|---|---|
| `tokens()` / `at(i)` | the latest reconciled tree — always fresh, consistent with `value.current()` |
| `handle(id)` / `handleAt(node)` | `undefined` (fail-closed; today's `handleOf` semantics) |
| boundary/position reads (facade) | the latest reconciled tree (preserves mid-window consistency with `value.current()` — the property the attack pass showed careless redesigns corrupting) |
| DOM/geometry commands | return `false`/`undefined` |
| edits | fold into the pending structural pass (the **edit-fold rule** — named, kept, admitted) |

"Pending-unbound" and "dead" are not distinguished publicly: both read as `undefined`; `changed` fires when the window closes and callers re-read. (Today's de-facto consumer pattern, now stated.)

### MarkController semantics

Re-backed by a handle (deletes `#resolveCaptured`, the `pathOf` DFS, the 11-line justification comment). `value/meta/slot/readOnly` become **live reads** of the current token — encoded deliberately in the parity tables. `update()` against a pending or dead id is a fail-closed no-op returning `false`. The pinned MarkPatch contract (incl. `meta`, slot `clear`) is unchanged.

### Internal changeset

Reconcile emits `{structural: boolean, changes: {id, token, path}[], removedIds: Id[]}` — routing decided at reconcile time; the commit-time fold guard is the only override. No `Change`/mapPos: the shape is one private type, documented as the seam where a future public delta would grow (YAGNI now).

## Grafts (adopted as design decisions)

- **A — `token.id` as a plain field**, stamped by reconcile (the parser does not freeze tokens). Deletes the `idOf`/`idFor` split, the WeakMap side table, and the foreign-token-allocation hazard. `keyOf(token) = token.id`; KeyGenerator and BlockController `#stores` re-key by id — fixing the suffix-remount and drag-state-reset defects.
- **B — attack fixes:** `handle(ref)` fail-closed mid-window; the edit-fold rule named in the concept list; the reparse trigger is one watch over the `(value, parser, isBlock)` tuple (stated, not hidden); self-heal keeps the `renderTree` publish; the empty-row fix lands **TreeBuilder-side**: `createSlotSourceInfo` stops collapsing an empty slot to `undefined` (empty slot ≠ no slot — a zero-width slot window is emitted).
  *Resolved during planning (2026-06-13):* the research recommended a tryDescend-side synthesis, fearing TreeBuilder blast radius. An empirical probe falsified both premises: the empty row already carries an empty text child (children pair 1:1 — tryDescend condition 4 was never the blocker) and an empty contenteditable span already exists as the patch target; the only collapse is the `slot` FIELD. The one-line TreeBuilder fix was verified end-to-end (new gate passes, 1,140/1,142 tests green — the 2 failures pin the old buggy behavior) and fixes the root cause instead of duplicating parser knowledge in the reconciler. Side effect, deliberately pinned: `mergeDragRows` into an empty row now actually merges (zero-width `slot.end`) instead of no-opping.
- **C — dev-mode `rendered()`-timeout warning** (~10 lines) for the adapter-forgot-the-handshake silent failure; consolidated lookup naming.

## What dies

| Dies | Replaced by |
|---|---|
| The public staleness contract (tree()-stale vs handle-fresh) | `tokens()` always fresh; `renderTree` adapter-private |
| `utils/freshTokens.ts` + 6 call sites + 18 staleness comments | `tokens()` |
| `TokenAddress = {path, token}` + `#resolveAddress` + the triple-duplicated validity idiom | the handle itself (`alive()` is the whole check); `useMarkInfo` ships `path()`/id |
| Four lookups | `handle(id)` + `handleAt(node)` |
| Changeset buckets + bucket-vs-handle honesty doctrine | `changed: Event<void>` publicly; internal `{structural, changes, removedIds}` |
| Escalation-as-routing + `collectChanged` O(tree) DFS | structural boolean set at reconcile; commitText O(change); self-heal narrowed to defensive insurance |
| Per-node dirty signals + reactive getters + isolation specs | plain getters (win-4 trade) |
| `idOf`/`idFor` + WeakMap side table | `token.id` plain field |
| KeyGenerator + BlockController `#stores` WeakMap | `keyOf = token.id`; stores re-keyed by id |
| `incrementalParse.ts` + alternation snapping + inert guard + doubling stabilization | full parse (inline); per-row parse (block, Phase 7); EditHint kept for reconcile windowing; bench kept as tripwire |
| Edit-hint signal side channel + the PURITY computed | explicit hint through a watch-callback pipeline entry |
| Dead surface: `tokenAt`, `handles()`, `caretFromPoint`, `handle.changed/.dead/.text/.caretRect/.placeCaretAtBoundary`, `address()` | — |
| Six selection micro-reads + `!== false` tri-state | one `selection()` snapshot |
| Asymmetric latch gating table | one pending-bind rule (matrix above) |
| Rows-as-slot-marks (Phase 7): `resolveSlotLeadingMatches` + Match special case (+ both "TODO need review it"), empty-slot collapse, `filterEmptyText` + dual `#lastParsed`, descend-for-rows, five `isTextLikeRow`/`isSlotLeadingMark` sniffing sites, `addDragRow` doubled-content quirk, rows-map/one-non-control-child bolt-ons | first-class Row nodes |

## What is kept (and why)

- **Two-branch commit, bind walk, `rendered()` handshake, divergence detector, boundary facade, identity-diff heuristics** — the sound core; every prior-art system validates each piece (Tiptap/Remirror independently re-grew the handshake on ProseMirror).
- **The private `latest` tree** — load-bearing: the text branch never touches `renderTree`, so binding an unrelated re-render against the published tree without it would regress the DOM and kill the caret.
- **Deep descend** — survives only for genuinely nested *inline* slot marks once rows are first-class; the Phase 0 empty-slot synthesis stays for them. Rows never reach it.
- **O(tree) reconcile per keystroke** — consciously accepted (CM6 doctrine: make DOM work O(change), accept linear diff work at this document scale). Only the avoidable half (`collectChanged`) is fixed.

## First-class rows (Phase 7 design)

> **DETACHED during implementation (2026-06-13).** Phase 7 was attempted (full row pipeline implemented; core/typecheck/encapsulation/bench green) but the pre-split design below proved **mismatched with the real block model**, so the phase was reverted and the semver-major is cut after Phase 6. The mismatch: the spec/research framed block rows as `'__slot__\n\n'` slot-leading marks split on a `'\n\n'` terminator, but the actual block mode is more general — **each top-level token is a block/row** (the adapter `Container` maps top-level tokens → `Block` 1:1; a single `'\n'` is ordinary text). Real stories (Drag/Clipboard/Selection) use plain block (`'hello\n@[world](1)\nfoo'` → 3 blocks, no row markup); `'\n\n'`-splitting yields 1 row → 32 storybook failures. A corrected first-class-rows design must handle **both** plain-token rows (the base model) **and** slot-leading rich rows (`'__slot__\n\n'`, the complex case the cascade deletions targeted) — a separate future project. The attempted implementation is preserved on branch `phase7-first-class-rows-wip` (tip `5328a158`) as a starting reference. The text below is the original (flawed) design, kept for that project's input.

**Pre-split over line-anchored patterns.** In block mode the document pre-splits on the **row terminator**; each segment parses independently as inline content; the tree's top level becomes Row nodes. Parsing is row-local by construction: a keystroke inside row k reparses only row k (segment string unchanged ⇒ parse result reused wholesale, id carried). This kills the full-parse cliff outright — better incrementality than `incrementalParse` ever delivered, with zero guard machinery.

**Terminator:** derived from the configured slot-leading markup's suffix (`'__slot__\n\n'` → `'\n\n'`); defaults to `'\n\n'` when block mode has no slot-leading option. One terminator per document, validated at parser construction (today's true rows are exactly the prefix-free single-segment shape — `descriptor.hasSlot && segments.length === 1` — so this constrains nothing real). **The public config shape does not change:** `{markup: '__slot__\n\n', Mark: RowMark}` + `layout="block"`.

**Row node:**

```ts
RowToken {
	type: 'row'
	id: Id
	children: Token[]        // inline tokens of the row content
	content / position       // includes the terminator
	terminated: boolean      // false only for a trailing unterminated segment (today's text row)
}
```

- Every top-level segment becomes a Row — **including empty ones** (Enter creates them). The empty-slot collapse becomes unrepresentable: an empty Row has zero children, pairs 1:1 across reconcile, and typing into it stays on the text path by construction.
- A trailing empty segment after a final terminator is not a row (matches today's `filterEmptyText` outcome).
- Round-trip is pinned as a property: `split → parse → serialize ≡ value`, plus row-locality (editing inside row k leaves all other rows' parse results reference-equal).
- `value.current()` is byte-identical to today.

**Contracts:** `tokens()` returns `RowToken[]` in block mode — a breaking tree-shape change. The semver-major release is cut only after Phase 7 lands, so Phases 4–7 ship as one major (if Phase 7 is detached, the major is cut after Phase 6 and the Row tree shape becomes the next major). *(Phase 7 detached — the major is cut after Phase 6; the Row tree shape is deferred to the future corrected first-class-rows project. `tokens()` returns `Token[]` in both modes as before.)* Adapters: `Container` maps rows → `Block`; `Token` renders `row.children`; the option's `Mark` component still renders for marked rows. Bind: the row element binds to the RowToken directly — rows map, `rowElement` plumbing, and the one-non-control-child rule become the ordinary frame structure. Block ops and keyboard route on `token.type === 'row'`; `canMergeRows`/`addDragRow` become uniform segment operations.

## Migration (8 phases; each lands green)

Acceptance invariants throughout: storybook `renderCount.*` (plus the new empty-row gate), `tokenIdentity.property` (extended with path-correctness properties), `MarkController.spec` continuity, `bind.spec`, caret specs — unchanged; `commit.spec` and facade parity tables rewritten deliberately, never silently. Cheap exits at every boundary: Phase 0 alone is a bug fix; 1–3 break no API; 4 is the semver-major core; 7 is detachable.

*Resolved during implementation (Phase 2, 2026-06-13):* one `MarkController.spec` continuity case was amended, not merely kept. Reconcile-side routing makes a refused-descend / value-replaced mark set `structural` at reconcile time, so it now waits for the adapter `rendered()` handshake instead of the old synchronous self-heal (which was a refused-descend-mark *special case* in `commitText`). The load-bearing contract — identity continuity (the mark inherits its id across the edit) — is unchanged; only the *timing* of handle resolution moved, into alignment with the pending-window read matrix (handle lookups fail closed mid-window). The `same-slot replacement` test now paints the new tree and calls `rendered()` (matching its sibling `still fails closed once the mark is structurally removed`); restoring synchronous self-heal would have re-grown a soft-vs-hard structural routing distinction in commit — exactly what this phase deletes. Same precedent class as the consolidation spec's "Resolved during implementation" amendments.

- **Phase 0 — bug fixes, standalone:** TreeBuilder empty-slot fix (see Graft B amendment) + NEW render-count gates, react and vue (*first keystroke into a freshly-Enter-created row stays on the text branch*); `mergeDragRows` empty-row pin; dev-mode `rendered()`-timeout warning.
- **Phase 1 — identity unification (2–3 days):** stamp `token.id` at reconcile (WeakMap kept as an internal shim one phase); `keyOf()` on the adapter SPI; both Containers off KeyGenerator; BlockController stores re-keyed by id. Remount fix verified in storybook.
- **Phase 2 — reconcile-side routing (2–3 days):** reconcile emits `{structural, changes: [{id, token, path}], removedIds}` (paths threaded through `tryDescend`; property spec extended); delete `collectChanged` + the runtime escalation type-walk; public `changed` → `Event<void>`; commit-time fold guard kept. Render gates untouched.
- **Phase 3 — one fresh truth (2–3 days):** expose `tokens()`/`at()`; migrate the 6 `freshTokens` sites + ~7 core `tree()` reads; delete `freshTokens`; `renderTree` moves to `markput/adapter`.
- **Phase 4 — kill TokenAddress (3–4 days, semver-major):** `handle(id)` + `handleAt(node)` only; `placeCaret` handle form; MarkController re-backed by a handle, live-read parity tables; TokenAddress deleted from editorContracts; `useMarkInfo` ships `path()`/id (its end-user staleness warning dies).
- **Phase 5 — de-reactify + surface deletion (1–2 days):** plain handle getters; dead members + isolation specs deleted; `selection()` snapshot replaces the six micro-reads.
- **Phase 6 — pipeline + parse trim (2 days):** the `(value, parser, isBlock)` watch replaces the PURITY computed; explicit hint flow; delete `incrementalParse` + its property spec (EditHint + bench survive as the regression tripwire).
- **Phase 7 — first-class rows (~1–2 weeks): DETACHED (2026-06-13).** Attempted and reverted — the `'\n\n'`-split row model proved mismatched with the general block model (top-level-token-per-block); see the §First-class rows note. The trim (Phases 0–6) ships as the semver-major; corrected first-class rows is a future project (WIP preserved on `phase7-first-class-rows-wip`).

**Riders:** rewrite the rotten `parser/README.md` (Phase 7); delete dead `preparsing/getClosestIndexes` (Phase 6); fix `Parser.unescape` lossiness for user-typed backslashes (Phase 7); shrink the tokens README to the new model (rolling).

**Reversal triggers** (from the research counter-position): a felt inline-typing regression after Phase 6 → resurrect `incrementalParse` behind its property spec; a real consumer for per-node mark reactivity → re-add dirty signals behind the getters; third-party TokenAddress dependence surfacing in Phase 4 → a deprecated `{path, id}` shim for one major version.

## Non-goals

- No alien-signals npm migration (separate chore; the core's reduced footprint is this spec's contribution).
- No IME/composition behavior changes or pins.
- No `Change`/mapPos public delta; no per-type mutation listeners (the internal changeset is the documented seam).
- No Keyed Snapshot (core-owned DOM) — rejected as the next step (migration cost 3/10); preserved as the long-term direction only if framework-owned token DOM is ever abandoned.
- No new renderer/framework support.

## Execution note

Implementation is phase-sequential (each phase lands green before the next), agent-driven for the spine, with **workflows used where they buy wall-clock speed** (user-opted): parallel review/verify fan-outs per task and independent file migrations within a phase (e.g. the Phase 3 call-site sweep, the Phase 7 consumer migrations). Per-task discipline unchanged: implement → dual review (spec + quality) → judge → fix → re-verify.