# AGENTS.md

## Project

- markput — editable text with inline custom components
- Monorepo: `@markput/core` (framework-agnostic), `@markput/react`, `@markput/vue`

## Setup

- pnpm >= 9 required (enforced, no npm/yarn)
- `pnpm install`

## Commands

- `pnpm test` — run all tests
- `pnpm run build` — build all packages
- `pnpm run lint` — oxlint
- `pnpm run typecheck` — tsc + vue-tsc
- `pnpm run format` — prettier check

## Structure

- `packages/common/core/` — framework-agnostic core logic
- `packages/react/markput/` — React adapter (published)
- `packages/vue/markput/` — Vue adapter (published)
- `packages/react/storybook/` — React Storybook + component tests
- `packages/vue/storybook/` — Vue Storybook
- `packages/react/app/`, `packages/vue/app/` — E2E test apps
- `packages/website/` — Astro/Starlight docs

## Code Rules

- ESM-only, TypeScript strict, `verbatimModuleSyntax: true`
- `import type` for type-only imports (enforced by linter)
- Exports must be sorted (enforced by linter)
- No circular imports (`import/no-cycle` is error-level)
- No semicolons, single quotes, tabs, trailing commas (ES5)
- `arrowParens: "avoid"`

## Naming

- Components: PascalCase (`MarkedInput.tsx`, `Container.vue`)
- Hooks: camelCase with `use` prefix (`useMark.ts`)
- Features: kebab-case dirs (`text-manipulation/`)
- Tests: co-located `*.spec.ts(x)` next to source

## Architecture

- Core uses class-based controllers: `Store`, `FeatureManager`, `Caret`, etc.
- Reactivity via `defineState()`, `defineEvents()`, `Reactive` class
- Framework adapters bridge core to React/Vue via `createUseHook()`
- React and Vue adapters mirror each other's structure

## Testing

- Vitest for unit tests (core, co-located `*.spec.ts`)
- Vitest Browser Mode + Playwright for component tests (storybook package)
- Browser: Chromium headless

## Git

- Default branch: `next` (not main)
- Conventional Commits required for PR titles
- Pre-commit hook: oxlint --fix + prettier via lint-staged
- Release via release-please on `next` branch
