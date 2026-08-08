# Tree Core Spec v1 — Multi-Lens Review (2026-08-08)

15-agent workflow: 5 review lenses (api-dx, maintainability, architecture,
simplification, prior-art) + adversarial verification of each major finding.
Reviewed artifact: `docs/superpowers/plans/2026-08-08-markput-s1-tree-core-v1.md`.
Review priority (user-stated, overriding the spec's own goals): best public
API, best DX, clear code, maintainability; raw performance demoted; breaking
changes accepted.

**Scores against that priority:** api-dx 5, maintainability 5, architecture 5,
simplification 4, prior-art 5 (of 10). Shared verdict: substrate direction
right (tree-as-truth, persistent identity, node anchors, transactions);
execution misallocated.

## Confirmed findings (survived adversarial refutation)

1. **[critical] G6/D8 froze the old API as the end state; no phase designed
   the public API the rewrite enables** — the user's #1 goal got zero design
   work; transactions/anchors/identity stayed internal; `replace(range,
   string)` remained the sole public write verb (PM-position pain preserved
   in public form). Also: `useMarkput(store=>…)` exposes the whole Store
   graph and was unmentioned; public snapshots kept `id?` optionality (throw
   paths in `keyOf`/`fromToken`) and stored absolute positions — warts the
   tree fixes by construction.
2. **[critical] The windowed re-tokenizer (D4/S1.3) served the demoted goal
   and couldn't meet its own O(window) claim** — the inert-outside guard
   scanned the whole projection per edit (O(document)); coverage collapsed on
   ordinary segment chars in prose (`)`, `]`); full parse is 1.4–4.4 µs on
   realistic content and is what ships today. Confirmed independently by
   three lenses.
3. **[critical] Complexity ledger** — v1 added ~2350 lines across seven
   subsystems, deleted ~300, and ended with three identity mechanisms
   (persistent nodes, window-splice adoption, boundary reconcile) where today
   has one.
4. **[critical] Missing transaction → view-pipeline contract** — the commit
   pipeline's input type is `ReconcileResult` (output of the deleted layer);
   post-S1.4 token content had three owners (TreeNode signals,
   TokenHandle.#token, pipeline `latest`), violating the one-owner rule.

## Refuted findings (adversarial pass caught over-claims)

- *"Reuse `tokenIdentity.reconcile` as the adoption mechanism"* — category
  error: reconcile presupposes a full parse, encodes a different pairing
  policy (heuristic id inheritance), and its 1161-line spec suite pins an
  output contract (`ReconcileResult` kinds/paths) that retargeting would
  destroy. Correct form: a **new small deterministic adoption function**, not
  reuse.
- *"Block whole-value replaces make D5+G1+G3 unsatisfiable"* — the reviewed
  revision's S1.7 already routed whole-value replaces through the boundary
  continuity pass.

## Cross-lens gaps (unverified but convergent — 3–5 lenses each)

- D6 controlled echo protocol underspecified: single pending slot; second
  keystroke before echo; computing `expected` without committing; re-entrant
  `onChange`; anchor fate across external resets.
- No composition/IME policy in a spec that rewires the input path
  (`insertCompositionText` is non-cancelable; the canonical contentEditable
  tarpit).
- Identity contract on the full-parse fallback path unspecified (G3
  falsified by its own fallback).
- Inverse-op recording speculative — with the counterpoint that native undo
  is already dead (input path preventDefaults), so undo is real near-term
  work, just not inert groundwork.
- Phase ordering: S1.8 (selection) after S1.7 (cutover) forced a throwaway
  numeric-caret bridge; S1.6's gate was vacuous before S1.7 wiring.

## Outcome

v2 (`2026-08-08-markput-s1-tree-core-v2.md`): API-first (§2.3 target public
API; old surface → compat with sunset), window ladder cut (edit path =
synchronous full parse + deterministic op-anchored adoption; one identity
mechanism, `tokenIdentity` deleted at cutover), `TransactionResult` view
contract with single ownership, stateless controlled protocol with a
specified interleaving matrix, composition policy, selection with cutover,
7 phases with an adds/deletes ledger gate.

## Second round: v2 verification (same day, 6 agents)

Six adversarial checkers (api-first, adoption, view-contract, boundary-ime,
phases-ledger, coherence) all returned "architecture right, document not
implementable without guessing". Highlights, all fixed in v2.1:

- **Proven counterexample** in the adoption walks: prefix/suffix retention by
  equality alone (without the `position.end <= window.start` /
  `position.start >= window.end` bounds reconcile carries) kills nodes
  outside the window on repeated-content deletions (`x@[a]x@[a]x` minus the
  second mark) — violating the spec's own AC-3.1.
- The "transaction ≡ full parse is tautological" claim was false: adoption's
  in-place writes are the non-tautological part; the output-equivalence
  property (`snapshot ≡ parsed`) was restored as the primary gate.
- Write-verb vocabulary could not express cross-node/whole-value edits
  (overtype across a mark, cut, select-all, block ops) → `applyRange` became
  the base primitive; public `replaceRange`/`setValue` added.
- `NodeAnchor` and the API host object were undefined; public nodes leaked
  writable signals → readonly views (D11), `MarkputApi`, export-disposition
  table.
- D9 `structural` bit mis-routed mark value updates under the compat
  renderer (→ `render` bit); `#token`'s DOM-generation-consistent read role
  had no replacement (→ bind-generation position cache; latch-death claim
  scoped to writes).
- Pre-adoption selection capture had no owner/ordering (in-place position
  mutation makes post-hoc derivation wrong) → `selectionBefore` +
  entry→capture→adopt→commit→repair ordering.
- D10 gated only composition-input transactions → full commit latch +
  `deferredArrival`; the G2 "no consume-once state" overclaim was scoped
  honestly (two named boundary records remain).
- S1.6 was a big-bang violating the ≤8-task/revertibility discipline → split
  into sub-changes with per-change rollback units; pre-cutover phases
  explicitly build alongside the live path; the "additions ≈ deletions"
  ledger was restated as a named-mechanism checklist (line count grows at
  cutover, shrinks after compat removal).

Maintainer decisions after v2.1 (same day): narrow adapter hooks rejected —
`useMarkput(store => …)` stays the public adapter surface; the
composition/IME latch and the readonly-view layer descoped (composition
behavior stays as today, design sketch in spec §9; nodes are one structure,
spec D11); `tokens/` directory regrouping deferred to after the rewrite
(spec §9).
