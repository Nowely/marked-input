# Drag API Redesign

## Problem

The current `drag` prop couples two concerns: **display layout** (inline vs block) and **drag interaction** (reorder, handle, menu). The API shape `drag?: boolean | { alwaysShowHandle: boolean }` is not extensible, the naming is vague, and the forced switch from inline to block layout is too rigid.

## Solution

Decouple layout from drag into two separate props:

```ts
layout?: 'inline' | 'block'           // default: 'inline'
draggable?: boolean | DraggableConfig  // default: false
```

```ts
interface DraggableConfig {
  alwaysShowHandle?: boolean
}
```

## New Props API

### `layout?: 'inline' | 'block'`

Controls how tokens are rendered. Not a CSS property — describes the token flow model.

- `'inline'` (default): tokens render inline, alternating text and marks within a single contentEditable container. This is the current default behavior.
- `'block'`: each top-level token (text fragment or mark) renders as its own row. Each row is independently editable. Parser uses `skipEmptyText` to avoid empty rows.

### `draggable?: boolean | DraggableConfig`

Enables drag interaction on block rows. Only effective when `layout === 'block'`. Ignored in inline mode.

- `false` (default): no drag affordances. Block rows are static and editable.
- `true`: enables drag with default settings (handle visible on hover, all actions enabled).
- `DraggableConfig`: enables drag with custom settings.

### `DraggableConfig`

```ts
interface DraggableConfig {
  /** Always show the drag grip handle (default: false, shown on hover only) */
  alwaysShowHandle?: boolean
}
```

Future extensions will add `components`, `actions`, and `layout` subsections when needed.

## Migration

| Old API | New API |
|---------|---------|
| `<MarkedInput drag={true} />` | `<MarkedInput layout="block" draggable />` |
| `<MarkedInput drag={{ alwaysShowHandle: true }} />` | `<MarkedInput layout="block" draggable={{ alwaysShowHandle: true }} />` |
| `<MarkedInput />` (no drag) | `<MarkedInput />` (no change) |

## Core Internals

### Store changes

**Removed:**
- `props.drag` signal (`signal<boolean | { alwaysShowHandle: boolean }>`)

**Added:**
- `props.layout` signal (`signal<'inline' | 'block'>`, default `'inline'`)
- `props.draggable` signal (`signal<boolean | DraggableConfig>`, default `false`)

**Computed changes:**
- `computed.parser`: uses `skipEmptyText` when `layout === 'block'` (currently gated on `!!drag`)
- `computed.containerProps`: applies `paddingLeft` only when `draggable` is truthy AND `layout === 'block'`

### Feature gating

Current behavior gates on `!!store.props.drag()`. New gating:

| Feature | Gating condition | Notes |
|---------|-----------------|-------|
| DragFeature | `draggable && layout === 'block'` | Reorder/handle/menu operations |
| BlockEditFeature | `layout === 'block'` | Arrow nav, enter split, backspace merge — works without drag |
| ContentEditableFeature | `layout === 'block'` | Per-row contentEditable sync |
| ArrowNavFeature | `layout === 'block'` → skip | Inline arrow nav disabled in block mode |
| InputFeature | `layout === 'block'` → skip keydown delete | BlockEditFeature handles it instead |

**Key insight:** Block editing (per-row editing, arrow nav between rows, enter to split) is a layout concern, not a drag concern. Drag is purely the reorder/handle/menu layer on top of block layout.

### Type changes

**Removed:**
- `MarkputState.drag` type entry

**Added:**
- `MarkputProps.layout`
- `MarkputProps.draggable`
- `DraggableConfig` interface (exported from `@markput/core`, shared by React and Vue)

**Modified:**
- `DragFeature.spec.ts` — update to use new prop names
- All features checking `store.props.drag()` — switch to `store.props.layout()` or check draggable config

### Config helper

Replace `getAlwaysShowHandleDrag(drag: boolean | { alwaysShowHandle: boolean })` with:

```ts
function getAlwaysShowHandle(draggable: boolean | DraggableConfig): boolean {
  return typeof draggable === 'object' && !!draggable.alwaysShowHandle
}
```

## Rendering

### Container

```tsx
// layout === 'block'
tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)

// layout === 'inline'
tokens.map(t => <Token key={key.get(t)} mark={t} />)
```

### Block component

- Always renders when `layout === 'block'`
- Conditionally includes DragHandle, DropIndicator, BlockMenu only when `draggable` is truthy
- Without drag, Block is a simple row wrapper with no drag affordances

### Framework components affected

Both React and Vue implementations of:
- `MarkedInput` — accept new props, pass to Store via `setProps`
- `Container` — read `layout` instead of `drag` for rendering branch
- `Block` — conditionally render drag elements based on `draggable`
- `DragHandle` — read `DraggableConfig` from store instead of old `drag` prop
- Types — update `MarkedInputProps` interface

## Backward Compatibility

This is a **breaking change**. The `drag` prop is removed entirely. Users must migrate to `layout` + `draggable`.

Since the project hasn't reached 1.0 (targets `next` branch), breaking changes are acceptable.

## Files to Modify

### Core
- `packages/core/src/shared/types.ts` — add `DraggableConfig`, update `MarkputProps`, remove `MarkputState.drag`
- `packages/core/src/store/Store.ts` — replace `props.drag` with `props.layout` + `props.draggable`, update computed
- `packages/core/src/features/drag/DragFeature.ts` — gate on `draggable && layout === 'block'`
- `packages/core/src/features/drag/DragFeature.spec.ts` — update tests
- `packages/core/src/features/drag/config.ts` — update `getAlwaysShowHandle` helper
- `packages/core/src/features/block-editing/BlockEditFeature.ts` — gate on `layout === 'block'`
- `packages/core/src/features/editable/ContentEditableFeature.ts` — check `layout === 'block'`
- `packages/core/src/features/input/InputFeature.ts` — check `layout === 'block'`
- `packages/core/src/features/arrownav/ArrowNavFeature.ts` — check `layout === 'block'`
- `packages/core/src/features/selection/TextSelectionFeature.ts` — check `layout === 'block'`
- `packages/core/src/store/BlockStore.ts` — update drag-related logic if it checks `props.drag`

### React
- `packages/react/markput/src/components/MarkedInput.tsx` — new props
- `packages/react/markput/src/components/Container.tsx` — read `layout`
- `packages/react/markput/src/components/Block.tsx` — conditional drag elements
- `packages/react/markput/src/components/DragHandle.tsx` — read `DraggableConfig`
- `packages/react/markput/src/types.ts` — update types

### Vue
- `packages/vue/markput/src/types.ts` — new props
- `packages/vue/markput/src/components/MarkedInput.vue` — accept new props
- `packages/vue/markput/src/components/Container.vue` — read `layout`
- `packages/vue/markput/src/components/Block.vue` — conditional drag elements
- `packages/vue/markput/src/components/DragHandle.vue` — read `DraggableConfig`

### Storybook
- `packages/storybook/src/pages/Drag/` — update all stories and specs to use new API

### Docs
- `packages/website/src/content/docs/` — update API reference, guides, examples
