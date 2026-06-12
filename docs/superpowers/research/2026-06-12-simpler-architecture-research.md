# Simpler Token-Core Architecture — Research Report

**Date:** 2026-06-12
**Scope:** `packages/core/src/features/tokens/` (+ adapters, consumer features)
**Status of current code:** WORKS — 724 core + 218 react + 200 vue tests green, all four wins delivered and gate-pinned.
**Mission:** find the simplest architecture that keeps wins 1–4 (or consciously trades one away with explicit justification), with an easy API and few concepts.

This report synthesizes three independent censuses (core, consumers, parser), four prior-art studies (CodeMirror 6, ProseMirror, Lexical, Slate + signal libraries), four candidate architectures, and an adversarial attack pass against each candidate using the ten pinned hard cases.

---

## 1. Goals tracked

### The four wins (must keep, or trade with explicit justification)

| # | Win | How it is pinned today |
|---|-----|------------------------|
| 1 | **Hard DOM encapsulation** — raw Range/Selection/TreeWalker only inside `features/tokens` | `check:encapsulation` guard; boundary facade |
| 2 | **Stable token identity across edits** — WeakMap ids survive reparse | `tokenIdentity.property.spec`, `MarkController.spec` continuity |
| 3 | **Zero framework re-renders on typing** (inline AND block) | storybook `renderCount.*` gates, both directions (typing = 0, structural = re-render) |
| 4 | **Fine-grained per-node reactivity** | per-node dirty signals, isolation specs |

### Simplicity and API ease as first-class goals (the user's acceptance criteria)

The user judges the current design overcomplicated. The validated complaints, each treated as an acceptance criterion for any winner:

1. **The staleness contract is the most expensive concept**: `tree()` stale-by-design vs `handle.token()` fresh; `utils/freshTokens.ts` existing at all is the tell.
2. **Concept census too high**: pendingStructural latch, per-node dirty signals, changeset buckets, deep-descend conditions, escalation/self-heal, divergence detector, four lookups, the `rendered()`-then-bind handshake.
3. **`TokenAddress = {path, token}` embeds a live object reference** — root cause of identity/staleness gymnastics.
4. **Block rows encoded as slot marks** (`'__slot__\n\n'`) — special cases everywhere.
5. **Reconcile is O(tree)-time per keystroke.**
6. **Custom vendored signals library** — hand-verification tax on every subtle reactive feature.

A winner must measurably reduce 1–4 and 6, and either fix or consciously accept 5. The acceptance bar: a feature author's mental model fits in two sentences ("handles are fresh; the render tree is for renderers"), and the README shrinks from 422 lines toward ≤150.

### The ten hard cases (any design must satisfy; each is a pinned test or a real past bug)

Caret stability under conditional text writes (1); the reconcile-to-render window failing closed (2); identity continuity through shifted/value-edited marks (3); the render bypass in both directions, inline and block (4); block in-slot typing on the fast path (5); non-local parsing fallback (6); framework-owned mark components / vdom staleness (7); model–DOM divergence detection (8); React 18 + Vue 3 integration (9); IME/composition (10).

---

## 2. What the census found

### 2.1 Concept inventory (core census)

~2,300 production lines in the model layer, plus a 798-line vendored signals runtime and a 422-line README needed to explain it. A newcomer must internalize ~20 distinct concepts to modify it safely. Verdicts:

**Essential (the sound core — do not touch):**
- LiveNode dual-role record (the handle IS the node record; identity-keyed liveness drives wins 2–4)
- Identity diffing in spirit (prefix reuse / suffix id-carry / middle pairing — pinned by property specs)
- Two-branch commit (text patch vs structural publish+bind — the render bypass IS win 3)
- `rendered()`-then-bind handshake (irreducible while frameworks own token DOM; Tiptap/Remirror independently re-grew the same thing on ProseMirror)
- Structural bind walk (all-or-nothing frames, unbind-vs-kill)
- Boundary facade (win 1's wall)
- Divergence detector (~12 lines, cheapest safety per line)

**Mergeable (consequences of three root decisions, not independent mechanisms):**
- The staleness contract — an *exposure* problem, not a mechanism problem: `commit.ts` already keeps `latest` (a fully fresh tree, no exception cases) as a private variable while consumers get stale `tree()` + `freshTokens()`
- The four lookups (`handleOf`/`handleFor`/`handleAt`/`tokenAt`) — exist because `TokenAddress` carries both a path AND a live object
- pendingStructural latch + asymmetric gating — one generation-gap rule wearing three concepts
- Escalation-as-routing — reconcile KNOWS an entry is a refused-descend mark when it pushes it; commit re-discovers it via an O(tree) DFS plus a runtime type check
- Edit-hint side channel (consume-once `takePendingEdit()` drained *inside a computed*, purity by runtime convention — the PURITY comment)
- WeakMap-side-table ids (`idOf`/`idFor` split, foreign-token-allocation hazard) — the id could live ON the token

**Deletable (zero production consumers, by grep):**
- **Win 4's machinery has ZERO production reactive consumers.** No feature, adapter, or storybook code watches `handle.dirty`, `handle.changed`, or any handle getter reactively. The only reactive subscriber to the whole token layer is SelectionController watching the model-level `changed` event — and it ignores the payload. What ships is fine-grained DOM *patching*, not fine-grained *reactivity*.
- Changeset buckets `{textChanged, added, removed, updated}` — the README itself concedes no production consumer reads them
- `incrementalParse` (~230 lines + 3 sub-concepts) — buys ~1.5–1.65x only on 500-mark *inline* docs; its own property spec proves deletion is behavior-preserving; block mode trips the inert guard anyway
- Dead public surface: `tokenAt`, `handles()`, `caretFromPoint`, `handle.changed/.dead/.text/.caretRect/.placeCaretAtBoundary` — roughly a third of the documented API is unconsumed

**Three root decisions cause most of the concept count:**
(a) `tree()` doubling as renderer contract AND consumer data source → staleness contract, freshTokens, handleOf, the latch, the latest-vs-tree() split;
(b) `TokenAddress` embedding a live token object → object-identity resolution, the four-lookup family, triple-duplicated double-check idioms;
(c) rows as `'__slot__\n\n'` marks → filterEmptyText, dual-tree retention, the rows map, the deep-descend machinery (its stated primary motivation), defeated incremental parsing in block mode.

### 2.2 Consumer census — the public surface is ~2x what consumers use

The most damning numbers:
- **`freshTokens()` has 6 production call sites — more than `tree()` has legitimate fresh-data reads in core.** The escape hatch is used more than the front door. 18 staleness-explaining comments across consumers; ~7 "path is index by construction" convention comments.
- The validity idiom `handleFor(address)` + `handleOf(address.token) !== handle` is hand-duplicated **three times** (SelectionController ×2, inside `TokenModel.placeCaret` itself). When the API's own author needs a two-lookup cross-verification to use an address safely, the address type is the bug.
- **Three parallel identity systems**: tokenIdentity WeakMap (handles), `Store.key` KeyGenerator WeakMap (framework keys), BlockController `#stores` WeakMap (per-row UI state). Concrete latent defects: a suffix-shifted token keeps its identity id but gets a NEW KeyGenerator key → spurious framework remount; per-row drag/hover state silently resets when a row object is replaced.
- The adapters are remarkably thin: the entire adapter contract is ~5 members (`tree`, `key.get`, `host.container`, `host.rendered`, control/children refs). Everything else on TokenModel exists for core features.

**The grounded dream API** (every production call site maps): one always-fresh handle-based read surface (`tokens()`/`at(index)`/`find(node|position|path)`), `tree()` demoted to adapter-only `renderTree` with `keyOf()`, TokenAddress replaced by the handle itself, the six selection micro-reads merged into one `selection()` snapshot, `changed: Event<void>`.

One complaint *challenged by evidence*: the `rendered()`-then-bind handshake is NOT painful at the call site (one layout effect / two Vue lifecycle lines). Its pain is indirect — the pending window it creates — and it is irreducible while frameworks render token components.

### 2.3 Parser census — rows-as-marks confirmed as the chief complexity multiplier

- The slot-leading row hack (`resolveSlotLeadingMatches` + the Match constructor special case) carries the codebase's only two "TODO need review it" comments — and it makes parsing **non-local** (a row mark's start depends on a sibling match arbitrarily far away), which is precisely what the inert-outside guard and doubling stabilization exist to defend against.
- **Verified full-parse cliff:** one innocent `'- '` in prose anywhere in the document defeats the inert-outside guard and forces a FULL document parse on EVERY keystroke everywhere (probed: 947-char window on a 946-char doc). Realistic block documents are O(document) parse-time per keystroke *despite* the fast path existing. (The `parser.bench.ts:291` caveat claiming the fast path never applies to block mode is outdated — it does engage on pristine documents.)
- **Verified unpinned bug:** TreeBuilder collapses an empty slot to `slot: undefined`, so `tryDescend` refuses, so the FIRST keystroke into an empty row (exactly what Enter creates) escalates to a full framework re-render. The block render-count gate types only into a non-empty row — this hole is unpinned.
- ~10 enumerable special cases exist *because* rows are marks (filterEmptyText + dual `#lastParsed` tree, the rows map and one-non-control-child rule in bind, rowElement/`#measureScope` plumbing, descriptor-shape sniffing duplicated in two sites, mark-vs-text routing in five keyboard/block functions, the parallel blockEdit keyboard path, empty inter-row filler tokens).
- `TokenAddress={path,token}` is consumed at exactly 4 identity-check sites; `{path, id}` carries the same information and preserves every fail-closed check. Pure positional addresses would break pinned identity-continuity contracts and were correctly rejected.
- First-class rows would cascade-delete the slot-leading pass, the empty-slot quirk, filterEmptyText + dual tree, descend-for-rows, the descriptor sniffing — and make block reparse **row-local by construction**, a better incrementality than the inert guard ever delivered.
- Side findings: `parser/README.md` is rotten (documents a priority system that doesn't exist); `preparsing/getClosestIndexes` is dead code; `Parser.unescape` is lossy for user-typed backslashes.

---

## 3. Prior-art lessons

**CodeMirror 6.** Positions are plain numbers; identity is *mapping dumb data through changes* (`ChangeDesc.mapPos`, `RangeSet.map`), never live-object tracking. The edit is a first-class value threaded through one pipeline; the typing no-op falls out of diffing, not a special branch. Nothing observable is ever fresher or staler than "the current EditorState" — old generations are explicit values the caller holds. Counter-lesson: CM6's own concept census is huge and survives because everything hangs on ONE data-flow spine; marked-input's pain (latch + escalation + detector) comes from having two flow directions whose consistency must be re-proven. **Steal:** edit-as-value, dumb-data addresses, one-spine framing. **Don't steal:** facets/viewport machinery; CM6 happily accepts O(fields)+O(viewport) per transaction — O(tree) reconcile is not the real smell at this document size.

**ProseMirror.** Deliberately NO node identity — nodes are values; durable things are integer positions mapped through `StepMap`s, and app-level identity is a plain attribute managed by a plugin. The whole custom-renderer protocol is one boolean (`NodeView.update() → bool`). Divergence is *input*, not error: MutationObserver read-back parses unexpected DOM into an ordinary transaction. PM avoids the rendered() handshake only by owning the DOM; Tiptap/Remirror bolt it back on — **evidence the handshake is the irreducible price of framework-owned token components, not incidental complexity.** **Steal:** one-freshness atomic generations, addresses as plain data, the one-boolean re-render mental model. **Don't steal:** dropping stable identity (MarkController continuity genuinely needs ids — keep them, as data).

**Lexical.** The identity inversion: EditorState IS a `Map<NodeKey, node>` — the key maps TO the node (marked-input's WeakMap points the wrong way). One staleness rule (`getLatest()` by key) instead of a staleness contract; the key is the only address; paths are derived. The core ships ZERO signals — explicit listeners plus one commit point per update suffice for an editor; framework reactivity is bridged at the adapter edge. Patch-vs-recreate is a node-local boolean, not pipeline escalation. Update tags > latches. **Steal:** id-as-the-address, current/pending two-generation vocabulary, no-signals-on-the-document doctrine. **Don't steal:** copy-on-write EditorStates (marked-input's truth is a controlled string; reparse-then-reconcile is the honest architecture) or the `$`-function closure convention.

**Slate (+ signal libraries).** Slate independently invented marked-input's WeakMap-key idea for rendering (validating that half) and spent a decade on path-as-address footguns ("Cannot find a descendant at path"; PathRef as escape hatch) — validating the other half of the complaint: `TokenAddress` fuses Slate's two location systems and inherits BOTH failure modes. slate-react has the exact same render-then-bind WeakMap handshake — kept adapter-internal, never surfaced as API. No mainstream editor uses signals for the document layer; consumers need deltas and an atomic commit point, which signals don't give. The vendored signals runtime is already a wrapper around a vendored copy of alien-signals' core — the hand-verification tax is on the *wrapper*, and the cheapest cut is depending on the alien-signals npm package (it powers Vue 3.6). **Steal:** two-generation naming, alien-signals as a dependency, rendered() as adapter SPI not public API. **Don't steal:** forward operations wholesale (controlled-value mode means backward-diffing reconcile can't be eliminated).

**Unanimous verdicts across all four systems:** (1) addresses must be dumb data (ids/numbers), never live object references; (2) exactly one freshness rule, with old generations as explicit values; (3) block structure is a first-class node kind, never a sentinel markup string; (4) no signals on document nodes — deltas + one commit point.

---

## 4. The candidates

All four scored identically on simplicity (7) and keepsWins (8); they differ on API ease and migration cost. None had a fatal hole; all were "sound-with-fixes."

### 4.1 Handle-First Core — one fresh truth, one render snapshot, one pending rule

**Pitch:** Live handles (always fresh, id-addressed) are the only consumer view; `tree()` demoted to adapter-private `renderTree`; id stamped on tokens at reconcile doubles as the framework key; routing decided at reconcile time; win 4 downgraded to fine-grained DOM patching; optional phase-7 first-class rows. Concept count ~20 → ~12.

**API flavor:** `tokens() / at(index) / find(node|position|path)`, `changed: Event<void>`, `edit(value, hint?)`, one `selection()` snapshot; handle = `{id, token(), path(), alive(), element(), caret/measure commands}`; adapter SPI = `renderTree / keyOf / rendered() / controlRef / childrenRef`.

**Attack verdict: sound-with-fixes.** Major holes:
- *"No second tree" is false* — the text branch never touches `renderTree`, so binding an unrelated re-render against the published tree would regress the DOM to pre-edit text and kill the caret. The private `latest` array must come back (exactly the `bind-projects-latest-not-tree()` subtlety the pitch claimed to delete).
- *Routing cannot be fully decided at reconcile time* — an edit landing in the pending window must fold structurally, which only commit can know (`pendingStructural` check). One guard restores commit-time routing.
- *"Reads serve last-bound state" regresses a real property* — today, mid-window position reads serve the LATEST tree (freshTokens fallback, boundary facade), keeping positions consistent with `value.current()`. Serving last-bound positions against the new value yields corrupt block edits, not fail-closed ones.
- *Signals-deletion oversold* — 13 non-token core files + both adapters' `useMarkput` bridges use the runtime; only the token core de-reactifies.
- Minors: `find(path)` drops the fail-closed identity check; `MarkController.fromToken` drops the unbound fallback; the interim empty-row fix is unimplementable as stated (the empty row has no text surface in the DOM to patch); `edit()` misses non-edit reparse triggers (options/Mark/layout prop changes).

**Score:** simplicity 7, keepsWins 8, apiEase 8, migrationCost 6.

### 4.2 Coordinate Core — ids and mapped positions, zero live references

**Pitch:** The full CM6/PM doctrine: consumer API traffics ONLY in dumb data — stable integer `Id`s and numeric `Span`s, bridged by a first-class `Change` value with `mapPos`. No consumer-facing call returns a token object at all. Staleness becomes unrepresentable in the API.

**API flavor:** `ids()/at()/find()/span(id)/text(id)/kind(id)/mark(id)/pathOf(id)`, commands fail-closed while pending, `changed: EventSource<Change>`, `MarkRef` by id.

**Attack verdict: sound-with-fixes.** Major holes:
- *Structural consumers can't be served by scalar queries* — verified: clipboard `serializeRange` recurses `token.children`; block `operations.ts` compares `descriptor === descriptor` and reads `slot.end`; `isTextLikeRow` needs descriptor shape. The scalar surface (`text/span/kind/mark`) exposes none of this; a `doc()` snapshot must be added, contradicting the "no token objects" pitch.
- *Index update timing unspecified and self-contradictory* — "span(id) is fresh" vs "queries answer from last consistent state" conflict exactly in the pending window; either choice breaks one of the design's own sentences and `undefined` gains a silent second meaning (pending-unbound vs dead).
- *The fold rule was deleted from the concept list but is still load-bearing* (same hole as Handle-First).
- *Migration oversold* — "replace signals with a plain emitter" is unavailable (17 core files outside tokens import the runtime); Phase 4 is the entire consolidation in reverse, not 2–3 days.
- Minors: `MarkRef` is lossy vs the pinned MarkPatch contract (drops `meta`, can't express slot `clear`); the conditional-text-write rule (caret stability) lost its load-bearing word; uncounted public vocabulary (pathOf, the `'control'` string sentinel, two side-bias vocabularies) pushes the honest count from 7 toward 10.

**Score:** 7 / 8 / 6 / 5. The chattier query API and the snapshot-type backtrack make it strictly worse ergonomics than Handle-First/One-Fresh-Truth for the same conceptual payoff.

### 4.3 Keyed Snapshot — core-owned document DOM with mark portals (Lexical lens)

**Pitch:** Invert who renders. The core builds and owns ALL document DOM via a small keyed DOM reconciler; frameworks render only mark chrome into core-owned hosts via portals. The entire async generation gap disappears by construction: no rendered() handshake, no bind walk, no latch, no staleness contract, no escalation. Typing is the keyed diff producing one no-op `nodeValue` write.

**Attack verdict: sound-with-fixes, but the fixes are expensive.** Major holes:
- *Block chrome breaks*: DragHandle/DropIndicator/BlockMenu are framework-rendered ordered siblings inside framework-owned row wrappers; text-like rows have no MarkEntry at all. A second per-ROW portal registry — a whole hidden concept — is required.
- *Children-slot adoption kills the caret* on every structural row/slot-mark creation (changed fires → caret placed → portal paints → adoption MOVES the childHost → selection destroyed, and nothing re-places it). Cross-feature restore machinery — the latch's ghost — must be specified and pinned.
- *"Read-back input doctrine" is really a hybrid*: today's input is 100% intercept-and-prevent; mark-swallowing deletes, paste capture, and block Enter must stay interceptors. Two input modes + a routing rule replace today's one mode. ProseMirror's domchange.ts is ~600 lines for a reason.
- *IME becomes load-bearing*: the repo currently has ZERO composition handling; read-back makes uncontrolled browser mutation the NORMAL path — a composing-state machine interacting with domSync, edit(), and adoption.
- *Custom Span components die* — a documented public prop with pinned parity tables (~10 cases each adapter); `spanProps()` covers the pinned assertions but not componentized text tokens. Public API break requiring a product decision.
- *Migration self-contradiction*: "develop behind a flag" vs its own admission that coexistence isn't cheap; realistic estimate 8–12 weeks, not 5–7.

**Score:** 7 / 8 / 7 / **3**. Its Phase 1 (key stamping, lookup collapse, selection() merge) is genuinely cheap and valuable regardless — and is essentially the same move the other candidates make.

### 4.4 One Fresh Truth — the Pragmatic Trim

**Pitch:** Keep the load-bearing spine exactly as is — identity-diffed reparse, two-branch commit, zip-bind — and delete everything the census proved is exposure, duplication, or speculation. The single move that pays for most of the trim: the fully fresh tree commit.ts already maintains privately as `latest` becomes the public read (`tokens()`/`at()`/handles); `tree()` demoted to adapter-private `renderTree`. With staleness out of the public API, TokenAddress loses its only job; addresses become the handle; four lookups collapse to two (`handle(id|path)`, `handleAt(node)`); the latch shrinks to one rule. Win 4 consciously downgraded to fine-grained DOM patching. Rows-as-marks and deep descend deliberately NOT touched — just stopped from leaking into the API — plus a fix for the verified empty-row bug.

**Honest concept list (16, each one sentence):** token tree; stable id; plain TokenHandle; tokens()-vs-renderTree one-rule split; reconcile diff; deep descend (internal); two-branch commit; pending-bind window (one rule); rendered() handshake; bind walk; defensive self-heal; divergence detector; explicit EditHint; rows-as-slot-marks (the conscious leftover); boundary facade; control/children registries.

**Attack verdict: sound-with-fixes — the cleanest of the four.** Notably, *every claimed call-site line number in its migration sketch verified exact against the repo.* Majors:
- *Pending-window read semantics underspecified* (same class as Handle-First but narrower): "handle reads serve last-bound generation" mixes generations when an ADDED token's handle is created at reconcile; `tokens()[i] → handle(path)` mid-window can resolve the wrong token where today `handleOf` fails closed. Fix: keep today's fail-closed gating on `handle(ref)` mid-window (a spec decision + ~10 lines). The pinned mutation contract is preserved either way.
- *The reparse trigger is multi-source*: `#reconciled` depends on value AND `#parser` (props.Mark/options) AND `layout.isBlock`; the "plain watch callback" must cover all three or runtime option changes stop reparsing.
- Minors: commit to the **tryDescend-side** empty-slot synthesis (not a TreeBuilder token-shape change, whose blast radius hits Parser specs and consumers); self-heal must keep the `renderTree` publish (one line) or the framework vdom retains stale text; MarkController getters change from snapshot to live reads — must be encoded deliberately in the parity tables (and decide `readOnly`); `keyOf` needs a dev-mode assert for never-reconciled tokens; threading `{id, token, path}` through tryDescend recursion needs path-correctness properties added to the property spec.

**Score:** 7 / 8 / 8 / 6 — tied-best API ease, tied-best migration cost, fewest and cheapest holes.

---

## 5. Ranked recommendation

### Ranking

1. **One Fresh Truth (Pragmatic Trim)** — winner, with grafts below. Best holes-to-payoff ratio: every major hole has a ≤10-line, spec-decision-shaped fix *inside the design's own logic*; the migration was the only one whose evidence verified exactly.
2. **Handle-First Core** — same destination, but its pitch makes three claims the attack falsified (no second tree, routing fully at reconcile, signals-runtime deletion), each of which One Fresh Truth states honestly from the start. Treat it as the same design told less truthfully; its `find()` merge and phase-7 rows plan are grafted.
3. **Coordinate Core** — right doctrine, wrong ergonomics for this codebase: the scalar API demonstrably cannot serve six verified structural consumers without re-adding the snapshot it forbids, and the migration estimate collapsed under attack. Its `Change`/mapPos idea is grafted as a *future, additive* payload option.
4. **Keyed Snapshot** — the most conceptually pure endpoint (the only one that truly deletes the latch) but migrationCost 3: two uncounted registries, caret-destroying adoption, a hybrid input doctrine, load-bearing IME, and the death of custom Span components. Rejected as the *next step*; preserved as the long-term direction if framework-owned token DOM is ever abandoned.

### The winner: One Fresh Truth, with four grafts

**Graft A (from Coordinate/Keyed-Snapshot Phase 1): id as a plain field on the token**, stamped by reconcile, replacing the WeakMap side table. Deletes the `idOf`/`idFor` split and the foreign-token-allocation hazard outright instead of keeping them internal; `keyOf(token) = token.id` becomes trivial and assert-free for reconciled trees. (One Fresh Truth kept the WeakMap; the attack on the other candidates verified the field-stamping is safe — the parser does not freeze tokens.)

**Graft B (attack fixes, adopted as design decisions):**
- `handle(ref)` stays **fail-closed during the pending-bind window** (today's `handleOf` semantics) — reads that could mix generations return `undefined`; position reads via the boundary facade keep serving the latest reconciled tree (today's behavior, preserving mid-window consistency with `value.current()`).
- The edit-fold rule is named in the concept list: *while a bind is pending, every apply folds into the structural pass.* It was always there; it stays there, admitted.
- The reparse trigger is one watch over a `(value, parser, isBlock)` tuple — stated, not hidden.
- Self-heal keeps the renderTree publish.
- Empty-row fix lands tryDescend-side (synthesize an empty slot window when `descriptor.hasSlot && slot === undefined` on both sides), with a NEW render-count gate: *first keystroke into a freshly-Enter-created row stays on the text branch.*

**Graft C (from Handle-First): the dev-mode "rendered() never arrived" timeout warning** (~10 lines) for the adapter-forgot-the-handshake silent failure, and the consolidated `find()`-style lookup naming.

**Graft D (scoped honestly): alien-signals as an npm dependency** replacing the vendored *algorithm* (already vendored verbatim), shrinking the wrapper — a store-wide chore, NOT part of this refactor's critical path. The token core itself drops to one `renderTree` signal + one `changed` event, which removes the core's dependence on the runtime's subtlest guarantee (the once-per-wave PURITY contract).

### What dies (named concepts removed from the system or its public contract)

| Dies | Replaced by |
|---|---|
| The public staleness contract (tree()-stale vs handle-fresh) | `tokens()` always fresh; `renderTree` adapter-private |
| `utils/freshTokens.ts` + its 6 call sites + 18 staleness comments | `tokens()` |
| `TokenAddress = {path, token}` + `#resolveAddress` + the triple-duplicated validity idiom | the handle itself (`alive()` is the whole check); `useMarkInfo` ships `path()`/id |
| Four lookups → two | `handle(id \| path)` gated, `handleAt(node)` |
| Changeset buckets + "bucket honesty vs handle honesty" doctrine | `changed: Event<void>` publicly; internal `{id, token, path}[] + structural: boolean` |
| Escalation-as-routing + `collectChanged` O(tree) DFS | structural boolean set at reconcile time; commitText O(change); self-heal narrowed to defensive insurance |
| Per-node dirty signals + reactive handle getters + isolation specs | plain getters (win 4 consciously traded — see below) |
| `idOf`/`idFor` split + WeakMap side table (Graft A) | `token.id` plain field |
| KeyGenerator + BlockController `#stores` WeakMap (two of three identity systems) | `keyOf = token.id` (fixes the suffix-remount and drag-state-reset defects) |
| `incrementalParse.ts` + alternation snapping + inert guard + doubling stabilization | full parse always (property-spec-licensed); EditHint kept for reconcile windowing; bench kept to track the regression |
| Edit-hint signal side channel + the PURITY computed | explicit hint through a watch-callback pipeline entry |
| Dead surface: `tokenAt`, `handles()`, `caretFromPoint`, `handle.changed/.dead/.text/.caretRect/.placeCaretAtBoundary`, `address()` | — |
| Six selection micro-reads + the `!== false` tri-state | one `selection()` snapshot |
| Asymmetric latch gating table | one pending-bind rule: reads fail closed where generations could mix; DOM commands return false; edits fold |

### What is kept (and why)

- **Two-branch commit, bind walk, rendered() handshake, divergence detector, boundary facade, identity-diff heuristics** — the sound core; every prior-art system validates each piece.
- **The private `latest` tree** — admitted as load-bearing (the Handle-First attack proved deleting it corrupts unrelated-re-render binds).
- **Rows-as-slot-marks + deep descend** — kept *internal* for now; first-class rows is the recommended follow-up project (see open questions), not a prerequisite. This trim shrinks the surface that refactor must migrate.
- **O(tree) reconcile per keystroke** — consciously accepted (CM6 doctrine: make DOM work O(change), accept linear string/diff work at this scale). Only the avoidable half (`collectChanged`) is fixed.

### The conscious trade: win 4

Win 4 (fine-grained per-node reactivity) is downgraded to **fine-grained DOM patching** — which is what production actually ships. Justification: zero production reactive consumers exist after a full consolidation cycle; the render-count gates are satisfied by `renderTree` reference stability + direct `textContent` patching, not per-node signals; no surveyed editor puts signals on document nodes. Reversibility: handle getters stay methods, so per-node signals can be reintroduced behind them additively if a real customer for fine-grained mark components ever appears. The door is closed, not bricked up.

### Staged migration (~2.5–3 weeks, each phase lands green)

Acceptance invariants throughout: storybook `renderCount.*` (plus the new empty-row gate), `tokenIdentity.property` (extended with path-correctness properties), `MarkController.spec` continuity, `bind.spec`, caret specs — unchanged; `commit.spec` and facade parity tables rewritten deliberately.

- **Phase 0 (first PR):** add the empty-row render-count gate + the tryDescend-side empty-slot fix; add the dev-mode rendered()-timeout warning. Standalone bug fix, valuable even if everything else stalls.
- **Phase 1 — identity unification (2–3 days):** stamp `token.id` at reconcile (Graft A; keep the WeakMap as an internal shim one phase); `keyOf()` on the adapter SPI; switch both Containers off KeyGenerator; re-key BlockController stores by id. Verify the remount fix in storybook.
- **Phase 2 — reconcile-side routing (2–3 days):** reconcile emits `{tokens, structural, changes: [{id, token, path}], removedIds}` (thread paths through tryDescend recursion; extend the property spec); delete `collectChanged` + runtime escalation type-check; public `changed` → `Event<void>`; keep the commit-time fold guard. Render-count gates untouched.
- **Phase 3 — one fresh truth (2–3 days):** expose `tokens()`/`at(index)`; migrate the 6 freshTokens sites + ~7 core tree() reads; delete freshTokens; move `tree` → `renderTree` on a separate adapter import (`markput/adapter`).
- **Phase 4 — kill TokenAddress (3–4 days, the semver-major core):** `handle(id|path)` (fail-closed mid-window) + `handleAt(node)`; `placeCaret` handle form; MarkController re-backed by a handle (delete `#resolveCaptured`, `pathOf` DFS, the 11-line comment; encode live-read semantics + `readOnly` decision in parity tables); delete TokenAddress from editorContracts; useMarkInfo ships `path()` (its end-user staleness warning dies).
- **Phase 5 — de-reactify + surface deletion (1–2 days):** plain handle getters; delete dead members + isolation specs; merge the selection micro-reads into `selection()`.
- **Phase 6 — pipeline + parse trim (2 days):** the `(value, parser, isBlock)` watch replaces the PURITY computed; explicit hint flow; delete `incrementalParse` + its property spec (keep EditHint, keep the bench).
- **Phase 7 (separate project, recommended): first-class rows** — parser pre-split on the row terminator / line-anchored row patterns, Row node kind, migrate bind's block branch + block ops. Cascade-deletes `resolveSlotLeadingMatches` (+ both TODOs), filterEmptyText + dual `#lastParsed`, descend-for-rows, rowElement plumbing, the full-parse cliff. ~1–2 weeks; do it only after phases 1–6 have shrunk the surface it must touch.

### Open questions for the follow-up spec

1. **Pending-window read matrix** — for each read (`tokens()`, `at()`, `handle(id)`, `handle(path)`, `handleAt`, boundary positions, geometry), state which generation it serves mid-window and whether it can return `undefined`; distinguish "pending-unbound" from "dead" if both map to `undefined`.
2. **MarkController read semantics** — snapshot vs live for `value/meta/slot/readOnly`; what the parity tables pin; what `update()` means for a current-but-never-bound id.
3. **`handle(path)` validity** — drop the overload, or resolve through the id stamped at that path with documented "render-time paths only" semantics?
4. **Internal changeset shape** — is `{id, token, path}[] + structural` enough for a future public delta (Lexical-style per-type mutation listeners), or should the seam anticipate `Change`/mapPos (Coordinate graft) now?
5. **First-class rows design** — pre-split vs line-anchored row pattern kind; Row node contract for bind/adapters; what happens to descend for genuinely nested inline slot marks once rows stop needing it.
6. **alien-signals migration scope** — audit the once-per-wave semantics the store still relies on; which wrapper features (Event, watch, batch, scopes) survive.
7. **IME baseline** — composition handling is currently absent, not merely preserved; decide whether phase 0 should pin today's de-facto behavior before anything moves.
8. **Docs debt riding along** — rewrite the rotten `parser/README.md`; fix `Parser.unescape` lossiness; delete `preparsing/getClosestIndexes`.

---

## 6. Honest counter-position: the case for doing nothing

**The strongest argument against this entire effort:** the current code *works*. 1,142 tests green; all four wins delivered and gate-pinned; the consolidation just finished and the README, while long, is *accurate*. Every line of the proposed deletion list is tested, and the attack pass proved that even careful redesigns by capable authors shipped with major holes (every single candidate needed fixes around the pending window — the hardest invariant in the system, which the current code already gets right). Refactors of working, subtle code have a known failure mode: you re-fight bugs the old code already beat (the conditional text write, bind-projects-latest, the fold rule — all three were silently dropped by at least one candidate). The complaints are about *learnability*, and learnability can be improved with documentation and a thin facade at near-zero risk.

**What would justify doing nothing:** if the library's contributor pool is just the current author (who already paid the learning cost); if no external API consumers exist yet to benefit from the simpler surface; if the next six months of roadmap is features, not maintenance.

**Why the recommendation still stands, and what evidence backs each piece:**
- The *measured* costs are not learnability-only: freshTokens outnumbering legitimate tree() reads (6 vs ~2), a triple-duplicated validity idiom, three identity systems with two *verified latent defects* (suffix remount, drag-state reset), an *unpinned re-render bug* on every freshly created row, and a *verified full-parse cliff* on realistic block documents. Those are defects and footguns, not prose.
- The risk argument cuts both ways: the pinned suites (render-count gates, property specs, continuity specs) are precisely what makes this refactor safe — they pin *behavior, not payload shapes*, and every phase lands green against them. The attack pass is evidence the plan anticipates the failure modes rather than discovering them in production.
- The trade of win 4 is justified by a zero-consumer grep across an entire consolidation cycle, and it is reversible behind unchanged method signatures.
- Cheap exits exist at every phase boundary: Phase 0 alone fixes a real bug; Phases 1–2 fix real defects with no API break; the semver-major step (Phase 4) can be deferred indefinitely with Phases 1–3 already banked.

**Evidence that would change the recommendation mid-flight:** an inline-typing benchmark regression users can feel after Phase 6 (→ resurrect incrementalParse behind its property spec); a real customer for per-node mark reactivity (→ re-add dirty signals behind the getters); Phase 4's parity-table rewrite uncovering third-party TokenAddress dependence (→ keep a deprecated `{path, id}` shim for one major version).
