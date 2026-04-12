# Slot Computed Split Design

**Date:** 2026-04-12  
**Status:** Approved

## Problem

The current slot system exposes three tuple-based `Slot` computeds on `store.computed` (`container`, `block`, `span`). Each returns `[Component, slotProps]`. Framework components then manually assemble className, style, and drag logic on top:

```tsx
// Current Container.tsx — 3 useMarkput calls + manual conditional
const [ContainerComponent, containerProps] = useMarkput(s => s.computed.container)
const className = useMarkput(s => s.computed.containerClass)
const style = useMarkput(s => s.computed.containerStyle)
const containerStyle = drag && !readOnly ? {paddingLeft: 24, ...style} : style

<ContainerComponent ref={...} {...containerProps} className={className} style={containerStyle}>
```

This puts assembly logic in the framework layer that belongs in core.

## Goal

Split each slot tuple into two named computeds — one for the component, one for fully resolved props — so framework components only pass `ref` and spread props.

```tsx
// Target Container.tsx — 2 useMarkput calls, no conditional
const Component = useMarkput(s => s.computed.containerComponent) as ElementType
const props     = useMarkput(s => s.computed.containerProps)

<Component ref={(el) => (refs.container = el)} {...props}>
```

## Core Changes — `Store.computed`

### Removed

| Computed | Reason |
|---|---|
| `container` | Replaced by `containerComponent` + `containerProps` |
| `block` | Replaced by `blockComponent` + `blockProps` |
| `span` | Replaced by `spanComponent` + `spanProps` |
| `containerClass` | Folded into `containerProps.className` |
| `containerStyle` | Folded into `containerProps.style` |

### Added

#### `containerComponent`
```ts
containerComponent: computed(() =>
    resolveSlot('container', this.props.slots())
)
```
Resolves the container element type (user-provided or default `'div'`).

#### `containerProps`
```ts
containerProps: computed(prev => {
    const drag = !!this.props.drag()
    const readOnly = this.props.readOnly()
    const baseStyle = merge(this.props.style(), this.props.slotProps()?.container?.style)
    const style = drag && !readOnly
        ? (baseStyle ? {paddingLeft: 24, ...baseStyle} : {paddingLeft: 24})
        : baseStyle
    const {className: _, style: __, ...otherSlotProps} =
        resolveSlotProps('container', this.props.slotProps()) ?? {}
    const next = {
        className: cx(styles.Container, this.props.className(), this.props.slotProps()?.container?.className),
        style,
        ...otherSlotProps,
    }
    return prev && shallow(prev, next) ? prev : next
})
```

Fully resolved props for the container element:
- `className`: base CSS module class + user `className` prop + slotProps `className`, merged via `cx`
- `style`: user `style` prop + slotProps `style`, merged via `merge`, plus `paddingLeft: 24` when drag mode is active and not readOnly
- `...otherSlotProps`: remaining slotProps (data-* attributes), with `className` and `style` stripped to avoid double-application
- Uses `prev`/`shallow` stability pattern (same as existing `containerStyle`) to avoid unnecessary re-renders

#### `blockComponent` / `blockProps`
```ts
blockComponent: computed(() => resolveSlot('block', this.props.slots())),
blockProps:     computed(() => resolveSlotProps('block', this.props.slotProps())),
```

Raw slotProps only — no className/style merging at core level. `Block` has per-instance dynamic `opacity` that can only be resolved at render time (from `blockStore.state.isDragging`), so className/style assembly stays in the framework component.

#### `spanComponent` / `spanProps`
```ts
spanComponent: computed(() => resolveSlot('span', this.props.slots())),
spanProps:     computed(() => resolveSlotProps('span', this.props.slotProps())),
```

Same rationale as block — raw slotProps only.

### `mark` and `overlay` computeds

Unchanged. These are parameterized (take `token` / `option` arguments) so they remain as resolver functions, not split computeds.

## `Slot` Interface — Removed

`packages/core/src/features/slots/types.ts`: the `Slot` interface is removed. The `as unknown as Slot` casts in `Store.ts` are removed. The new computeds are plain `Computed<T>` with inferred types.

The `MarkSlot` and `OverlaySlot` interfaces are **unchanged** (still needed for parameterized slots).

## Framework Changes

### React — `Container.tsx`

Before: 3 `useMarkput` calls + drag conditional + tuple destructure.  
After: 2 `useMarkput` calls, ref only.

```tsx
const Component = useMarkput(s => s.computed.containerComponent) as ElementType
const props     = useMarkput(s => s.computed.containerProps)

<Component ref={(el: HTMLDivElement | null) => (refs.container = el)} {...props}>
    {children}
</Component>
```

### React — `Block.tsx`

Before: tuple destructure + manual className/style.  
After: two named reads + manual merge for dynamic opacity.

```tsx
const Component = useMarkput(s => s.computed.blockComponent) as ElementType
const slotProps = useMarkput(s => s.computed.blockProps)

<Component
    ref={(el) => blockStore.attachContainer(el, blockIndex, store.event)}
    data-testid="block"
    {...slotProps}
    className={cx(styles.Block, slotProps?.className as string)}
    style={{opacity: isDragging ? 0.4 : 1, ...(slotProps?.style as CSSProperties)}}
>
```

### Vue — `Container.vue`

Before: `containerSlot[0]` / `containerSlot[1]` tuple access + separate `:class` and `:style` bindings + inline `containerStyle` computed.  
After: two named refs, `v-bind` handles everything.

```vue
const containerComponent = useMarkput(s => s.computed.containerComponent)
const containerProps = useMarkput(s => s.computed.containerProps)

<component :is="containerComponent" :ref="..." v-bind="containerProps">
```

### Vue — `Block.vue`

Currently hardcodes `<div>` and does not consume `computed.block`. Update to use `blockComponent` + `blockProps` for consistency, with same manual className/style merge as React.

### `types.ts` — React package

The `Slot` augmentation is removed. No replacement needed — `containerComponent` and `containerProps` are typed directly at the call site via cast (`as ElementType`) or inferred.

## Test Changes

`Store.spec.ts` tests for `computed.container`, `computed.block`, `computed.span`, `computed.containerClass`, `computed.containerStyle` are replaced with tests for the six new computeds. Key cases to cover:

- `containerProps` includes correct className and style when no user props
- `containerProps` merges user `className`, `style`, and slotProps className/style
- `containerProps` adds `paddingLeft: 24` when drag is active and not readOnly
- `containerProps` does NOT add `paddingLeft` when readOnly is true
- `containerProps` does NOT double-apply slotProps className/style
- `containerProps` returns stable reference when values unchanged (shallow equality)
- `containerComponent` returns `'div'` by default, user slot when provided
- `blockProps` / `spanProps` return raw slotProps with data-* conversion

## Slots README

Update `packages/core/src/features/slots/README.md` usage examples to reflect the new API.
