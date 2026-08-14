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
dependency versions live in the pnpm catalog in `pnpm-workspace.yaml`; tooling
used by a single package is pinned in that package's `package.json`.

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
recovery, or adapter wiring, read the relevant code, the glossary in
`CONTEXT.md`, the decision records under `docs/adr/`, and the current docs
under `packages/website/src/content/docs/development/`.

The core architecture is actively evolving. Do not preserve stale patterns just
because they appear in older docs or comments. If code, tests, and docs
disagree, verify the intended behavior and update the stale source as part of
the change or call out the mismatch.

Keep ownership boundaries explicit. Runtime state should have one clear owner,
DOM-to-token questions should go through the DOM/mapping layer that owns them,
and framework adapters should not reach into core internals unless that is the
public contract being changed.

Each state owner is the single source of truth for its state and hosts only the
logic it owns. Put an operation on the owner of the state it mutates rather than
on a neighbor, and make cross-module contracts explicit instead of relying on
wiring or watcher order.

When a change alters observable behavior — even as a strict improvement — call
out the change and its edge cases in the PR and commit body. Do not bury a
behavior change under "internal cleanup".

## Workflow

- Keep every task and commit green: typecheck and tests pass at each boundary,
  with no caller left referencing a removed or renamed symbol. Prefer a series
  of small, independently revertible changes over one big-bang change, and keep
  unrelated changes in separate commits.
- Make structural changes (moves, renames, splits) pure: relocate code without
  changing behavior, so the diff is a clean move. Do any behavior change as a
  separate, explicit step.
- Keep self-reviews honest: list open blockers instead of declaring everything
  resolved.

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
- Actively reduce, don't just preserve. When you touch a subsystem, collapse
  redundant flags, counters, and mirrored or derived state; inline thin wrappers
  and single-consumer indirection; and delete dead code and any internal surface
  with no non-test consumer.
- Don't add public surface (methods, params, fields) without a current caller,
  and pick the simplest representation that works unless added complexity is
  justified.
- Before deleting code, dropping a param, or calling a symbol unused, check every
  call site across all packages, adapters, and tests — usage can hide in a
  consumer outside the one you are editing. Show the evidence rather than
  removing preemptively, and don't remove published API unless that contract is
  the agreed change.
- Prefer the simple path that works over defensive guards or no-op stubs that
  hurt ergonomics or read as dead code. Keep a guard or stub only when it is
  load-bearing, and comment why.
- Name a class and field for its role, not a vague or type-based label — use a
  suffix that separates state-holders from behavior-orchestrators (here,
  `*Model` vs `*Controller`). Don't rename without a concrete reason; gratuitous
  renames are churn.
- Keep proposing improvements. Flag better designs, simplifications, and risks
  you notice — including out of scope, and the next worthwhile change once you
  finish. Restraint is on acting unilaterally, not on suggesting.

## Testing

- Test files are `*.spec.ts`, `*.spec.tsx`, or framework-specific Storybook
  names. Do not add `*.test.ts`.
- Core unit tests live next to the source and use Vitest.
- Test names use imperative present without "should", for example
  `it('returns undefined when token missing')`.
- Parser tests use `toMatchInlineSnapshot()` with `tokensToDebugTree()`.
- Use `@faker-js/faker` for generated test data.
- Storybook files live in `packages/storybook/src/pages/`. A framework segment
  always goes LAST, before the extension: `*.stories.react.tsx`,
  `*.stories.vue.ts`, `*.react.spec.tsx`, `*.vue.spec.ts`. The old order
  (`*.react.stories.tsx`) is matched by no glob and will not be indexed.
- A page that has been migrated to the shared-spec harness is framework-free:
  `<Page>.stories.ts` + `<Page>.spec.ts` (both run by both projects) plus
  `<Page>.fixtures.react.tsx` / `<Page>.fixtures.vue.ts`. The design spec was
  removed from the tree once the work landed; it is in PR #276, and the CSF
  indexer rules in it are not optional.
- A story file exports stories and nothing else — every named export is indexed.
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

## Agent skills

### Issue tracker

Issues live as markdown files under `docs/scratch/<feature>/` in this repo. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, unchanged: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
