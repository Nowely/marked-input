# AGENTS.md

## Project Snapshot

Markput is an editable text field that combines plain text with inline custom
components through annotated markup patterns.

This is a pnpm monorepo:

- `@markput/core`: framework-agnostic TypeScript runtime. Keep it dependency-free.
- `@markput/react`: React 19 adapter.
- `@markput/vue`: Vue 3 adapter.
- `@markput/storybook`: shared React and Vue browser tests and stories.
- `@markput/website`: Astro/Starlight documentation.

`CLAUDE.md` intentionally redirects here. Keep `AGENTS.md` as the source of truth
for agent and contributor instructions.

## Agent Operating Rules

- Use `pnpm` only. The repo enforces `pnpm >= 9`; do not use npm or yarn.
- Prefer the existing architecture over new abstractions. Read the relevant code
  and docs before changing behavior.
- Keep edits scoped to the requested change. Do not refactor unrelated code.
- Do not install dependencies or edit `pnpm-workspace.yaml` catalog entries
  without asking first.
- Do not revert user changes or dirty worktree changes you did not make.
- When changing public API, behavior, or architecture, update the relevant docs
  in `packages/website/src/content/docs/` as part of the same change.
- Before calling work complete, run the checks that match the files changed and
  report any skipped broader checks with the reason.

## Commands

- Setup: `pnpm install`, `pnpm exec playwright install chromium`
- Focused test: `pnpm -w exec vitest run path/to/file.spec.ts`
- Full checks: `pnpm test`, `pnpm run build`, `pnpm run typecheck`,
  `pnpm run lint:check`, `pnpm run format:check`
- Fixers: `pnpm run lint`, `pnpm run format`
- Dev servers: `pnpm run dev`, `pnpm run dev:sb:react`,
  `pnpm run dev:sb:vue`, `pnpm run dev:react:app`,
  `pnpm run dev:vue:app`

## Repository Map

```text
packages/
  core/                @markput/core
  react/markput/       @markput/react
  vue/markput/         @markput/vue
  storybook/           shared stories and browser tests
  react/app/           React E2E app
  vue/app/             Vue E2E app
  website/             Astro/Starlight docs
```

Put new code in the established owner:

- Core features: `packages/core/src/features/<feature-name>/`
- Core shared utilities: `packages/core/src/shared/`
- React components: `packages/react/markput/src/components/`
- Vue components: `packages/vue/markput/src/components/`
- Storybook stories and tests: `packages/storybook/src/pages/`
- Shared Storybook test helpers: `packages/storybook/src/shared/lib/`
- Website docs: `packages/website/src/content/docs/`

Shared dependency versions belong in the pnpm catalog in `pnpm-workspace.yaml`,
not in individual package manifests.

## Architecture Guardrails

Read `packages/website/src/content/docs/development/architecture.md` before
changing core behavior, feature boundaries, token rendering, DOM mapping, or
caret recovery.

The Store orchestrates framework-agnostic Signals, feature modules, DOM
registration, value edits, caret recovery, the parser, BlockRegistry, and the
event bus. Features stay decoupled: communicate through `store.<feature>.*`,
`store.props`, `store.dom`, and `store.caret`, not direct feature imports.

Ownership rules:

- `store.props` owns framework-provided configuration.
- `store.dom` owns DOM refs, structural registration, and DOM-to-token mapping.
- `store.value` owns the accepted serialized value and value replacement APIs.
- `store.caret` owns caret state and recovery.
- `store.slots` owns slot components and slot props.
- Parser code owns token addresses and the token index derived from options,
  drag mode, and Mark components.

Do not duplicate runtime state across features. If two features need the same
fact, expose it from the owner instead of mirroring it in another signal, cache,
or helper.

DOM/token mapping must go through `store.dom` and adapter-owned structural
registration. Do not infer token location from DOM child parity, public data
attributes, user refs, or `NodeProxy`.

User value mutations must go through `store.value.replaceRange()` or
`store.value.replaceAll()` with raw positions and optional caret recovery. Do not
write around the value feature.

Tokens are mutated in place during editing. Clone tokens before comparing old
and new token state.

## Code Change Policy

- Do not manually create Signals for new state. Add state to the feature that
  owns the underlying concept.
- Framework props belong in `store.props` and are set through
  `store.props.set()`.
- Components should depend on the smallest established abstraction that satisfies
  their role.
- Use each framework adapter's established Signal `use()` pattern.
- Temporary compatibility bridges must be clearly named, documented as
  temporary, and removed once the owning feature exists.
- Use `import type {Foo}` for type-only imports.
- Keep core public functions covered by co-located unit tests.

## Testing Policy

Test files use `*.spec.ts` or framework-specific `*.spec.tsx` / `*.spec.ts`
names. Do not add `*.test.ts` files.

- Core unit tests live next to the source and use Vitest.
- Test names use imperative present without "should", for example
  `it('returns undefined when token missing')`.
- Parser tests should use `toMatchInlineSnapshot()` with the
  `tokensToDebugTree()` helper.
- Use `@faker-js/faker` for generated test data.

Storybook component tests live in `packages/storybook/src/pages/` and use
framework-suffixed files:

- React stories: `*.react.stories.tsx`
- React tests: `*.react.spec.tsx`
- Vue stories: `*.vue.stories.ts`
- Vue tests: `*.vue.spec.ts`

Browser tests should compose Storybook stories and use real interactions with
Vitest Browser Mode and Playwright. Reuse shared focus helpers from
`packages/storybook/src/shared/lib/focus.ts`: `focusAtStart()`, `focusAtEnd()`,
`focusAtOffset()`, and `verifyCaretPosition()`. Vue tests can use `withProps()`
from `packages/storybook/src/shared/lib/testUtils.vue.ts`.

## Check Policy

For code, behavior, public API, package config, or build config changes, run all
local checks before considering the task complete:

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint:check`
5. `pnpm run format:check`

During iteration, focused checks are fine. Before finalizing mixed or behavioral
changes, run the full list above.

For docs-only changes in `AGENTS.md`, `CLAUDE.md`, or docs files that are not
excluded by `oxfmt.config.ts`, run:

```sh
pnpm exec oxfmt --check <changed-files>
```

If every changed docs file is excluded by formatter config, report the skipped
format check with that reason.

For website docs changes in `packages/website/src/content/docs/**`, also run
`pnpm -F @markput/website run build` when MDX, frontmatter, navigation, or config
changes could affect site rendering.

## Documentation Policy

Website docs live in `packages/website/src/content/docs/`. Update the relevant
guide, example, API, or development page when public API, behavior, or
architecture changes.

When runtime behavior and docs disagree, treat the mismatch as part of the task:
either update the docs or call out the inconsistency explicitly.

## Git, PR, and CI

- Default branch: `next`.
- PRs target `next`, not `main`.
- CI runs on pull requests and pushes to `next`.
- PR titles must use Conventional Commits.
- Release is automated through release-please on `next`.
- Pre-commit runs oxlint and oxfmt through lint-staged.
- CI mirrors the full local checks in the Check Policy.
