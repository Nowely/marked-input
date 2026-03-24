# AGENTS.md

## Project

markput — editable text field with inline custom components.
Monorepo: `@markput/core` (framework-agnostic), `@markput/react`, `@markput/vue`.

## Quick Start

- pnpm >= 9 required (enforced — no npm/yarn)
- `pnpm install` to set up all packages
- `pnpm test` — run all unit tests
- `pnpm run build` — build all packages
- `pnpm run typecheck` — tsc + vue-tsc
- `pnpm run lint` / `pnpm run lint:fix` — oxlint
- `pnpm run format` / `pnpm run format:fix` — oxfmt
- `pnpm run dev:react:sb` / `pnpm run dev:vue:sb` — Storybook
- `pnpm run dev:react:app` / `pnpm run dev:vue:app` — E2E test apps
- `pnpm run dev:website` — Astro/Starlight docs site

## Monorepo Layout

- `packages/common/core/` — framework-agnostic core logic (published as `@markput/core`)
- `packages/react/markput/` — React adapter (published as `@markput/react`)
- `packages/vue/markput/` — Vue adapter (published as `@markput/vue`)
- `packages/react/storybook/` — React Storybook + component tests
- `packages/vue/storybook/` — Vue Storybook + component tests
- `packages/react/app/`, `packages/vue/app/` — E2E test apps
- `packages/website/` — Astro/Starlight documentation site

Shared dependency versions are managed via pnpm catalog in `pnpm-workspace.yaml`.

## Architecture

### Core (`@markput/core`)

- **Store** — central state container; holds reactive state (`defineState()`), DOM refs, controllers, and lifecycle
- **FeatureManager** — registers and toggles feature modules (parsing, overlay, focus, blocks, etc.)
- **Parser** — tokenizes input text into `TextToken` and `MarkToken` segments
- **Controllers** — `FocusController`, `KeyDownController`, `OverlayController`, `TextSelectionController`, `SystemListenerController`, `ContentEditableController`
- **Caret** — static helpers for cursor/selection positioning in contenteditable

### Reactivity

- **Reactive\<T\>** — minimal reactive primitive: `get()`, `set()`, `on(fn)`
- **defineState\<T\>()** — creates reactive state object where each property is a `Signal<T>`
- **defineEvents\<T\>()** — typed event emitters
- **Signal\<T\>** — interface: `get()`, `set()`, `on()`, `use()`

### Framework Adapters

React and Vue adapters bridge core signals to framework reactivity via `createUseHook`.
Data flow: Core state → `Signal.use()` → component re-render.

## Code Rules

- ESM-only, TypeScript strict, `verbatimModuleSyntax: true`
- Use `import type` for type-only imports (enforced by linter)
- Exports must be sorted (enforced by linter)
- No circular imports (`import/no-cycle` is error-level)
- Formatting and style enforced by oxlint + oxfmt via pre-commit hook — do not manually enforce

## Testing

- **Framework**: Vitest
- **Unit tests**: co-located `*.spec.ts` files next to source
- **Component tests**: Vitest Browser Mode + Playwright (Chromium) in storybook packages
- **Run**: `pnpm test` (all), `pnpm test:watch`, `pnpm test:coverage`

## Git & CI

- **Default branch**: `next` (not main)
- **Conventional Commits**: required for PR titles (enforced by CI)
- **Pre-commit hook**: oxlint --fix + oxfmt via lint-staged
- **Release**: automated via release-please on `next` branch

### CI Checks (all must pass to merge)

1. Lint PR title (conventional commit format)
2. `pnpm test`
3. `pnpm run typecheck`
4. `pnpm run lint`
5. `pnpm run build`
6. `pnpm run format`

## Common Pitfalls

- **Wrong package manager**: always use `pnpm`, never `npm` or `yarn`
- **Wrong default branch**: PRs target `next`, not `main`
- **Missing `import type`**: use `import type { Foo }` for type-only imports — the linter will reject bare `import { Foo }` for types
- **Adding deps without catalog**: shared dependencies must be added to the pnpm catalog in `pnpm-workspace.yaml`, not directly in package.json
- **Forgetting typecheck**: `pnpm run typecheck` runs both `tsc` and `vue-tsc` — run it before submitting
- **Test file naming**: tests must be `*.spec.ts` (not `*.test.ts`) and co-located next to source
