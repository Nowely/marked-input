# Remove Tailwind CSS from Website

**Date:** 2026-04-22
**Status:** Approved
**Scope:** `packages/website` only

## Motivation

Tailwind CSS is used only in the website package (`packages/website`) and its usage is minimal — 1 component file with ~12 utility classes plus the `@astrojs/starlight-tailwind` integration. Removing it eliminates 3 dependencies (`tailwindcss`, `@tailwindcss/vite`, `@astrojs/starlight-tailwind`) and aligns the website with the monorepo's preference for standard CSS.

## Current State

- **Tailwind v4** with CSS-first config (no `tailwind.config.*` file)
- **`@astrojs/starlight-tailwind`** provides Starlight theme styles via Tailwind
- **`@tailwindcss/vite`** registered as Vite plugin in `astro.config.ts`
- **1 component** uses Tailwind utility classes: `src/components/demos/Step3Demo.tsx`
- **0 `@apply` directives** anywhere in the codebase
- **Empty `@theme {}` block** — no custom theme extensions
- All other packages (core, react, vue, storybook) use CSS Modules or plain CSS

## Changes

### 1. `packages/website/astro.config.ts`

- Remove `import tailwindcss from '@tailwindcss/vite'`
- Remove `plugins: [tailwindcss() as any]` from Vite config

### 2. `packages/website/src/styles/global.css`

Replace the Tailwind-based CSS with plain CSS. Starlight applies its own default styles via `<starlight-styles>` — the Tailwind integration is opt-in. The new `global.css` will contain only custom overrides if needed, with no `@layer`, `@import`, or `@theme` directives.

### 3. `packages/website/src/components/demos/Step3Demo.tsx`

Convert 12 Tailwind utility classes to inline styles:

| Tailwind class | CSS equivalent |
|---|---|
| `inline-flex` | `display: inline-flex` |
| `gap-2` | `gap: 0.5rem` |
| `!flex` | `display: flex !important` |
| `p-2` | `padding: 0.5rem` |
| `hover:bg-gray-100` | Inline `onMouseEnter`/`onMouseLeave` or omit (demo-only) |
| `h-6 w-6` | `height: 1.5rem; width: 1.5rem` |
| `rounded-full` | `border-radius: 9999px` |
| `fixed` | `position: fixed` |
| `z-10` | `z-index: 10` |
| `border` | `border: 1px solid` |
| `border-gray-200` | `border-color: #e5e7eb` |
| `bg-white` | `background: white` |
| `shadow-md` | `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)` |

### 4. `packages/website/package.json`

Remove three dependencies:
- `tailwindcss: ^4.2.2`
- `@tailwindcss/vite: ^4.2.2`
- `@astrojs/starlight-tailwind: ^5.0.0`

### 5. `packages/website/README.md`

Update any Tailwind example snippets to use plain CSS equivalents (if present and not just documentation examples).

## What Stays the Same

- Starlight's default theme styling (works natively without Tailwind integration)
- `CodePreview.astro`'s Astro scoped `<style>` blocks (already plain CSS)
- All other packages — no changes needed outside `packages/website`

## Verification

- `pnpm install` — ensure deps resolve
- `pnpm run build` — website builds successfully
- Visual check — Starlight theme renders correctly without Tailwind
