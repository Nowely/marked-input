# Project Conventions

Source of truth for spec/plan structure. Follow-on subsystem specs read this
instead of scanning prior specs.

## Naming

- Subsystem codes: S1 (Tree Core); next subsystems continue S2, S3, …
- Phase codes: `S{n}.{m}` (e.g. S1.3); staged sub-changes: `S{n}.{m}{a,b,…}`
  (e.g. S1.6a).
- Design decisions: `D{n}` — title + rationale + _Tradeoff:_ line.
- User stories: `US-{n}`; acceptance criteria: `AC-{story}.{criterion}`.
- Spec files: `docs/scratch/plans/YYYY-MM-DD-markput-s{n}-{name}-v{ver}.md`.
- Review records: `docs/scratch/reviews/YYYY-MM-DD-{topic}-review.md`.

## Document Structure

Sections 1–12 per the subsystem-design-spec skill: Overview (Goals/Non-Goals),
Architecture (diagram, decisions D{n}, target public API when relevant),
User Stories, Detailed Design, Output Contract, Error Handling, Testing,
Performance, Future, Dependencies, Implementation Phases, Acceptance.
Maintainer descope decisions are recorded in place (decision block kept,
content replaced), not silently deleted.

## Phase Design

- Ordering: types → pure core → effects/boundary → wiring shell; riskiest
  pure component gets its own early phase with a property-spec gate.
- Each phase: ≤8 tasks, explicit contracts consumed/exposed, gate command,
  human verification list, review tier (gate-only / spot-check / full-review).
- Pre-cutover phases build alongside the live path (unit-gated); cutover is
  staged sub-changes, each independently revertible.
- Dependency graph with parallelization notes is required.
- Deletions are tracked as a named-mechanism checklist, not a line balance.

## Process

- Spec → user review → Status: Reviewed → checkbox implementation plan
  (independently committable, every task green) → execution after sign-off.
- Large specs get a multi-agent review (lenses + adversarial verification of
  major findings) before user review; the record goes to
  `docs/scratch/reviews/`.

## Established Contracts

- S1 public API: spec v2 §2.3 (`MarkputApi`, `TreeNode = TextNode | MarkNode`
  one structure, `NodeAnchor`, verbs over `applyRange`, `changed` payload).
- S1 internal: `adopt(tree, window, parsed, selectionBefore?)` returns the
  `TransactionResult` — the single change feed; CommitSink splits
  uncontrolled/controlled commit policy.
- S2 addressing (Cut B): **one address space above `tree/`** — every read and
  write outside `features/tokens/tree/` names a `NodeAnchor`, never an absolute
  offset. `anchorFor` is the single DOM→model projection; `anchorAt` / `offsetOf`
  are the tree layer's own coordinate boundary and the only place a number is
  formed. `adopt` carries the selection as anchors (`selectionAfter`), resolved
  from pre-mutation offsets inside adoption. The checkable form is a grep with a
  fixed allowlist — `tree/`, `parser/`, `block/` and `keyboard/blockEdit.ts` (the
  whole-value rewriter) may read `.position`; adding to that list is a contract
  change, not a convenience.
- S2 commit wave: `TokenModel`'s `onResult` runs `pipeline.apply` → publish the
  value → `selection.repair` inside **one `batch`**. `changed` is an event, so
  without the batch it flushes its subscribers mid-`apply` and every consumer
  sees the new tree against the previous generation's selection.
- S2 representation (Cut A): **one representation** — the token tree. Both
  adapters render `TreeNode` off `tokens.nodes()`; `Token` survives only as the
  parser's output and the §7.1 test oracle. `renderEpoch` is a counter carrying
  "the renderer must run", not data.
- S2 ownership: `TokenModel` owns the value, the DOM binding AND the selection
  (`tokens.selection` plus a private `SelectionDriver`). There is no
  `store.selection` and no construction cycle between `Store`'s fields.
- Public-API invariant: **`MarkputApi` neither takes nor returns an absolute
  document offset.** Stated of `MarkputApi`, not of every export — `Store` is a
  value export, so `store.edit.setValue(text, caretOffset?)` and
  `store.tokens.anchorAt` / `offsetOf` remain reachable through it by design.
- Error handling: boolean/`undefined` + throw for developer errors; no
  Result/Either types.
