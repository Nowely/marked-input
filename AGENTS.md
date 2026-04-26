# AGENTS.md

## Project

Markput is an editable text field that combines plain text with inline custom
components through annotated markup patterns.

Packages:

- `packages/core/` (`@markput/core`): dependency-free TypeScript runtime.
- `packages/react/markput/` (`@markput/react`): React adapter.
- `packages/vue/markput/` (`@markput/vue`): Vue adapter.
- `packages/storybook/` (`@markput/storybook`): shared stories and browser
tests.
- `packages/react/app/`: React E2E app.
- `packages/vue/app/`: Vue E2E app.
- `packages/website/` (`@markput/website`): Astro/Starlight docs.

## Owners

- Core features: `packages/core/src/features/<feature-name>/`
- Core shared utilities: `packages/core/src/shared/`
- React components: `packages/react/markput/src/components/`
- Vue components: `packages/vue/markput/src/components/`
- Storybook stories and tests: `packages/storybook/src/pages/`
- Storybook test helpers: `packages/storybook/src/shared/lib/`
- Website docs: `packages/website/src/content/docs/`
- Shared dependency versions: the pnpm catalog in `pnpm-workspace.yaml`

## Operating Rules

- Use `pnpm` for package scripts and installs.
- Read relevant code and docs before changing behavior; prefer existing
architecture over new abstractions.
- Keep edits scoped. Do not refactor unrelated code or revert dirty worktree
changes you did not make.
- Ask before installing dependencies or editing `pnpm-workspace.yaml` catalog
entries.
- Update `packages/website/src/content/docs/` when changing public API,
behavior, or architecture.
- If runtime behavior and docs disagree, update the docs or call out the
inconsistency.
- Run checks that match the files changed, and report skipped broader checks
with the reason.

## Commands

- Setup: `pnpm install`, `pnpm exec playwright install chromium`
- Focused test: `pnpm -w exec vitest run path/to/file.spec.ts`
- Full checks: `pnpm test`, `pnpm run build`, `pnpm run typecheck`,
`pnpm run lint:check`, `pnpm run format:check`
- Fixers: `pnpm run lint`, `pnpm run format`
- Dev servers: `pnpm run dev`, `pnpm run dev:sb:react`,
`pnpm run dev:sb:vue`, `pnpm run dev:react:app`,
`pnpm run dev:vue:app`

## Architecture Guardrails

Read `packages/website/src/content/docs/development/architecture.md` before
changing core behavior, feature boundaries, token rendering, DOM mapping, or
caret recovery.

The Store orchestrates Signals, feature modules, DOM registration, value edits,
caret recovery, the parser, BlockRegistry, and the event bus. Features
communicate through `store.<feature>.*`, `store.props`, `store.dom`, and
`store.caret`, not direct feature imports.

Ownership rules:

- `store.props`: framework-provided configuration.
- `store.dom`: DOM refs, structural registration, and DOM-to-token mapping.
- `store.value`: accepted serialized value and replacement APIs.
- `store.caret`: caret state and recovery.
- `store.slots`: slot components and slot props.
- Parser code: token addresses and the token index derived from options, drag
mode, and Mark components.

Do not mirror runtime state across features. If two features need the same fact,
expose it from the owner.

DOM/token mapping must go through `store.dom` and adapter-owned structural
registration. Do not infer token location from DOM child parity, public data
attributes, user refs, or `NodeProxy`.

User value mutations must go through `store.value.replaceRange()` or
`store.value.replaceAll()` with raw positions and optional caret recovery.

Tokens are mutated in place during editing. Clone tokens before comparing old
and new token state.

## Code Change Policy

- Do not manually create Signals for new state. Add state to the feature that
owns the underlying concept.
- Framework props belong in `store.props` and are set through
`store.props.set()`.
- Components should depend on the smallest established abstraction that fits
their role.
- Use each framework adapter's established Signal `use()` pattern.
- Temporary compatibility bridges must be named, documented as temporary, and
removed once the owning feature exists.
- Use `import type {Foo}` for type-only imports.
- Keep core public functions covered by co-located unit tests.

## Testing Policy

- Test files use `*.spec.ts`, `*.spec.tsx`, or framework-specific storybook
names; do not add `*.test.ts` files.
- Core unit tests live next to the source and use Vitest.
- Test names use imperative present without "should", for example
`it('returns undefined when token missing')`.
- Parser tests use `toMatchInlineSnapshot()` with `tokensToDebugTree()`.
- Use `@faker-js/faker` for generated test data.
- Storybook files live in `packages/storybook/src/pages/` as
`*.react.stories.tsx`, `*.react.spec.tsx`, `*.vue.stories.ts`, or
`*.vue.spec.ts`.
- Browser tests compose Storybook stories and use real Vitest Browser Mode and
Playwright interactions. Reuse focus helpers from
`packages/storybook/src/shared/lib/focus.ts`; Vue tests can use `withProps()`
from `packages/storybook/src/shared/lib/testUtils.vue.ts`.

## Check Policy

For code, behavior, public API, package config, or build config changes, run:

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint:check`
5. `pnpm run format:check`

Focused checks are fine during iteration. Run the full list before finalizing
mixed or behavioral changes.

For docs-only changes in `AGENTS.md`, `CLAUDE.md`, or docs files not excluded by
`oxfmt.config.ts`, run:

```sh
pnpm exec oxfmt --check <changed-files>
```

If every changed docs file is formatter-excluded, report the skipped format
check with that reason. For website docs changes in
`packages/website/src/content/docs/**`, also run
`pnpm -F @markput/website run build` when MDX, frontmatter, navigation, or config
changes could affect site rendering.

## Git, PR, and CI

- Default branch: `next`.
- PRs target `next`, not `main`.
- CI runs on pull requests and pushes to `next`.
- PR titles must use Conventional Commits.
- Release is automated through release-please on `next`.
- Pre-commit runs oxlint and oxfmt through lint-staged.
- CI mirrors the full local checks in the Check Policy.

