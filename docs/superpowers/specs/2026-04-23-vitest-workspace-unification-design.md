# Vitest Workspace Unification — Design Spec

**Goal:** Consolidate test orchestration into a single root `vite.config.ts` with flat Vitest projects, eliminating config duplication and enabling single-process test execution.

---

## Current State

- `pnpm test` = `pnpm -r run test` — spawns 3 separate vitest processes (core, storybook:react, storybook:vue)
- Storybook uses Vitest `projects` internally for react/vue
- Browser preset (Playwright + Chromium + viewport + headless) duplicated in `packages/core/vite.config.ts` and `packages/storybook/vite.config.ts`
- Root has `vite` in devDeps but no `vitest`, no test config
- Each package has its own test scripts that call `vitest run` independently

## Target State

Root `vite.config.ts` defines 3 flat test projects: `core`, `react`, `vue`. Sub-package vite configs keep only build config. Root scripts use native `vitest` commands.

---

## Changes

### 1. Create root `vite.config.ts`

Single source of truth for all test config. Browser preset defined once.

```ts
import {playwright} from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {defineConfig, defineProject} from 'vitest/config'

const browser = {
  enabled: true,
  provider: playwright(),
  instances: [{browser: 'chromium' as const}],
  viewport: {width: 1280, height: 720},
  headless: true,
  screenshotFailures: false,
}

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    projects: [
      defineProject({
        test: {
          name: 'core',
          include: ['packages/core/src/**/*.spec.ts'],
          browser,
          coverage: {
            exclude: [
              '**/*.bench.ts',
              '**/*.spec.ts',
              '**/dist/**',
              '**/index.ts',
              '**/__testing__/**',
            ],
          },
        },
      }),
      defineProject({
        plugins: [react()],
        resolve: {dedupe: ['react', 'react-dom']},
        test: {
          name: 'react',
          globals: true,
          setupFiles: ['./packages/storybook/vitest.setup.ts'],
          include: ['packages/storybook/src/pages/**/*.react.spec.tsx'],
          browser,
          coverage: {
            exclude: [
              '**/*.stories.ts',
              '**/*.stories.tsx',
              '**/*.spec.ts',
              '**/*.spec.tsx',
              '**/dist/**',
              'vitest.setup.ts',
            ],
          },
        },
      }),
      defineProject({
        plugins: [vue()],
        resolve: {dedupe: ['vue']},
        test: {
          name: 'vue',
          globals: true,
          setupFiles: ['./packages/storybook/vitest.setup.ts'],
          include: ['packages/storybook/src/pages/**/*.vue.spec.ts'],
          browser,
          coverage: {
            exclude: [
              '**/*.stories.ts',
              '**/*.stories.tsx',
              '**/*.spec.ts',
              '**/*.spec.tsx',
              '**/dist/**',
              'vitest.setup.ts',
            ],
          },
        },
      }),
    ],
  },
})
```

### 2. Strip test config from sub-package vite configs

**`packages/core/vite.config.ts`** — build only:

```ts
import path from 'path'
import {fileURLToPath} from 'url'
import {defineConfig} from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, './index.ts'),
      name: 'MarkputCore',
      formats: ['es'],
      fileName: 'index',
    },
  },
})
```

**`packages/storybook/vite.config.ts`** — build only:

```ts
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  plugins: process.env.FRAMEWORK === 'react' ? [react()] : [vue()],
  define: {'process.env.FRAMEWORK': JSON.stringify(process.env.FRAMEWORK ?? '')},
})
```

### 3. Update root `package.json`

Add to devDependencies (all `catalog:`):
- `vitest`
- `@vitest/browser-playwright`
- `@vitest/ui`
- `@vitest/coverage-v8`
- `@vitejs/plugin-react`
- `@vitejs/plugin-vue`

Update scripts:

```json
"test": "vitest run",
"test:ui": "vitest --ui",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 4. Update per-package scripts as thin aliases

**`packages/core/package.json`:**

```json
"test": "vitest run --project core",
"test:watch": "vitest --project core",
"test:ui": "vitest --ui --project core",
"coverage": "vitest run --project core --coverage",
"bench": "vitest bench --run --project core"
```

Remove test-related devDependencies from core: `@vitest/browser-playwright`, `@vitest/coverage-v8`, `@vitest/ui`, `vitest`.

**`packages/storybook/package.json`:**

```json
"test": "vitest run --project react --project vue",
"test:react": "vitest run --project react",
"test:vue": "vitest run --project vue",
"test:watch": "vitest --project react --project vue",
"test:watch:react": "vitest --project react",
"test:watch:vue": "vitest --project vue",
"test:ui": "vitest --ui --project react --project vue",
"test:ui:react": "vitest --ui --project react",
"test:ui:vue": "vitest --ui --project vue",
"coverage": "vitest run --project react --project vue --coverage"
```

Remove test-related devDependencies from storybook: `@vitest/browser-playwright`, `@vitest/coverage-v8`, `@vitest/ui`, `vitest`, `@vitejs/plugin-react`, `@vitejs/plugin-vue`.

### 5. Update `oxlint.config.ts`

The override for `**/vite.config.ts` already covers the root config. Verify `typescript/no-unsafe-call` is off for all vite configs.

### 6. Update `pnpm-workspace.yaml`

No changes needed — catalog entries remain. Root devDeps just reference them.

---

## Risks & Verification

| Risk | Mitigation |
|------|-----------|
| Core tests that are node-only break in browser mode | All core tests currently run with `browser.enabled: true` already — no change |
| Test file imports resolve from root instead of package | Vitest resolves imports relative to the test file location, not the config — no change |
| `vitest bench` needs project filter | Core bench script adds `--project core` |
| Storybook build still needs its vite config | Build scripts (`vite build`) use the sub-package configs which still have build settings |
| `pnpm --filter` usage | Per-package test scripts are thin aliases via `--project` flag |

## What We Get

- **1 vitest process** instead of 3
- **Browser preset defined once** at root
- **Unified `vitest --ui`** showing all 3 projects
- **Unified coverage report** from root
- **`vitest --watch`** from root watches everything
- **~15 fewer devDependency entries** across sub-packages
