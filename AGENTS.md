# AGENTS.md

## Project

Markput is an editable text field that combines plain text with inline custom
components through annotated markup patterns.

Packages:

- `packages/core/` (`@markput/core`): dependency-free TypeScript runtime.
- `packages/react/markput/` (`@markput/react`): React adapter.
- `packages/vue/markput/` (`@markput/vue`): Vue adapter.
- `packages/storybook/` (`@markput/storybook`): shared stories and browser
  tests for React and Vue.
- `packages/react/app/`, `packages/vue/app/`: demo apps.
- `packages/website/` (`@markput/website`): Astro/Starlight docs.

Default branch: `next`. Use `pnpm` for all installs and scripts. Shared
dependency versions live in the pnpm catalog in `pnpm-workspace.yaml`.

## Commands

- Setup: `pnpm install`, then `pnpm exec playwright install chromium` when
  browser tests are needed.
- Focused test: `pnpm -w exec vitest run path/to/file.spec.ts`.
- Full checks: `pnpm test`, `pnpm run build`, `pnpm run typecheck`,
  `pnpm run lint:check`, `pnpm run format:check`.
- Fixers: `pnpm run lint`, `pnpm run format`.
- Dev servers: `pnpm run dev`, `pnpm run dev:sb:react`,
  `pnpm run dev:sb:vue`, `pnpm run dev:react:app`, `pnpm run dev:vue:app`,
  `pnpm run dev:website`.

## Architecture Work

This file is an operating guide, not the architecture source of truth. Before
changing core behavior, feature boundaries, token rendering, DOM mapping, caret
recovery, or adapter wiring, read the relevant code and the current docs under
`packages/website/src/content/docs/development/`.

The core architecture is actively evolving. Do not preserve stale patterns just
because they appear in older docs or comments. If code, tests, and docs
disagree, verify the intended behavior and update the stale source as part of
the change or call out the mismatch.

Keep ownership boundaries explicit. Runtime state should have one clear owner,
DOM-to-token questions should go through the DOM/mapping layer that owns them,
and framework adapters should not reach into core internals unless that is the
public contract being changed.

A model is the single source of truth for its state and hosts only logic it
owns — move operations (focus, readOnly, selection) into the model that owns the
state, not a neighbor. Make cross-feature contracts explicit (e.g. emit an
event) instead of relying on watcher or wiring order.

When a change alters observable behavior — even a strict improvement (a throwing
variant becoming infallible, a caret-affinity default shifting token-boundary
semantics, dropping an internal guard) — state the change and its edge cases in
the PR description and commit body. Do not bury semantic changes under "internal
cleanup".

## Workflow

- For non-trivial refactors or features, work design-first then plan-first. Do
  not edit code or dispatch implementer subagents before the design is agreed.
  When asked to "design" or "plan", stop at that artifact and wait.
- Write a design spec under `docs/superpowers/specs/`, get it reviewed (a
  subagent review is encouraged) until approved, then convert it to a checkbox
  plan under `docs/superpowers/plans/` of independently committable tasks.
- Sequence tasks and commits so typecheck and tests pass at every boundary —
  never leave a task where callers still reference a removed or renamed symbol.
  Land large refactors as small, independently green, revertible PRs, not one
  big-bang change. Keep unrelated changes in separate commits.
- For structural changes (moves, renames, splits), relocate code only — keep
  logic byte-for-byte identical so the diff is a pure move. Do any behavior
  change as a separate, explicit step.
- When a spec and its plan disagree, reconcile to one source of truth before
  coding. Keep self-reviews honest — never write "all gaps resolved" while
  blockers remain; list the open issues.

## Engineering Defaults

- Reuse before adding. Search for existing utilities, hooks, helpers, and test
  helpers before introducing new ones.
- Upgrade a close existing abstraction instead of forking a near-duplicate.
- Push back on over-engineered specs, hidden scope creep, mirrored state, DOM
  guesses, duplicated parsing/serialization, ad-hoc caches, and untyped
  boundaries.
- Prefer clear, direct code over clever code. Performance claims need a
  benchmark or a documented hot path.
- Comments should explain constraints or non-obvious trade-offs, not narrate
  what the code already says.
- Actively reduce, don't just preserve. When touching a subsystem, collapse
  internal flags, generation counters, and mirrored/derived state; inline thin
  wrappers, bridges, and single-consumer indirection; delete dead code and any
  internal method, signal, or param with zero non-test consumers.
- Do not add public surface (methods, params, signals) with no current caller —
  add a verb only when a caller needs it. Pick the simplest representation (a
  boolean over a multi-value union, bare `signal({...})` over an explicit type
  annotation) unless complexity is justified.
- Before deleting code, dropping a param, or calling a symbol unused, grep every
  call site across all packages — core, React/Vue adapters, storybook, specs,
  and `index.ts` exports. A core symbol can look unused in one package while an
  adapter or shared type still needs it. State the usage evidence; don't
  preemptively remove. Do not delete the published `@markput/core` surface
  (`packages/core/index.ts`) unless that contract is the agreed change.
- Prefer the simple path that works over defensive guards or no-op stubs that
  hurt DX or read as dead code (keep `range()?.start`, not a wrapping guard). If
  a fallback or stub is load-bearing, keep it and comment why.

### Naming

- Reactive state-holders that own signals and mutations are `*Model`
  (`ValueModel`, `TokenModel`, `PropsModel`); classes that orchestrate behavior
  are `*Controller` (`EditController`, `BlockController`). Name a field for the
  model's role, not its class: `value: ValueModel`, `tokens: TokenModel`.
- Reject vague or concept-conflating names, but do not rename without a concrete
  rationale — gratuitous renames are churn.

## Testing

- Test files are `*.spec.ts`, `*.spec.tsx`, or framework-specific Storybook
  names. Do not add `*.test.ts`.
- Core unit tests live next to the source and use Vitest.
- Test names use imperative present without "should", for example
  `it('returns undefined when token missing')`.
- Parser tests use `toMatchInlineSnapshot()` with `tokensToDebugTree()`.
- Use `@faker-js/faker` for generated test data.
- Storybook files live in `packages/storybook/src/pages/` as
  `*.react.stories.tsx`, `*.react.spec.tsx`, `*.vue.stories.ts`, or
  `*.vue.spec.ts`.
- Browser tests use real Vitest Browser Mode with Playwright. Reuse shared
  helpers from `packages/storybook/src/shared/lib/`.

### Snapshot Failures

Do not regenerate HTML or DOM snapshots automatically. First diff the old and
new structure, explain why it changed, and verify the new structure is
intentional. If you cannot explain the diff, treat it as a regression.

## Checks

For code, behavior, public API, package config, or build config changes, run the
full checks when practical:

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint:check`
5. `pnpm run format:check`

Focused checks are fine during iteration. Report skipped checks with the
reason. Do not claim work is done, tests pass, or a branch is merge-ready until
you have actually run these and seen them green. If you ran only focused checks,
say so explicitly — do not imply everything passed.

For docs-only changes, run `pnpm exec oxfmt --check <changed-files>` or note
that the file is excluded by `oxfmt.config.ts`. For website docs changes that
touch MDX, frontmatter, navigation, or config, also run
`pnpm -F @markput/website run build`.

Update docs under `packages/website/src/content/docs/` whenever public API,
behavior, or settled architecture changes.

## Communication

- Ask when requirements are unclear.
- The user is not a native English speaker. When useful, add a short
  "**Language tips**" section with a corrected phrase and brief explanation.
- PR titles use Conventional Commits.
- When the user challenges a decision, re-check it honestly against the code
  instead of defending it with contrived edge cases. If a scenario you invoked
  is rare or wrong, say so plainly — no performative agreement.
- Keep each PR's title and body matched to its actual diff and current scope.
  When scope shifts, update them rather than letting them go stale, and split
  unrelated work into a separate PR.
