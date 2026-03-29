# [CLAUDE.md](http://CLAUDE.md)

## Project

markput — editable text field that combines plain text with inline custom components using annotated markup patterns.
Monorepo: `@markput/core` (framework-agnostic), `@markput/react`, `@markput/vue`.

## Commands

- **pnpm >= 9 required** (enforced — no npm/yarn)
- `pnpm install` — set up all packages
- `pnpm test` — run all tests (core unit + storybook browser)
- `pnpm run build` — build all packages
- `pnpm run typecheck` — tsc + vue-tsc
- `pnpm run lint` / `pnpm run lint:fix` — oxlint
- `pnpm run format` / `pnpm run format:fix` — oxfmt
- `pnpm run dev:react:sb` / `pnpm run dev:vue:sb` — Storybook dev servers
- `pnpm run dev:react:app` / `pnpm run dev:vue:app` — E2E test apps

Run a single test file: `pnpm --filter @markput/core exec vitest run path/to/file.spec.ts`

### Before submitting — run all checks

Always run these commands and ensure they all pass before considering any task complete (no has errors):

1. `pnpm test`
2. `pnpm run build`
3. `pnpm run typecheck`
4. `pnpm run lint`
5. `pnpm run format`

## Monorepo Layout

```
packages/
  common/core/        → @markput/core (zero external deps, pure TS)
  react/markput/      → @markput/react (peer: react 19)
  react/storybook/    → React component tests (Vitest Browser Mode)
  vue/markput/        → @markput/vue (peer: vue 3)
  vue/storybook/      → Vue component tests (Vitest Browser Mode)
  react/app/, vue/app/ → E2E test apps
  website/            → Astro/Starlight docs
```

Shared dependency versions live in pnpm catalog (`pnpm-workspace.yaml`), not in individual package.json files.

### Where to put new code

- Core features/controllers → `packages/common/core/src/features/<feature-name>/`
- Core shared utilities → `packages/common/core/src/shared/`
- React components → `packages/react/markput/src/components/`
- Vue components → `packages/vue/markput/src/components/`
- React/Vue shared test helpers → `packages/<framework>/storybook/src/shared/lib/`

## Architecture

Summary: Store orchestrates reactive Signals, DOM refs (NodeProxy), 7 controllers, BlockRegistry, event bus, and Lifecycle. Controllers are decoupled — they communicate only through `store.state`, `store.events`, and `store.nodes`. The parser is a 3-stage pipeline (SegmentMatcher → PatternMatcher → TreeBuilder).

For full architecture details, read `packages/website/src/content/docs/development/architecture.md`.

### Secondary documentation (website)

Detailed docs live in `packages/website/src/content/docs/`:

- **Introduction** — `introduction/getting-started.mdx`, `introduction/why-markput.md`
- **Guides** — `guides/configuration.md`, `guides/dynamic-marks.md`, `guides/keyboard-handling.md`, `guides/nested-marks.md`, `guides/overlay-customization.md`, `guides/slots-customization.md`
- **Examples** — `examples/autocomplete.md`, `examples/hashtags.md`, `examples/html-like-tags.md`, `examples/markdown-editor.md`, `examples/mention-system.md`, `examples/slash-commands.md`
- **API reference** — `api/` (auto-generated classes, functions, interfaces, type aliases)
- **Development** — `development/architecture.md`, `development/how-it-works.md`, `development/performance.md`, `development/inconsistencies.md`, `development/rfc-nested-marks.md`

## Code Rules

- **Keep docs in sync**: when changing public API, behavior, or architecture, update the relevant documentation in `packages/website/src/content/docs/` and this CLAUDE.md file. Outdated docs are worse than no docs — treat doc updates as part of the implementation, not a follow-up task.
- Use reactive's `use()` conistency by framework reactivity system.

### Do NOT

- Do not add direct imports between controllers — all communication goes through `store.state`, `store.events`, or `store.nodes`
- Do not manually create Signals for new state — just access `store.state.newProp` and the Proxy auto-creates it
- Do not install new dependencies without asking first
- Do not modify `pnpm-workspace.yaml` catalog entries without asking first
- Do not assume token immutability — tokens are mutated in-place during editing. Clone before comparing if needed.

## Testing

- **Framework**: Vitest
- **Unit tests**: co-located `*.spec.ts` next to source (not `*.test.ts`)
- **Component tests**: Vitest Browser Mode + Playwright (Chromium) in storybook packages
- `pnpm test` (all), `pnpm test:watch`, `pnpm test:coverage`
- All new public functions in core must have a co-located `.spec.ts` file

### Writing core unit tests

```typescript
import {describe, it, expect, beforeEach, vi} from 'vitest'

describe('Feature', () => {
    beforeEach(() => vi.clearAllMocks())
    it('should ...', () => {
        /* ... */
    })
})
```

Parser tests use `toMatchInlineSnapshot()` with `tokensToDebugTree()` helper. Use `@faker-js/faker` for test data.

### Writing component tests (storybook)

Tests compose Storybook stories as fixtures and use real browser interactions:

```typescript
import {composeStories} from '@storybook/react-vite'
import {render} from 'vitest-browser-react'
import {page, userEvent} from 'vitest/browser'
import * as Stories from './Component.stories'

const {Default} = composeStories(Stories)

it('should handle input', async () => {
  await render(<Default />)
  await userEvent.type(page.getByRole('textbox'), 'hello')
  await expect.element(page.getByText('hello')).toBeVisible()
})
```

Shared helpers: `focusAtStart()`, `focusAtEnd()`, `focusAtOffset()`, `verifyCaretPosition()` in `storybook/src/shared/lib/focus.tsx`.

Vue component tests use `withProps(story, props)` helper from `shared/lib/testUtils.ts`.

## Git & CI

- **Default branch**: `next` (not main) — PRs target `next`
- **Conventional Commits**: required for PR titles (enforced by CI)
- **Pre-commit hook**: oxlint --fix + oxfmt via lint-staged
- **Release**: automated via release-please on `next`

### Commit scopes

Use these scopes in conventional commits: `core`, `react`, `vue`, `storybook`, `drag`, `docs`, `next` (release). Controller-level scopes (e.g., `KeyDownController`, `FocusController`) are acceptable for targeted fixes. Omit scope for cross-cutting changes.

Examples: `feat(core):`, `fix(react):`, `refactor(drag):`, `chore(next):`, `docs:`

### CI Checks (all must pass)

1. Lint PR title (conventional commit format)
2. `pnpm test`
3. `pnpm run typecheck`
4. `pnpm run lint`
5. `pnpm run build`
6. `pnpm run format`

## Common Pitfalls

- Always use `pnpm`, never `npm` or `yarn`
- PRs target `next`, not `main`
- Use `import type { Foo }` for type-only imports — linter rejects bare imports for types
- Shared deps must go in pnpm catalog (`pnpm-workspace.yaml`), not directly in package.json
- Run `pnpm run typecheck` before submitting — it checks both tsc and vue-tsc
- Test files must be `*.spec.ts` (not `*.test.ts`) and co-located next to source
- `Store.state` properties are lazy Signals behind a Proxy — accessing a new property auto-creates it
