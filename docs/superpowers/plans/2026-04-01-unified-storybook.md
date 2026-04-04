# Unified Storybook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `@markput/react-storybook` and `@markput/vue-storybook` into a single `@markput/storybook` package with dual framework configs, shared utilities, and Storybook Composition for unified browsing.

**Architecture:** Single `packages/storybook/` package with two Storybook configs (`.storybook-react/`, `.storybook-vue/`), two Vite/Vitest configs, and framework-suffixed file naming (`*.stories.react.tsx`, `*.stories.vue.ts`). Shared helpers (`dom.ts`, `focus.ts`) extracted to `src/shared/lib/`. React Storybook hosts Vue via Composition refs for one-window browsing.

**Tech Stack:** Storybook 10.3, Vitest Browser Mode, Vite 8, React 19, Vue 3, concurrently

---

## File Structure

### Created (new package)

```
packages/storybook/
├── .storybook-react/
│   ├── main.ts                          ← React Storybook config + refs
│   └── preview.ts                       ← React decorators
├── .storybook-vue/
│   ├── main.ts                          ← Vue Storybook config
│   └── preview.ts                       ← Vue decorators
├── public/
│   └── rsuite.min.css                   ← Moved from react/storybook/public/
├── src/
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx           ← From react/storybook
│   │   │   │   ├── Button.vue           ← From vue/storybook
│   │   │   │   ├── Button.css           ← From react/storybook
│   │   │   │   └── index.ts
│   │   │   ├── Text/
│   │   │   │   ├── Text.tsx             ← From react/storybook
│   │   │   │   ├── Text.vue             ← From vue/storybook
│   │   │   │   ├── Text.css             ← From react/storybook
│   │   │   │   └── index.ts
│   │   │   └── Tabs/
│   │   │       ├── Tabs.tsx             ← React-only, from react/storybook
│   │   │       ├── useTab.tsx           ← React-only, from react/storybook
│   │   │       └── index.ts
│   │   ├── hooks/
│   │   │   └── useCaretInfo.react.tsx   ← React-only, renamed
│   │   └── lib/
│   │       ├── dom.ts                   ← Shared, from either (identical)
│   │       ├── focus.ts                 ← Shared, merged from both
│   │       ├── sampleTexts.ts           ← From react/storybook
│   │       ├── testUtils.vue.ts         ← Vue-only, renamed from testUtils.ts
│   │       ├── withPlainValue.react.tsx ← React decorator, renamed
│   │       ├── withPlainValue.vue.ts    ← Vue decorator, renamed
│   │       ├── withStyle.react.tsx      ← React-only, renamed
│   │       └── createVisualTests.react.ts ← React-only, renamed
│   └── pages/
│       ├── Base/
│       │   ├── Base.stories.react.tsx   ← Renamed from Base.stories.tsx
│       │   ├── Base.stories.vue.ts      ← Renamed from Base.stories.ts
│       │   ├── Base.spec.react.tsx      ← Renamed from Base.spec.tsx
│       │   ├── Base.spec.vue.ts         ← Renamed from Base.spec.ts
│       │   ├── keyboard.spec.react.tsx
│       │   ├── keyboard.spec.vue.ts
│       │   ├── MarkputHandler.spec.react.tsx
│       │   └── MarkputHandler.spec.vue.ts
│       ├── Drag/
│       │   ├── Drag.stories.react.tsx
│       │   ├── Drag.stories.vue.ts
│       │   ├── Drag.spec.react.tsx
│       │   ├── Drag.spec.vue.ts
│       │   └── components/TodoMark/     ← React-only sub-components
│       ├── Dynamic/
│       │   ├── Dynamic.stories.react.tsx
│       │   └── Dynamic.stories.vue.ts
│       ├── Nested/
│       │   ├── Nested.stories.react.tsx
│       │   ├── Nested.stories.vue.ts
│       │   ├── nested.spec.react.tsx
│       │   ├── nested.spec.vue.ts
│       │   └── MarkdownOptions.ts       ← Shared config
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
│       ├── Ant/
│       │   └── Ant.stories.react.tsx    ← React-only
│       ├── Material/
│       │   ├── Material.stories.react.tsx
│       │   └── components/...           ← MaterialMentions
│       ├── Rsuite/
│       │   └── Rsuite.stories.react.tsx ← React-only
│       ├── Experimental/
│       │   ├── Experimental.stories.react.tsx
│       │   └── components/...           ← Sub-components
│       ├── stories.spec.react.tsx       ← React smoke test
│       └── stories.spec.vue.ts          ← Vue smoke test
├── vite.config.react.ts
├── vite.config.vue.ts
├── vitest.setup.react.ts
├── vitest.setup.vue.ts
├── tsconfig.json
└── package.json
```

### Modified (root)

- `package.json` — update storybook scripts
- `AGENTS.md` — update monorepo layout docs, commands

### Deleted (after migration verified)

- `packages/react/storybook/` — entire directory
- `packages/vue/storybook/` — entire directory

---

## Task 1: Scaffold package structure and configs

**Files:**

- Create: `packages/storybook/package.json`
- Create: `packages/storybook/tsconfig.json`
- Create: `packages/storybook/.storybook-react/main.ts`
- Create: `packages/storybook/.storybook-react/preview.ts`
- Create: `packages/storybook/.storybook-vue/main.ts`
- Create: `packages/storybook/.storybook-vue/preview.ts`
- Create: `packages/storybook/vite.config.react.ts`
- Create: `packages/storybook/vite.config.vue.ts`
- Create: `packages/storybook/vitest.setup.react.ts`
- Create: `packages/storybook/vitest.setup.vue.ts`

- [ ] **Step 1: Create the package directory structure**

```bash
mkdir -p packages/storybook/{.storybook-react,.storybook-vue,public,src/shared/{components/{Button,Text,Tabs},hooks,lib},src/pages}
```

- [ ] **Step 2: Create `packages/storybook/package.json`**

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

- [ ] **Step 3: Create `packages/storybook/tsconfig.json`**

```json
{
    "extends": "../../tsconfig.json",
    "compilerOptions": {
        "composite": true,
        "jsx": "react-jsx",
        "jsxImportSource": "react"
    },
    "include": ["./**/*.ts", "./**/*.tsx", "./**/*.vue"],
    "exclude": ["node_modules", "dist-react", "dist-vue"]
}
```

- [ ] **Step 4: Create `packages/storybook/.storybook-react/main.ts`**

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

- [ ] **Step 5: Create `packages/storybook/.storybook-react/preview.ts`**

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

- [ ] **Step 6: Create `packages/storybook/.storybook-vue/main.ts`**

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

- [ ] **Step 7: Create `packages/storybook/.storybook-vue/preview.ts`**

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

- [ ] **Step 8: Create `packages/storybook/vite.config.react.ts`**

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

- [ ] **Step 9: Create `packages/storybook/vite.config.vue.ts`**

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

- [ ] **Step 10: Create `packages/storybook/vitest.setup.react.ts`**

```ts
import {setProjectAnnotations} from '@storybook/react-vite'

import * as preview from './.storybook-react/preview'

setProjectAnnotations(preview)
```

- [ ] **Step 11: Create `packages/storybook/vitest.setup.vue.ts`**

```ts
import {setProjectAnnotations} from '@storybook/vue3-vite'

import preview from './.storybook-vue/preview'

setProjectAnnotations(preview)
```

- [ ] **Step 12: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 13: Commit scaffold**

```bash
git add packages/storybook/ pnpm-lock.yaml
git commit -m "chore(storybook): scaffold unified @markput/storybook package"
```

---

## Task 2: Migrate shared framework-agnostic helpers

**Files:**

- Create: `packages/storybook/src/shared/lib/dom.ts`
- Create: `packages/storybook/src/shared/lib/focus.ts`
- Create: `packages/storybook/src/shared/lib/sampleTexts.ts`

These files are framework-agnostic (no React/Vue imports) and will be imported by both frameworks' stories and tests.

- [ ] **Step 1: Copy `dom.ts` from React storybook (identical in both)**

Copy `packages/react/storybook/src/shared/lib/dom.ts` to `packages/storybook/src/shared/lib/dom.ts` as-is. The file is 24 lines, framework-agnostic DOM utility functions (`getElement`, `firstChild`, `childAt`, `childrenOf`, `getActiveElement`). No import changes needed.

```bash
cp packages/react/storybook/src/shared/lib/dom.ts packages/storybook/src/shared/lib/dom.ts
```

- [ ] **Step 2: Create `focus.ts` — merged from both**

Copy `packages/vue/storybook/src/shared/lib/focus.ts` to `packages/storybook/src/shared/lib/focus.ts`. The Vue version (82 lines) is the cleaner variant. Verify it matches the React version functionally. Both export `focusAtStart`, `focusAtEnd`, `focusAtOffset`, `verifyCaretPosition`. The file uses only DOM APIs — no framework dependencies.

```bash
cp packages/vue/storybook/src/shared/lib/focus.ts packages/storybook/src/shared/lib/focus.ts
```

- [ ] **Step 3: Copy `sampleTexts.ts` from React storybook**

This file contains shared markdown sample strings used in stories. React-only originally but useful for both frameworks.

```bash
cp packages/react/storybook/src/shared/lib/sampleTexts.ts packages/storybook/src/shared/lib/sampleTexts.ts
```

- [ ] **Step 4: Verify no framework imports in these files**

Check that `dom.ts`, `focus.ts`, `sampleTexts.ts` contain no imports from `react`, `vue`, `@storybook/react-*`, or `@storybook/vue3-*`. They should only import from standard DOM APIs or be self-contained.

- [ ] **Step 5: Commit shared helpers**

```bash
git add packages/storybook/src/shared/lib/
git commit -m "chore(storybook): migrate shared framework-agnostic helpers"
```

---

## Task 3: Migrate framework-specific helpers

**Files:**

- Create: `packages/storybook/src/shared/lib/withPlainValue.react.tsx` (from `packages/react/storybook/src/shared/lib/withPlainValue.tsx`)
- Create: `packages/storybook/src/shared/lib/withPlainValue.vue.ts` (from `packages/vue/storybook/src/shared/lib/withPlainValue.ts`)
- Create: `packages/storybook/src/shared/lib/withStyle.react.tsx` (from `packages/react/storybook/src/shared/lib/withStyle.tsx`)
- Create: `packages/storybook/src/shared/lib/createVisualTests.react.ts` (from `packages/react/storybook/src/shared/lib/createVisualTests.ts`)
- Create: `packages/storybook/src/shared/lib/testUtils.vue.ts` (from `packages/vue/storybook/src/shared/lib/testUtils.ts`)
- Create: `packages/storybook/src/shared/hooks/useCaretInfo.react.tsx` (from `packages/react/storybook/src/shared/hooks/useCaretInfo.tsx`)

- [ ] **Step 1: Migrate `withPlainValue.react.tsx`**

Copy `packages/react/storybook/src/shared/lib/withPlainValue.tsx` to `packages/storybook/src/shared/lib/withPlainValue.react.tsx`. The file uses React hooks and `@storybook/react` types — no import path changes needed since it only imports from external packages.

```bash
cp packages/react/storybook/src/shared/lib/withPlainValue.tsx packages/storybook/src/shared/lib/withPlainValue.react.tsx
```

- [ ] **Step 2: Migrate `withPlainValue.vue.ts`**

Copy `packages/vue/storybook/src/shared/lib/withPlainValue.ts` to `packages/storybook/src/shared/lib/withPlainValue.vue.ts`. Uses Vue's `defineComponent`, `h()`, `ref()` — no internal import path changes needed.

```bash
cp packages/vue/storybook/src/shared/lib/withPlainValue.ts packages/storybook/src/shared/lib/withPlainValue.vue.ts
```

- [ ] **Step 3: Migrate `withStyle.react.tsx`**

```bash
cp packages/react/storybook/src/shared/lib/withStyle.tsx packages/storybook/src/shared/lib/withStyle.react.tsx
```

- [ ] **Step 4: Migrate `createVisualTests.react.ts`**

```bash
cp packages/react/storybook/src/shared/lib/createVisualTests.ts packages/storybook/src/shared/lib/createVisualTests.react.ts
```

- [ ] **Step 5: Migrate `testUtils.vue.ts`**

```bash
cp packages/vue/storybook/src/shared/lib/testUtils.ts packages/storybook/src/shared/lib/testUtils.vue.ts
```

- [ ] **Step 6: Migrate `useCaretInfo.react.tsx`**

```bash
mkdir -p packages/storybook/src/shared/hooks
cp packages/react/storybook/src/shared/hooks/useCaretInfo.tsx packages/storybook/src/shared/hooks/useCaretInfo.react.tsx
```

- [ ] **Step 7: Commit framework-specific helpers**

```bash
git add packages/storybook/src/shared/
git commit -m "chore(storybook): migrate framework-specific helpers with suffix naming"
```

---

## Task 4: Migrate shared components

**Files:**

- Create: `packages/storybook/src/shared/components/Button/Button.tsx` (from react)
- Create: `packages/storybook/src/shared/components/Button/Button.vue` (from vue)
- Create: `packages/storybook/src/shared/components/Button/Button.css` (from react)
- Create: `packages/storybook/src/shared/components/Button/index.ts`
- Create: `packages/storybook/src/shared/components/Text/Text.tsx` (from react)
- Create: `packages/storybook/src/shared/components/Text/Text.vue` (from vue)
- Create: `packages/storybook/src/shared/components/Text/Text.css` (from react)
- Create: `packages/storybook/src/shared/components/Text/index.ts`
- Create: `packages/storybook/src/shared/components/Tabs/Tabs.tsx` (react-only, from react)
- Create: `packages/storybook/src/shared/components/Tabs/useTab.tsx` (react-only, from react)
- Create: `packages/storybook/src/shared/components/Tabs/index.ts`

- [ ] **Step 1: Copy Button component files**

```bash
cp packages/react/storybook/src/shared/components/Button/Button.tsx packages/storybook/src/shared/components/Button/Button.tsx
cp packages/react/storybook/src/shared/components/Button/Button.css packages/storybook/src/shared/components/Button/Button.css
cp packages/vue/storybook/src/shared/components/Button.vue packages/storybook/src/shared/components/Button/Button.vue
cp packages/react/storybook/src/shared/components/Button/index.ts packages/storybook/src/shared/components/Button/index.ts
```

- [ ] **Step 2: Copy Text component files**

```bash
cp packages/react/storybook/src/shared/components/Text/Text.tsx packages/storybook/src/shared/components/Text/Text.tsx
cp packages/react/storybook/src/shared/components/Text/Text.css packages/storybook/src/shared/components/Text/Text.css
cp packages/vue/storybook/src/shared/components/Text.vue packages/storybook/src/shared/components/Text/Text.vue
cp packages/react/storybook/src/shared/components/Text/index.ts packages/storybook/src/shared/components/Text/index.ts
```

- [ ] **Step 3: Copy Tabs component files (React-only)**

```bash
cp packages/react/storybook/src/shared/components/Tabs/Tabs.tsx packages/storybook/src/shared/components/Tabs/Tabs.tsx
cp packages/react/storybook/src/shared/components/Tabs/useTab.tsx packages/storybook/src/shared/components/Tabs/useTab.tsx
cp packages/react/storybook/src/shared/components/Tabs/index.ts packages/storybook/src/shared/components/Tabs/index.ts
```

- [ ] **Step 4: Commit shared components**

```bash
git add packages/storybook/src/shared/components/
git commit -m "chore(storybook): migrate shared components (Button, Text, Tabs)"
```

---

## Task 5: Migrate React stories and tests

**Files:**

- Copy all files from `packages/react/storybook/src/pages/` to `packages/storybook/src/pages/` with `.stories.react.tsx` / `.spec.react.tsx` renaming
- Copy `packages/react/storybook/public/rsuite.min.css` to `packages/storybook/public/`

This is the largest task. The key transformation is renaming files:

- `*.stories.tsx` → `*.stories.react.tsx`
- `*.spec.tsx` → `*.spec.react.tsx`
- Non-story/spec files (like `MarkdownOptions.ts`, `constants.ts`, component files) keep their original names

- [ ] **Step 1: Copy the rsuite.min.css public asset**

```bash
cp packages/react/storybook/public/rsuite.min.css packages/storybook/public/rsuite.min.css
```

- [ ] **Step 2: Copy and rename Base page files**

```bash
mkdir -p packages/storybook/src/pages/Base
cp packages/react/storybook/src/pages/Base/Base.stories.tsx packages/storybook/src/pages/Base/Base.stories.react.tsx
cp packages/react/storybook/src/pages/Base/Base.spec.tsx packages/storybook/src/pages/Base/Base.spec.react.tsx
cp packages/react/storybook/src/pages/Base/keyboard.spec.tsx packages/storybook/src/pages/Base/keyboard.spec.react.tsx
cp packages/react/storybook/src/pages/Base/MarkputHandler.spec.tsx packages/storybook/src/pages/Base/MarkputHandler.spec.react.tsx
```

- [ ] **Step 3: Copy and rename Drag page files (including TodoMark components)**

```bash
mkdir -p packages/storybook/src/pages/Drag/components/TodoMark
cp packages/react/storybook/src/pages/Drag/Drag.stories.tsx packages/storybook/src/pages/Drag/Drag.stories.react.tsx
cp packages/react/storybook/src/pages/Drag/Drag.spec.tsx packages/storybook/src/pages/Drag/Drag.spec.react.tsx
cp packages/react/storybook/src/pages/Drag/components/TodoMark/TodoMark.tsx packages/storybook/src/pages/Drag/components/TodoMark/TodoMark.tsx
cp packages/react/storybook/src/pages/Drag/components/TodoMark/TodoMark.module.css packages/storybook/src/pages/Drag/components/TodoMark/TodoMark.module.css
cp packages/react/storybook/src/pages/Drag/components/TodoMark/constants.ts packages/storybook/src/pages/Drag/components/TodoMark/constants.ts
cp packages/react/storybook/src/pages/Drag/components/TodoMark/index.ts packages/storybook/src/pages/Drag/components/TodoMark/index.ts
```

- [ ] **Step 4: Copy and rename Dynamic page files**

```bash
mkdir -p packages/storybook/src/pages/Dynamic
cp packages/react/storybook/src/pages/Dynamic/Dynamic.stories.tsx packages/storybook/src/pages/Dynamic/Dynamic.stories.react.tsx
```

- [ ] **Step 5: Copy and rename Nested page files**

```bash
mkdir -p packages/storybook/src/pages/Nested
cp packages/react/storybook/src/pages/Nested/Nested.stories.tsx packages/storybook/src/pages/Nested/Nested.stories.react.tsx
cp packages/react/storybook/src/pages/Nested/nested.spec.tsx packages/storybook/src/pages/Nested/nested.spec.react.tsx
cp packages/react/storybook/src/pages/Nested/MarkdownOptions.ts packages/storybook/src/pages/Nested/MarkdownOptions.ts
```

- [ ] **Step 6: Copy and rename Overlay page files**

```bash
mkdir -p packages/storybook/src/pages/Overlay
cp packages/react/storybook/src/pages/Overlay/Overlay.stories.tsx packages/storybook/src/pages/Overlay/Overlay.stories.react.tsx
cp packages/react/storybook/src/pages/Overlay/Overlay.spec.tsx packages/storybook/src/pages/Overlay/Overlay.spec.react.tsx
```

- [ ] **Step 7: Copy and rename Slots page files**

```bash
mkdir -p packages/storybook/src/pages/Slots
cp packages/react/storybook/src/pages/Slots/Slots.stories.tsx packages/storybook/src/pages/Slots/Slots.stories.react.tsx
cp packages/react/storybook/src/pages/Slots/slots.spec.tsx packages/storybook/src/pages/Slots/slots.spec.react.tsx
```

- [ ] **Step 8: Copy React-only Ant page**

```bash
mkdir -p packages/storybook/src/pages/Ant
cp packages/react/storybook/src/pages/Ant/Ant.stories.tsx packages/storybook/src/pages/Ant/Ant.stories.react.tsx
```

- [ ] **Step 9: Copy React-only Material page (with sub-components)**

```bash
mkdir -p packages/storybook/src/pages/Material/components/MaterialMentions/UserList
cp packages/react/storybook/src/pages/Material/Material.stories.tsx packages/storybook/src/pages/Material/Material.stories.react.tsx
cp -r packages/react/storybook/src/pages/Material/components/ packages/storybook/src/pages/Material/components/
```

- [ ] **Step 10: Copy React-only Rsuite page**

```bash
mkdir -p packages/storybook/src/pages/Rsuite
cp packages/react/storybook/src/pages/Rsuite/Rsuite.stories.tsx packages/storybook/src/pages/Rsuite/Rsuite.stories.react.tsx
```

- [ ] **Step 11: Copy React-only Experimental page (with sub-components)**

```bash
mkdir -p packages/storybook/src/pages/Experimental
cp packages/react/storybook/src/pages/Experimental/Experimental.stories.tsx packages/storybook/src/pages/Experimental/Experimental.stories.react.tsx
cp -r packages/react/storybook/src/pages/Experimental/components/ packages/storybook/src/pages/Experimental/components/
```

- [ ] **Step 12: Copy and rename React smoke test**

```bash
cp packages/react/storybook/src/pages/stories.spec.tsx packages/storybook/src/pages/stories.spec.react.tsx
```

- [ ] **Step 13: Update import paths in React files**

In all migrated React files, update any relative imports that reference `../shared/lib/withPlainValue` to `../shared/lib/withPlainValue.react`, and `../shared/lib/withStyle` to `../shared/lib/withStyle.react`, etc. Use search-and-replace across the migrated files:

- `from '../shared/lib/withPlainValue'` → `from '../shared/lib/withPlainValue.react'`
- `from '../shared/lib/withStyle'` → `from '../shared/lib/withStyle.react'`
- `from '../shared/lib/sampleTexts'` → `from '../shared/lib/sampleTexts'` (no change, shared)
- `from '../shared/lib/createVisualTests'` → `from '../shared/lib/createVisualTests.react'`
- `from '../shared/hooks/useCaretInfo'` → `from '../shared/hooks/useCaretInfo.react'`

Note: Most story/spec files import from `@markput/react`, `vitest-browser-react`, and shared component paths — these should work as-is. Verify each file after migration.

- [ ] **Step 14: Commit React stories and tests**

```bash
git add packages/storybook/
git commit -m "chore(storybook): migrate React stories, tests, and public assets"
```

---

## Task 6: Migrate Vue stories and tests

**Files:**

- Copy all Vue files from `packages/vue/storybook/src/pages/` to `packages/storybook/src/pages/` with `.stories.vue.ts` / `.spec.vue.ts` renaming

Renaming pattern:

- `*.stories.ts` → `*.stories.vue.ts`
- `*.spec.ts` → `*.spec.vue.ts`

- [ ] **Step 1: Copy and rename Base page files**

```bash
cp packages/vue/storybook/src/pages/Base/Base.stories.ts packages/storybook/src/pages/Base/Base.stories.vue.ts
cp packages/vue/storybook/src/pages/Base/Base.spec.ts packages/storybook/src/pages/Base/Base.spec.vue.ts
cp packages/vue/storybook/src/pages/Base/keyboard.spec.ts packages/storybook/src/pages/Base/keyboard.spec.vue.ts
cp packages/vue/storybook/src/pages/Base/MarkputHandler.spec.ts packages/storybook/src/pages/Base/MarkputHandler.spec.vue.ts
```

- [ ] **Step 2: Copy and rename Drag page files**

```bash
cp packages/vue/storybook/src/pages/Drag/Drag.stories.ts packages/storybook/src/pages/Drag/Drag.stories.vue.ts
cp packages/vue/storybook/src/pages/Drag/Drag.spec.ts packages/storybook/src/pages/Drag/Drag.spec.vue.ts
```

- [ ] **Step 3: Copy and rename Dynamic page files**

```bash
cp packages/vue/storybook/src/pages/Dynamic/Dynamic.stories.ts packages/storybook/src/pages/Dynamic/Dynamic.stories.vue.ts
```

- [ ] **Step 4: Copy and rename Nested page files**

```bash
cp packages/vue/storybook/src/pages/Nested/Nested.stories.ts packages/storybook/src/pages/Nested/Nested.stories.vue.ts
cp packages/vue/storybook/src/pages/Nested/nested.spec.ts packages/storybook/src/pages/Nested/nested.spec.vue.ts
```

Note: `MarkdownOptions.ts` was already copied in Task 5 — do not overwrite it.

- [ ] **Step 5: Copy and rename Overlay page files**

```bash
cp packages/vue/storybook/src/pages/Overlay/Overlay.stories.ts packages/storybook/src/pages/Overlay/Overlay.stories.vue.ts
cp packages/vue/storybook/src/pages/Overlay/Overlay.spec.ts packages/storybook/src/pages/Overlay/Overlay.spec.vue.ts
```

- [ ] **Step 6: Copy and rename Slots page files**

```bash
cp packages/vue/storybook/src/pages/Slots/Slots.stories.ts packages/storybook/src/pages/Slots/Slots.stories.vue.ts
cp packages/vue/storybook/src/pages/Slots/slots.spec.ts packages/storybook/src/pages/Slots/slots.spec.vue.ts
```

- [ ] **Step 7: Copy and rename Vue smoke test**

```bash
cp packages/vue/storybook/src/pages/stories.spec.ts packages/storybook/src/pages/stories.spec.vue.ts
```

- [ ] **Step 8: Update import paths in Vue files**

In all migrated Vue files, update relative imports:

- `from '../shared/lib/withPlainValue'` → `from '../shared/lib/withPlainValue.vue'`
- `from '../shared/lib/testUtils'` → `from '../shared/lib/testUtils.vue'`
- `from '../shared/lib/dom'` → `from '../shared/lib/dom'` (no change, shared)
- `from '../shared/lib/focus'` → `from '../shared/lib/focus'` (no change, shared)
- `from '../../shared/components/Button.vue'` → verify path still resolves correctly from new location

Note: The Vue smoke test (`stories.spec.vue.ts`) uses `import.meta.glob('./**/*.stories.ts')` — this must be updated to `import.meta.glob('./**/*.stories.vue.ts')` to match the new naming convention.

- [ ] **Step 9: Commit Vue stories and tests**

```bash
git add packages/storybook/src/pages/
git commit -m "chore(storybook): migrate Vue stories and tests"
```

---

## Task 7: Update root package.json scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Update root package.json scripts**

Replace the storybook-related scripts. In the `"scripts"` section of the root `package.json`:

Remove:

```
"dev:react:sb": "pnpm -F @markput/react-storybook run dev",
"dev:vue:sb": "pnpm -F @markput/vue-storybook run dev",
"build:react:sb": "pnpm -F @markput/react-storybook run build",
"build:vue:sb": "pnpm -F @markput/vue-storybook run build",
```

Add:

```
"dev:sb": "pnpm -F @markput/storybook run dev",
"dev:sb:react": "pnpm -F @markput/storybook run dev:react",
"dev:sb:vue": "pnpm -F @markput/storybook run dev:vue",
"build:sb": "pnpm -F @markput/storybook run build",
```

The `"build"` script (`pnpm -r run build`) will automatically pick up the new package since it uses `-r`.

- [ ] **Step 2: Commit root script changes**

```bash
git add package.json
git commit -m "chore: update root scripts for unified storybook package"
```

---

## Task 8: Verify React tests pass

- [ ] **Step 1: Run React tests**

```bash
pnpm -F @markput/storybook run test:react
```

Expected: All React tests pass. If there are import resolution errors, fix the import paths in the failing files and re-run.

- [ ] **Step 2: Debug and fix any failures**

Common issues to look for:

- Import paths referencing old `withPlainValue` (should be `withPlainValue.react`)
- Import paths referencing old `withStyle` (should be `withStyle.react`)
- Import paths referencing old `useCaretInfo` (should be `useCaretInfo.react`)
- Story file names not matching the vitest include glob (`*.spec.react.tsx`)

---

## Task 9: Verify Vue tests pass

- [ ] **Step 1: Run Vue tests**

```bash
pnpm -F @markput/storybook run test:vue
```

Expected: All Vue tests pass. If there are import resolution errors, fix the import paths.

- [ ] **Step 2: Debug and fix any failures**

Common issues to look for:

- Import paths referencing old `withPlainValue` (should be `withPlainValue.vue`)
- Import paths referencing old `testUtils` (should be `testUtils.vue`)
- Smoke test glob pattern must be `./**/*.stories.vue.ts` instead of `./**/*.stories.ts`
- Vue component imports (`.vue` files) path resolution

---

## Task 10: Verify Storybook dev servers start

- [ ] **Step 1: Start React Storybook**

```bash
pnpm -F @markput/storybook run dev:react
```

Expected: Starts on port 6006, all React stories load correctly. Verify at http://localhost:6006

- [ ] **Step 2: Start Vue Storybook (in a separate terminal)**

```bash
pnpm -F @markput/storybook run dev:vue
```

Expected: Starts on port 6007, all Vue stories load correctly. Verify at http://localhost:6007

- [ ] **Step 3: Verify Composition**

With both servers running, verify the Vue section appears in the React Storybook sidebar (via the `refs` config). Click a Vue story — it should load in the iframe from port 6007.

---

## Task 11: Run full validation suite

- [ ] **Step 1: Run all checks from AGENTS.md**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass. Note: The old `@markput/react-storybook` and `@markput/vue-storybook` tests will fail since their files still exist. This is expected — they will be removed in Task 12.

- [ ] **Step 2: Fix any issues**

Address any typecheck errors, lint warnings, or format issues in the new package.

---

## Task 12: Remove old storybook packages

**Files:**

- Delete: `packages/react/storybook/` (entire directory)
- Delete: `packages/vue/storybook/` (entire directory)

- [ ] **Step 1: Remove old React storybook package**

```bash
rm -rf packages/react/storybook/
```

- [ ] **Step 2: Remove old Vue storybook package**

```bash
rm -rf packages/vue/storybook/
```

- [ ] **Step 3: Reinstall dependencies (removes old workspace links)**

```bash
pnpm install
```

- [ ] **Step 4: Run full validation again**

```bash
pnpm test
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run format
```

Expected: All pass with only `@markput/storybook` tests running.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore(storybook): remove old separate storybook packages"
```

---

## Task 13: Update documentation (AGENTS.md)

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Update Monorepo Layout section**

Change:

```
  react/storybook/    → React component tests (Vitest Browser Mode)
  vue/storybook/      → Vue component tests (Vitest Browser Mode)
```

To:

```
  storybook/           → Unified React + Vue component tests (Vitest Browser Mode)
```

- [ ] **Step 2: Update Commands section**

Replace:

```
- `pnpm run dev:react:sb` / `pnpm run dev:vue:sb` — Storybook dev servers
```

With:

```
- `pnpm run dev:sb` — Start both Storybook dev servers (React + Vue)
- `pnpm run dev:sb:react` / `pnpm run dev:sb:vue` — Individual Storybook dev servers
```

- [ ] **Step 3: Update "Where to put new code" section**

Change storybook references:

```
- React/Vue shared test helpers → `packages/<framework>/storybook/src/shared/lib/`
```

To:

```
- Storybook stories and tests → `packages/storybook/src/pages/`
- Shared storybook helpers → `packages/storybook/src/shared/lib/`
```

- [ ] **Step 4: Commit documentation update**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for unified storybook package"
```
