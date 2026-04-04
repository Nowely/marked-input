# Unified Storybook Design Spec

## Summary

Merge the two separate Storybook packages (`@markput/react-storybook` and `@markput/vue-storybook`) into a single `packages/storybook/` package with dual framework configs, shared utilities, and Storybook Composition for unified browsing.

## Motivation

- **Duplication**: `dom.ts`, `focus.ts`, and story patterns are duplicated across two packages
- **Two dev servers**: Developers must run and manage two separate Storybook instances
- **Maintenance overhead**: Changes to shared patterns must be applied in both packages
- **No unified view**: No way to browse React and Vue stories side-by-side

## Constraints

- Storybook only supports **one framework per instance** — two Storybook processes are required
- Component tests use framework-specific renderers (`vitest-browser-react` vs `vitest-browser-vue`)
- React-only story categories (Ant, Material, Rsuite, Experimental) have no Vue equivalent and will remain React-only
- Both frameworks' Vitest browser tests must continue to work independently

## Package Structure

```
packages/storybook/
├── .storybook-react/
│   ├── main.ts
│   └── preview.ts
├── .storybook-vue/
│   ├── main.ts
│   └── preview.ts
├── public/
│   └── rsuite.min.css
├── src/
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx          # React component
│   │   │   │   ├── Button.vue          # Vue component
│   │   │   │   ├── Button.css          # Shared styles
│   │   │   │   └── index.ts
│   │   │   ├── Text/
│   │   │   │   ├── Text.tsx
│   │   │   │   ├── Text.vue
│   │   │   │   ├── Text.css
│   │   │   │   └── index.ts
│   │   │   └── Tabs/
│   │   │       ├── Tabs.tsx            # React-only
│   │   │       ├── useTab.tsx          # React-only hook
│   │   │       └── index.ts
│   │   ├── hooks/
│   │   │   └── useCaretInfo.react.tsx  # React-only dev hook
│   │   └── lib/
│   │       ├── dom.ts                  # Framework-agnostic (identical in both)
│   │       ├── focus.ts               # Framework-agnostic (identical in both)
│   │       ├── sampleTexts.ts         # Shared markdown sample strings
│   │       ├── testUtils.vue.ts       # Vue-only (withProps helper)
│   │       ├── withPlainValue.react.tsx # React decorator
│   │       ├── withPlainValue.vue.ts    # Vue decorator
│   │       ├── withStyle.react.tsx      # React-only CSS decorator
│   │       └── createVisualTests.react.ts # React-only visual test generator
│   └── pages/
│       ├── Base/
│       │   ├── Base.stories.react.tsx
│       │   ├── Base.stories.vue.ts
│       │   ├── Base.spec.react.tsx
│       │   ├── Base.spec.vue.ts
│       │   ├── keyboard.spec.react.tsx
│       │   ├── keyboard.spec.vue.ts
│       │   ├── MarkputHandler.spec.react.tsx
│       │   └── MarkputHandler.spec.vue.ts
│       ├── Drag/
│       │   ├── Drag.stories.react.tsx
│       │   ├── Drag.stories.vue.ts
│       │   ├── Drag.spec.react.tsx
│       │   ├── Drag.spec.vue.ts
│       │   └── components/
│       │       └── TodoMark/           # Framework-specific sub-components
│       ├── Dynamic/
│       │   ├── Dynamic.stories.react.tsx
│       │   ├── Dynamic.stories.vue.ts
│       ├── Material/                   # React-only — no .vue. files
│       │   ├── Material.stories.react.tsx
│       │   └── MaterialMentions/
│       ├── Ant/
│       │   └── Ant.stories.react.tsx
│       ├── Rsuite/
│       │   └── Rsuite.stories.react.tsx
│       ├── Experimental/
│       │   ├── Experimental.stories.react.tsx
│       │   └── ... (sub-components)
│       ├── Nested/
│       │   ├── Nested.stories.react.tsx
│       │   ├── Nested.stories.vue.ts
│       │   ├── nested.spec.react.tsx
│       │   ├── nested.spec.vue.ts
│       │   └── MarkdownOptions.ts      # Shared config
│       ├── Overlay/
│       │   ├── Overlay.stories.react.tsx
│       │   ├── Overlay.stories.vue.ts
│       │   ├── Overlay.spec.react.tsx
│       │   └── Overlay.spec.vue.ts
│       ├── Slots/
│       │   ├── Slots.stories.react.tsx
│       │   ├── Slots.stories.vue.ts
│       │   ├── slots.spec.react.tsx
│       │   └── slots.spec.vue.ts
│       ├── stories.spec.react.tsx      # React smoke test
│       └── stories.spec.vue.ts         # Vue smoke test
├── vite.config.react.ts
├── vite.config.vue.ts
├── vitest.setup.react.ts
├── vitest.setup.vue.ts
├── tsconfig.json
└── package.json
```

## File Naming Convention

| Type           | React                 | Vue                |
| -------------- | --------------------- | ------------------ |
| Story          | `*.stories.react.tsx` | `*.stories.vue.ts` |
| Spec           | `*.spec.react.tsx`    | `*.spec.vue.ts`    |
| Helper/utility | `*.react.tsx`         | `*.vue.ts`         |

Framework-agnostic files have no suffix: `dom.ts`, `focus.ts`, `sampleTexts.ts`.

This convention ensures each Storybook/Vitest config can target exactly its framework's files via glob patterns, and makes the framework ownership of every file immediately visible.

## Configuration

### `.storybook-react/main.ts`

```ts
import type {StorybookConfig} from '@storybook/react-vite'

const config: StorybookConfig = {
    stories: ['../src/pages/**/*.stories.react.tsx'],
    staticDirs: ['../public'],
    addons: ['@storybook/addon-links', '@storybook/addon-docs'],
    framework: {
        name: '@storybook/react-vite',
        options: {},
    },
    refs: {
        vue: {
            title: 'Vue',
            url: 'http://localhost:6007',
        },
    },
    core: {
        disableTelemetry: true,
    },
}

export default config
```

### `.storybook-react/preview.ts`

```ts
import type {Preview} from '@storybook/react-vite'
import {withPlainValue} from '../src/shared/lib/withPlainValue.react'

const preview: Preview = {
    decorators: [withPlainValue],
    globalTypes: {
        showPlainValue: {
            name: 'Plain Value',
            description: 'Plain value panel position',
            defaultValue: 'right',
            toolbar: {
                icon: 'sidebaralt',
                items: [
                    {value: 'right', title: 'Show right', icon: 'sidebaralt'},
                    {value: 'bottom', title: 'Show bottom', icon: 'bottombar'},
                    {value: 'hide', title: 'Hide', icon: 'eyeclose'},
                ],
            },
        },
    },
    parameters: {
        controls: {
            hideNoControlsWarning: true,
            expanded: true,
        },
        options: {
            storySort: {
                method: 'alphabetical',
                order: ['MarkedInput', 'Styled'],
                locales: 'en-US',
            },
        },
        docs: {
            codePanel: true,
        },
    },
}

export default preview
```

### `.storybook-vue/main.ts`

```ts
import type {StorybookConfig} from '@storybook/vue3-vite'

const config: StorybookConfig = {
    stories: ['../src/pages/**/*.stories.vue.ts'],
    addons: ['@storybook/addon-links', '@storybook/addon-docs'],
    framework: {
        name: '@storybook/vue3-vite',
        options: {},
    },
    core: {
        disableTelemetry: true,
    },
}

export default config
```

### `.storybook-vue/preview.ts`

```ts
import type {Preview} from '@storybook/vue3-vite'
import {withPlainValue} from '../src/shared/lib/withPlainValue.vue'

const preview: Preview = {
    decorators: [withPlainValue],
    globalTypes: {
        showPlainValue: {
            name: 'Plain Value',
            description: 'Plain value panel position',
            defaultValue: 'right',
            toolbar: {
                icon: 'sidebaralt',
                items: [
                    {value: 'right', title: 'Show right', icon: 'sidebaralt'},
                    {value: 'bottom', title: 'Show bottom', icon: 'bottombar'},
                    {value: 'hide', title: 'Hide', icon: 'eyeclose'},
                ],
            },
        },
    },
    parameters: {
        controls: {
            hideNoControlsWarning: true,
            expanded: true,
        },
        options: {
            storySort: {
                method: 'alphabetical',
                order: ['MarkedInput', 'API'],
                locales: 'en-US',
            },
        },
        docs: {
            codePanel: true,
        },
    },
}

export default preview
```

### `vite.config.react.ts`

```ts
import react from '@vitejs/plugin-react-swc'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

export default defineConfig({
    plugins: [react()],
    resolve: {
        dedupe: ['react', 'react-dom'],
    },
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.react.ts'],
        include: ['src/pages/**/*.spec.react.tsx'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'chromium'}],
            viewport: {width: 1280, height: 720},
            headless: true,
        },
    },
})
```

### `vite.config.vue.ts`

```ts
import vue from '@vitejs/plugin-vue'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

export default defineConfig({
    plugins: [vue()],
    resolve: {
        dedupe: ['vue'],
    },
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.vue.ts'],
        include: ['src/pages/**/*.spec.vue.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        browser: {
            enabled: true,
            provider: playwright(),
            instances: [{browser: 'chromium'}],
            viewport: {width: 1280, height: 720},
            headless: true,
        },
    },
})
```

### `vitest.setup.react.ts`

```ts
import {setProjectAnnotations} from '@storybook/react-vite'
import * as preview from './.storybook-react/preview'

setProjectAnnotations(preview)
```

### `vitest.setup.vue.ts`

```ts
import {setProjectAnnotations} from '@storybook/vue3-vite'
import preview from './.storybook-vue/preview'

setProjectAnnotations(preview)
```

## package.json

```json
{
    "name": "@markput/storybook",
    "private": true,
    "type": "module",
    "scripts": {
        "dev:react": "storybook dev --port 6006 -c .storybook-react",
        "dev:vue": "storybook dev --port 6007 -c .storybook-vue",
        "dev": "concurrently \"pnpm run dev:react\" \"pnpm run dev:vue\"",
        "build:react": "storybook build -c .storybook-react -o ./dist-react",
        "build:vue": "storybook build -c .storybook-vue -o ./dist-vue",
        "build": "pnpm run build:react && pnpm run build:vue",
        "test:react": "vitest run --config vite.config.react.ts",
        "test:vue": "vitest run --config vite.config.vue.ts",
        "test": "pnpm run test:react && pnpm run test:vue",
        "test:watch:react": "vitest --config vite.config.react.ts",
        "test:watch:vue": "vitest --config vite.config.vue.ts",
        "test:watch": "concurrently \"pnpm run test:watch:react\" \"pnpm run test:watch:vue\"",
        "coverage": "pnpm run test:react --coverage && pnpm run test:vue --coverage"
    },
    "dependencies": {
        "@emotion/react": "^11.14.0",
        "@emotion/styled": "^11.14.1",
        "@faker-js/faker": "catalog:",
        "@markput/react": "workspace:*",
        "@markput/vue": "workspace:*",
        "@mui/material": "^7.3.7",
        "antd": "^6.3.4",
        "react": "catalog:",
        "react-dom": "catalog:",
        "rsuite": "^6.1.2",
        "vue": "catalog:"
    },
    "devDependencies": {
        "@storybook/addon-docs": "catalog:",
        "@storybook/addon-links": "catalog:",
        "@storybook/cli": "catalog:",
        "@storybook/react-vite": "catalog:",
        "@storybook/vue3-vite": "catalog:",
        "@types/node": "catalog:",
        "@types/react": "catalog:",
        "@types/react-dom": "catalog:",
        "@vitejs/plugin-react-swc": "catalog:",
        "@vitejs/plugin-vue": "catalog:",
        "@vitest/browser-playwright": "catalog:",
        "@vitest/coverage-v8": "catalog:",
        "@vitest/ui": "catalog:",
        "concurrently": "^9.1.2",
        "playwright": "catalog:",
        "storybook": "catalog:",
        "vite": "catalog:",
        "vitest": "catalog:",
        "vitest-browser-react": "catalog:",
        "vitest-browser-vue": "catalog:"
    }
}
```

## Root package.json Script Changes

Replace existing storybook scripts:

```json
{
    "dev:sb": "pnpm -F @markput/storybook run dev",
    "dev:sb:react": "pnpm -F @markput/storybook run dev:react",
    "dev:sb:vue": "pnpm -F @markput/storybook run dev:vue"
}
```

Remove old scripts:

- `dev:react:sb` -> replaced by `dev:sb:react`
- `dev:vue:sb` -> replaced by `dev:sb:vue`

## Shared Helpers

### Framework-agnostic (no suffix)

- `dom.ts` — extracted as-is from either existing package (they're identical)
- `focus.ts` — extracted as-is (functionally identical, minor naming normalized)
- `sampleTexts.ts` — shared markdown sample strings

### Framework-specific (suffixed)

- `withPlainValue.react.tsx` — React decorator using hooks, refs, ResizeObserver
- `withPlainValue.vue.ts` — Vue decorator using defineComponent, render functions, ref()
- `withStyle.react.tsx` — React-only CSS decorator using useInsertionEffect
- `createVisualTests.react.ts` — React-only visual test generator
- `useCaretInfo.react.tsx` — React-only dev hook
- `testUtils.vue.ts` — Vue-only withProps helper

## Shared Components

- `Button.tsx` / `Button.vue` / `Button.css` — framework-specific implementations, shared styles
- `Text.tsx` / `Text.vue` / `Text.css` — framework-specific implementations, shared styles
- `Tabs.tsx` / `useTab.tsx` — React-only

## Storybook Composition

The React Storybook (port 6006) serves as the host with a `refs` entry pointing to the Vue Storybook (port 6007). This provides a unified sidebar where developers can browse both React and Vue stories in one browser tab. The Vue section appears as a top-level navigation item.

**Limitation**: Addons in the composed (Vue) Storybook will not work as they normally do. This is acceptable since the primary value is unified browsing, and addon-dependent workflows use the dedicated Vue Storybook directly.

## Migration Path

1. Create `packages/storybook/` with the new structure
2. Move shared framework-agnostic helpers (`dom.ts`, `focus.ts`) to `src/shared/lib/`
3. Move React stories/tests to `src/pages/` with `.stories.react.tsx` / `.spec.react.tsx` naming
4. Move Vue stories/tests to `src/pages/` with `.stories.vue.ts` / `.spec.vue.ts` naming
5. Move shared components (Button, Text) with framework-specific files side-by-side
6. Create dual Storybook configs (`.storybook-react/`, `.storybook-vue/`)
7. Create dual Vite/Vitest configs (`vite.config.react.ts`, `vite.config.vue.ts`)
8. Update root `package.json` scripts
9. Remove old `packages/react/storybook/` and `packages/vue/storybook/`
10. Verify all tests pass with `pnpm test`
11. Verify both Storybook instances start and Composition works

## Success Criteria

- [ ] All existing React tests pass
- [ ] All existing Vue tests pass
- [ ] React Storybook starts on port 6006 with all stories
- [ ] Vue Storybook starts on port 6007 with all stories
- [ ] Composition shows Vue stories in the React Storybook sidebar
- [ ] `pnpm run dev:sb` starts both instances concurrently
- [ ] `pnpm test`, `pnpm run build`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format` all pass
- [ ] No duplicated code — `dom.ts`, `focus.ts`, `sampleTexts.ts` are single-source
- [ ] Old `packages/react/storybook/` and `packages/vue/storybook/` are fully removed
