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
reason.

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
