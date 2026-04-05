# Framework Switcher Toolbar Addon Design

**Date:** 2026-04-05 (revised)

## Problem

The current `FrameworkSwitcherTool` has three issues:

1. **Opens in new tab** — `window.open(..., '_blank')` should navigate the same window instead.
2. **Hardcoded localhost URL** — `http://localhost:${port}` breaks in production where instances are on different subdomains (e.g. `markput-react.vercel.app` / `markput-vue.vercel.app`).
3. **Button not scalable** — a plain button only handles two frameworks; a `Select` dropdown is needed as more frameworks are added.

## Decision

Replace the `Button` with Storybook's `Select` component (from `storybook/internal/components`). Drive it from a `FRAMEWORKS` config array. Compute the target URL at runtime using port-swapping for localhost and subdomain-swapping for production. Navigate in the same window.

## Behavior

- The toolbar shows a `Select` dropdown displaying the current framework name.
- Changing the selection navigates the same window to the other framework's Storybook, preserving the current story path (`?path=/story/<id>`).
- If no story is selected, the target opens at its root.
- Selecting the currently active framework is a no-op.
- In local dev, the two instances are distinguished by port (React: 6006, Vue: 6007).
- In production, the instances are distinguished by a framework id embedded in the hostname (e.g. `markput-react.vercel.app` → swap `react` with `vue`).

## Architecture

A single `manager.ts` shared by both Storybook instances. The current framework is detected purely at runtime from `window.location` (port on localhost, hostname substring in production) — no build-time env injection required in the manager bundle. The `FRAMEWORKS` array is the single source of truth for all framework metadata and is the only place to update when adding a new framework.

### `FRAMEWORKS` config

```ts
const FRAMEWORKS = [
  {id: 'react', label: 'React', devPort: 6006},
  {id: 'vue',   label: 'Vue',   devPort: 6007},
]
```

Adding a third framework (e.g. Angular on port 6008) requires one new entry here plus a new `build:angular` / `dev:angular` script in `package.json`.

### Current framework detection

```ts
// Resolved once at module load time in the browser
const currentFramework =
  window.location.hostname === 'localhost'
    ? FRAMEWORKS.find(f => f.devPort === parseInt(window.location.port))
    : FRAMEWORKS.find(f => window.location.hostname.includes(f.id))
const currentFrameworkId = currentFramework!.id
```

### URL computation

`getUrlForFramework` is a pure function — it receives the story id from the caller rather than reading `api` directly:

```ts
function getUrlForFramework(targetId: string, storyId?: string): string {
  const target = FRAMEWORKS.find(f => f.id === targetId)!
  const path = storyId ? `?path=/story/${storyId}` : ''

  if (window.location.hostname === 'localhost') {
    return `http://localhost:${target.devPort}/${path}`
  }

  const hostname = window.location.hostname.replace(currentFrameworkId, targetId)
  return `${window.location.protocol}//${hostname}/${path}`
}
```

### Select component

Inside `FrameworkSwitcherTool`, `useStorybookApi()` provides the current story id:

```ts
function FrameworkSwitcherTool() {
  const api = useStorybookApi()
  const storyId = api.getCurrentStoryData()?.id

  return Select({
    ariaLabel: 'Framework',
    options: FRAMEWORKS.map(f => ({value: f.id, title: f.label})),
    defaultOptions: currentFrameworkId,
    onSelect: (value) => {
      if (value === currentFrameworkId) return
      window.location.href = getUrlForFramework(value as string, storyId)
    },
  })
}
```

`Select` is imported from `storybook/internal/components` (same package as the existing `Button` import). In single-select mode it shows the selected option's title in the toolbar, styled consistently with other Storybook toolbar controls.

## File Changes

| Action | Path |
| ------ | ---- |
| Modify | `packages/storybook/.storybook/manager.ts` |

No other files need to change.

## Ports

| Instance | Dev port |
| -------- | -------- |
| React    | 6006     |
| Vue      | 6007     |

## Production hostnames (convention)

| Instance | Hostname pattern         |
| -------- | ------------------------ |
| React    | `markput-react.*.app`    |
| Vue      | `markput-vue.*.app`      |

The framework id (`react`, `vue`) must appear as a substring in the hostname for the runtime swap to work.

## Success Criteria

- [ ] Toolbar shows a `Select` with the current framework pre-selected
- [ ] Changing selection navigates the same window (no new tab)
- [ ] Story path is preserved when switching frameworks
- [ ] Selecting the current framework does nothing
- [ ] On localhost: navigates to the correct port
- [ ] On production: swaps the framework id in the hostname correctly
- [ ] Adding a third framework requires only one new entry in `FRAMEWORKS` (plus a dev/build script)
- [ ] All existing tests pass (`pnpm test`)
