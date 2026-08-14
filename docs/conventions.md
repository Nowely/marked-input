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

Moved to `docs/adr/0004-established-contracts.md`. A follow-on spec reads this
file for structure and that one for the contracts it must hold to.
