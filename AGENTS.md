# AGENTS.md

## Project

- markput — editable text with inline custom components
- Monorepo: `@markput/core` (framework-agnostic), `@markput/react`, `@markput/vue`

## Setup

- pnpm >= 9 required (enforced, no npm/yarn)
- pnpm workspaces (catalog for shared deps)
- `pnpm install`

## Commands

- `pnpm test` — run all tests
- `pnpm run build` — build all packages
- `pnpm run lint` — oxlint
- `pnpm run lint:fix` — oxlint with auto-fix
- `pnpm run typecheck` — tsc + vue-tsc
- `pnpm run format` — prettier check
- `pnpm run format:fix` — prettier write
- `pnpm run dev:react:sb` — React Storybook
- `pnpm run dev:vue:sb` — Vue Storybook
- `pnpm run dev:react:app` — React E2E test app
- `pnpm run dev:vue:app` — Vue E2E test app
- `pnpm run dev:website` — Docs site

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

### Core (`@markput/core`)

Framework-agnostic logic using class-based controllers:

- **`Store`** — Central state container. Holds all state via `defineState()`, DOM node refs, controllers, and lifecycle. Created once per component instance.
- **`FeatureManager`** — Registers and enables/disables feature modules (parsing, overlay, focus, etc.)
- **`Caret`** — Static helpers for cursor/selection position in contenteditable
- **`Parser`** — Tokenizes input text into `TextToken` and `MarkToken` segments
- **Controllers** — `FocusController`, `KeyDownController`, `OverlayController`, `TextSelectionController`, `SystemListenerController`

### Reactivity System

- **`Reactive<T>`** — Minimal reactive primitive with `get()`, `set()`, `on(fn)` subscription
- **`defineState<T>()`** — Creates reactive state object where each property is a `Signal<T>`
- **`defineEvents<T>()`** — Creates typed event emitters with `on(fn)` subscription
- **`Signal<T>`** — Interface: `{ get(), set(), on(), use() }`

### Framework Adapters

React/Vue adapters bridge core to framework reactivity via `createUseHook`:

```ts
// React: creates useState + useEffect subscription
const createUseHook = signal => () => {
    const [value, setValue] = useState(() => signal.get())
    useEffect(() => signal.on(setValue), [signal])
    return value
}

// Vue: returns computed ref
const createUseHook = signal => () => computed(() => signal.get())
```

Data flow: Core state → Signal.use() → Component re-render

### Package Dependencies

```
@markput/react  ─┐
                 ├─→ @markput/core
@markput/vue    ─┘
```

## Testing

- Vitest for unit tests (core, co-located `*.spec.ts`)
- Vitest Browser Mode + Playwright for component tests (storybook package)
- Browser: Chromium headless

## Git

- Default branch: `next` (not main)
- Conventional Commits required for PR titles
- Pre-commit hook: oxlint --fix + prettier via lint-staged
- Release via release-please on `next` branch
